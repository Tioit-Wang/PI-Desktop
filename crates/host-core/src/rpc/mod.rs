use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{Mutex, mpsc};
use tracing;

use crate::audit;
use crate::permissions::{PermissionDecision, PermissionManager};
use crate::providers::{self, ProviderCreateInput, ProviderUpdateInput};
use crate::sessions::{self, UiMessage};
use crate::state::{AppState, HOST_VERSION, PROTOCOL_VERSION};
use crate::tools::{self, ToolsExecuteParams};

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    id: Option<Value>,
    method: String,
    params: Option<Value>,
}

#[derive(Debug, Serialize)]
struct JsonRpcResponse {
    jsonrpc: &'static str,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i64,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

#[derive(Debug, Serialize)]
struct JsonRpcNotification {
    jsonrpc: &'static str,
    method: String,
    params: Value,
}

pub async fn serve(state: Arc<Mutex<AppState>>) -> Result<()> {
    let stdin = tokio::io::stdin();
    let mut reader = BufReader::new(stdin);
    let mut line = String::new();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    // Writer task — serializes all stdout writes
    let writer = tokio::spawn(async move {
        let mut stdout = tokio::io::stdout();
        while let Some(msg) = rx.recv().await {
            if stdout.write_all(msg.as_bytes()).await.is_err() {
                break;
            }
            if stdout.flush().await.is_err() {
                break;
            }
        }
    });

    loop {
        line.clear();
        let n = reader.read_line(&mut line).await?;
        if n == 0 {
            break;
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let req: JsonRpcRequest = match serde_json::from_str(trimmed) {
            Ok(r) => r,
            Err(e) => {
                let resp = JsonRpcResponse {
                    jsonrpc: "2.0",
                    id: Value::Null,
                    result: None,
                    error: Some(JsonRpcError {
                        code: -32700,
                        message: format!("parse error: {e}"),
                        data: None,
                    }),
                };
                let _ = tx.send(format!("{}\n", serde_json::to_string(&resp)?));
                continue;
            }
        };

        if req.id.is_none() {
            continue;
        }

        let id = req.id.clone().unwrap_or(Value::Null);
        let method = req.method.clone();
        let params = req.params.unwrap_or(json!({}));
        let state = state.clone();
        let tx = tx.clone();

        tokio::spawn(async move {
            let out = match handle_request(state, &method, params, tx.clone()).await {
                Ok(result) => JsonRpcResponse {
                    jsonrpc: "2.0",
                    id,
                    result: Some(result),
                    error: None,
                },
                Err(err) => JsonRpcResponse {
                    jsonrpc: "2.0",
                    id,
                    result: None,
                    error: Some(err),
                },
            };
            if let Ok(raw) = serde_json::to_string(&out) {
                let _ = tx.send(format!("{raw}\n"));
            }
        });
    }

    drop(tx);
    let _ = writer.await;
    Ok(())
}

fn rpc_err(code: i64, message: impl Into<String>, error_code: &str) -> JsonRpcError {
    JsonRpcError {
        code,
        message: message.into(),
        data: Some(json!({ "errorCode": error_code })),
    }
}

async fn emit_notification(tx: &mpsc::UnboundedSender<String>, method: &str, params: Value) {
    let note = JsonRpcNotification {
        jsonrpc: "2.0",
        method: method.to_string(),
        params,
    };
    if let Ok(raw) = serde_json::to_string(&note) {
        let _ = tx.send(format!("{raw}\n"));
    }
}

async fn handle_request(
    state: Arc<Mutex<AppState>>,
    method: &str,
    params: Value,
    tx: mpsc::UnboundedSender<String>,
) -> Result<Value, JsonRpcError> {
    if method != "app.handshake" {
        let st = state.lock().await;
        if !st.handshook {
            return Err(rpc_err(1001, "handshake required", "UNAUTHORIZED"));
        }
    }

    match method {
        "app.handshake" => {
            let client_version = params
                .get("protocolVersion")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32;
            if client_version != PROTOCOL_VERSION {
                return Err(rpc_err(
                    1011,
                    format!("protocol mismatch: client={client_version} host={PROTOCOL_VERSION}"),
                    "PROTOCOL_MISMATCH",
                ));
            }
            let mut st = state.lock().await;
            st.handshook = true;
            if let Ok(path) = st.db.conn().query_row(
                "SELECT path FROM workspace WHERE id = 1",
                [],
                |row| row.get::<_, Option<String>>(0),
            ) {
                if let Some(path) = path {
                    if !path.is_empty() {
                        st.workspace.set(PathBuf::from(path));
                    }
                }
            }
            Ok(json!({
                "protocolVersion": PROTOCOL_VERSION,
                "version": HOST_VERSION,
                "capabilities": [
                    "tools", "sessions", "providers", "secrets", "plugins", "permissions"
                ]
            }))
        }
        "app.health" => {
            let st = state.lock().await;
            Ok(json!({
                "ok": true,
                "protocolVersion": PROTOCOL_VERSION,
                "version": HOST_VERSION,
                "uptimeMs": st.uptime_ms()
            }))
        }
        "app.getVersion" => Ok(json!({
            "name": "pi-desktop-host-core",
            "version": HOST_VERSION,
            "protocolVersion": PROTOCOL_VERSION
        })),

        "workspace.get" => {
            let st = state.lock().await;
            Ok(json!({ "workspace": st.workspace.get() }))
        }
        "workspace.set" => {
            let path = params
                .get("path")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "path required", "INVALID_PARAMS"))?;
            let mut st = state.lock().await;
            let ws = st.workspace.set(PathBuf::from(path));
            st.db
                .conn()
                .execute(
                    "UPDATE workspace SET path = ?1, name = ?2 WHERE id = 1",
                    rusqlite::params![ws.path, ws.name],
                )
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "workspace": ws }))
        }
        "workspace.clear" => {
            let mut st = state.lock().await;
            st.workspace.clear();
            st.db
                .conn()
                .execute(
                    "UPDATE workspace SET path = NULL, name = NULL WHERE id = 1",
                    [],
                )
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "ok": true }))
        }

        "settings.get" => {
            let st = state.lock().await;
            let stored = st
                .db
                .get_setting("app")
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(stored.unwrap_or_else(|| {
                json!({
                    "defaultMode": "agent",
                    "theme": "system",
                    "enterToSend": true,
                    "onboardingDismissed": false
                })
            }))
        }
        "settings.set" => {
            let st = state.lock().await;
            st.db
                .set_setting("app", &params)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "ok": true }))
        }

        "secrets.set" => {
            let secret_ref = params
                .get("secretRef")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "secretRef required", "INVALID_PARAMS"))?;
            let value = params
                .get("value")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "value required", "INVALID_PARAMS"))?;
            let st = state.lock().await;
            let backend = st
                .secrets
                .set(secret_ref, value)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "ok": true, "backend": backend }))
        }
        "secrets.delete" => {
            let secret_ref = params
                .get("secretRef")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "secretRef required", "INVALID_PARAMS"))?;
            let st = state.lock().await;
            st.secrets
                .delete(secret_ref)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "ok": true }))
        }
        "secrets.has" => {
            let secret_ref = params
                .get("secretRef")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "secretRef required", "INVALID_PARAMS"))?;
            let st = state.lock().await;
            Ok(json!({ "has": st.secrets.has(secret_ref) }))
        }
        "secrets.getForRuntime" => {
            let secret_ref = params
                .get("secretRef")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "secretRef required", "INVALID_PARAMS"))?;
            let st = state.lock().await;
            let value = st
                .secrets
                .get(secret_ref)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "value": value }))
        }

        "providers.list" => {
            let include_disabled = params
                .get("includeDisabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            let st = state.lock().await;
            let list = providers::list_providers(&st.db, &st.secrets, include_disabled)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "providers": list }))
        }
        "providers.create" => {
            let input: ProviderCreateInput = serde_json::from_value(params)
                .map_err(|e| rpc_err(1002, e.to_string(), "INVALID_PARAMS"))?;
            let st = state.lock().await;
            let provider = providers::create_provider(&st.db, &st.secrets, input)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "provider": provider }))
        }
        "providers.update" => {
            let input: ProviderUpdateInput = serde_json::from_value(params)
                .map_err(|e| rpc_err(1002, e.to_string(), "INVALID_PARAMS"))?;
            let st = state.lock().await;
            let provider = providers::update_provider(&st.db, &st.secrets, input)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "provider": provider }))
        }
        "providers.delete" => {
            let id = params
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "id required", "INVALID_PARAMS"))?;
            let st = state.lock().await;
            let ok = providers::delete_provider(&st.db, &st.secrets, id)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "ok": ok }))
        }
        "providers.get" => {
            let id = params
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "id required", "INVALID_PARAMS"))?;
            let st = state.lock().await;
            let provider = providers::get_provider(&st.db, &st.secrets, id)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "provider": provider }))
        }
        "providers.getSecret" => {
            let id = params
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "id required", "INVALID_PARAMS"))?;
            let st = state.lock().await;
            let value = providers::get_secret_for_provider(&st.db, &st.secrets, id)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "value": value }))
        }
        "providers.listModels" => {
            let provider_id = params.get("providerId").and_then(|v| v.as_str());
            let st = state.lock().await;
            let providers = providers::list_providers(&st.db, &st.secrets, true)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            let mut models = Vec::new();
            for p in providers {
                if let Some(pid) = provider_id {
                    if p.id != pid {
                        continue;
                    }
                }
                if let Some(model) = p.default_model_id {
                    models.push(json!({
                        "modelId": model,
                        "displayName": model,
                        "providerId": p.id,
                        "source": "user"
                    }));
                }
            }
            Ok(json!({ "models": models }))
        }
        "providers.testConnection" => {
            let id = params
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "id required", "INVALID_PARAMS"))?;
            let st = state.lock().await;
            let provider = providers::get_provider(&st.db, &st.secrets, id)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?
                .ok_or_else(|| rpc_err(1007, "provider not found", "NOT_FOUND"))?;
            Ok(json!({
                "ok": provider.has_secret || provider.auth_kind == "none",
                "provider": provider
            }))
        }

        "session.list" => {
            let st = state.lock().await;
            let sessions = sessions::list_sessions(&st.db)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "sessions": sessions }))
        }
        "session.create" => {
            let st = state.lock().await;
            let session = sessions::create_session(
                &st.db,
                params.get("title").and_then(|v| v.as_str()).map(str::to_string),
                params.get("mode").and_then(|v| v.as_str()).map(str::to_string),
                params.get("providerId").and_then(|v| v.as_str()).map(str::to_string),
                params.get("modelId").and_then(|v| v.as_str()).map(str::to_string),
                params.get("projectPath").and_then(|v| v.as_str()).map(str::to_string),
            )
            .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "session": session }))
        }
        "session.get" => {
            let id = params
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "id required", "INVALID_PARAMS"))?;
            let st = state.lock().await;
            let session = sessions::get_session(&st.db, id)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "session": session }))
        }
        "session.delete" => {
            let id = params
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "id required", "INVALID_PARAMS"))?;
            let st = state.lock().await;
            let ok = sessions::delete_session(&st.db, id)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "ok": ok }))
        }
        "session.rename" => {
            let id = params
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "id required", "INVALID_PARAMS"))?;
            let title = params
                .get("title")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "title required", "INVALID_PARAMS"))?;
            let st = state.lock().await;
            let ok = sessions::rename_session(&st.db, id, title)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "ok": ok }))
        }
        "session.appendMessage" => {
            let session_id = params
                .get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "sessionId required", "INVALID_PARAMS"))?;
            let message: UiMessage = serde_json::from_value(
                params
                    .get("message")
                    .cloned()
                    .ok_or_else(|| rpc_err(1002, "message required", "INVALID_PARAMS"))?,
            )
            .map_err(|e| rpc_err(1002, e.to_string(), "INVALID_PARAMS"))?;
            let st = state.lock().await;
            sessions::append_message(&st.db, session_id, &message)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "ok": true }))
        }
        "session.replaceMessages" => {
            let session_id = params
                .get("sessionId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "sessionId required", "INVALID_PARAMS"))?;
            let messages: Vec<UiMessage> = serde_json::from_value(
                params
                    .get("messages")
                    .cloned()
                    .ok_or_else(|| rpc_err(1002, "messages required", "INVALID_PARAMS"))?,
            )
            .map_err(|e| rpc_err(1002, e.to_string(), "INVALID_PARAMS"))?;
            let st = state.lock().await;
            sessions::replace_messages(&st.db, session_id, &messages)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "ok": true }))
        }

        "tools.list" => Ok(json!({ "tools": tools::builtin_tool_defs() })),
        "tools.execute" => {
            let p: ToolsExecuteParams = serde_json::from_value(params.clone())
                .map_err(|e| rpc_err(1002, e.to_string(), "INVALID_PARAMS"))?;

            let (auto_decision, workspace_path, pending_rx, request_opt) = {
                let mut st = state.lock().await;
                st.permissions.expire_stale();
                let auto = st.permissions.evaluate_auto(
                    &p.session_id,
                    &p.tool_name,
                    &p.mode,
                    &st.session_grants,
                );
                let ws = st.workspace.path.clone();
                if let Some(decision) = auto {
                    (Some(decision), ws, None, None)
                } else {
                    let (req, rx) = st.permissions.create_request(
                        &p.session_id,
                        &p.tool_call_id,
                        &p.tool_name,
                        p.args.clone(),
                        "High-risk tool requires approval",
                    );
                    (None, ws, Some(rx), Some(req))
                }
            };

            if let Some(req) = request_opt {
                emit_notification(
                    &tx,
                    "permissions.request",
                    json!({
                        "requestId": req.request_id,
                        "sessionId": req.session_id,
                        "toolCallId": req.tool_call_id,
                        "toolName": req.tool_name,
                        "risk": req.risk,
                        "argsPreview": req.args_preview,
                        "reason": req.reason,
                        "timeoutMs": req.timeout_ms
                    }),
                )
                .await;
                tracing::info!(request_id = %req.request_id, tool = %req.tool_name, "permission required");
            }

            let final_decision = if let Some(d) = auto_decision {
                d
            } else if let Some(rx) = pending_rx {
                match tokio::time::timeout(
                    std::time::Duration::from_millis(crate::permissions::PERMISSION_TIMEOUT_MS),
                    rx,
                )
                .await
                {
                    Ok(Ok(d)) => d,
                    _ => PermissionDecision::Deny,
                }
            } else {
                PermissionDecision::Deny
            };

            if matches!(final_decision, PermissionDecision::Deny) {
                let st = state.lock().await;
                let _ = audit::append(
                    &st.db,
                    "tool_denied",
                    Some(&p.session_id),
                    json!({
                        "toolName": p.tool_name,
                        "toolCallId": p.tool_call_id,
                        "mode": p.mode
                    }),
                );
                let error_code = if p.mode == "chat" && !PermissionManager::chat_mode_allows(&p.tool_name) {
                    if p.tool_name == "Bash" {
                        "BASH_DISABLED_IN_CHAT"
                    } else {
                        "WRITE_DISABLED_IN_CHAT"
                    }
                } else {
                    "TOOL_DENIED"
                };
                return Ok(json!({
                    "toolCallId": p.tool_call_id,
                    "ok": false,
                    "isError": true,
                    "content": { "error": "permission denied", "code": error_code },
                    "durationMs": 0,
                    "denied": true,
                    "errorCode": error_code
                }));
            }

            if matches!(final_decision, PermissionDecision::AllowSession) {
                let mut st = state.lock().await;
                st.session_grants
                    .entry(p.session_id.clone())
                    .or_default()
                    .push(p.tool_name.clone());
            }

            let ws_path = workspace_path.map(PathBuf::from);
            let timeout = p.timeout_ms.unwrap_or(60_000);
            let mut result =
                tools::execute_tool(ws_path.as_deref(), &p.tool_name, &p.args, timeout).await;
            result.tool_call_id = p.tool_call_id.clone();

            let st = state.lock().await;
            let _ = audit::append(
                &st.db,
                "tool_execute",
                Some(&p.session_id),
                json!({
                    "toolName": p.tool_name,
                    "toolCallId": p.tool_call_id,
                    "ok": result.ok,
                    "durationMs": result.duration_ms,
                    "errorCode": result.error_code
                }),
            );

            serde_json::to_value(result).map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))
        }

        "permissions.evaluate" => {
            let session_id = params.get("sessionId").and_then(|v| v.as_str()).unwrap_or("");
            let tool_name = params.get("toolName").and_then(|v| v.as_str()).unwrap_or("");
            let mode = params.get("mode").and_then(|v| v.as_str()).unwrap_or("agent");
            let st = state.lock().await;
            let decision = st.permissions.evaluate_auto(
                session_id,
                tool_name,
                mode,
                &st.session_grants,
            );
            Ok(json!({
                "decision": decision,
                "risk": PermissionManager::tool_risk(tool_name)
            }))
        }
        "permissions.resolve" => {
            let request_id = params
                .get("requestId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "requestId required", "INVALID_PARAMS"))?;
            let decision_raw = params
                .get("decision")
                .and_then(|v| v.as_str())
                .unwrap_or("deny");
            let decision = match decision_raw {
                "allow-once" => PermissionDecision::AllowOnce,
                "allow-session" => PermissionDecision::AllowSession,
                _ => PermissionDecision::Deny,
            };
            let mut st = state.lock().await;
            st.permissions
                .resolve(request_id, decision)
                .map_err(|code| {
                    let c = if code == "NOT_FOUND" { 1007 } else { 1000 };
                    rpc_err(c, code.clone(), &code)
                })?;
            Ok(json!({ "ok": true }))
        }
        "permissions.listSessionGrants" => {
            let session_id = params.get("sessionId").and_then(|v| v.as_str()).unwrap_or("");
            let st = state.lock().await;
            Ok(json!({
                "grants": st.session_grants.get(session_id).cloned().unwrap_or_default()
            }))
        }
        "permissions.clearSessionGrants" => {
            let session_id = params.get("sessionId").and_then(|v| v.as_str()).unwrap_or("");
            let mut st = state.lock().await;
            st.session_grants.remove(session_id);
            Ok(json!({ "ok": true }))
        }

        "plugins.list" => {
            let st = state.lock().await;
            Ok(json!({ "plugins": st.plugins.list() }))
        }
        "plugins.loadDev" => {
            let path = params
                .get("path")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "path required", "INVALID_PARAMS"))?;
            let mut st = state.lock().await;
            let plugin = st.plugins.load_dev(path).map_err(|e| {
                let msg = e.to_string();
                if msg.contains("PLUGIN_INVALID") {
                    rpc_err(1009, msg, "PLUGIN_INVALID")
                } else {
                    rpc_err(1010, msg, "PLUGIN_LOAD_FAILED")
                }
            })?;
            Ok(json!({ "plugin": plugin }))
        }
        "plugins.enable" => {
            let id = params
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "id required", "INVALID_PARAMS"))?;
            let mut st = state.lock().await;
            let plugin = st
                .plugins
                .set_enabled(id, true)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "plugin": plugin }))
        }
        "plugins.disable" => {
            let id = params
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "id required", "INVALID_PARAMS"))?;
            let mut st = state.lock().await;
            let plugin = st
                .plugins
                .set_enabled(id, false)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "plugin": plugin }))
        }
        "plugins.uninstall" => {
            let id = params
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "id required", "INVALID_PARAMS"))?;
            let mut st = state.lock().await;
            let ok = st
                .plugins
                .uninstall(id)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "ok": ok }))
        }
        "plugins.getPermissions" => {
            let id = params
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| rpc_err(1002, "id required", "INVALID_PARAMS"))?;
            let st = state.lock().await;
            let plugin = st.plugins.list().into_iter().find(|p| p.id == id);
            Ok(json!({
                "permissions": plugin.map(|p| p.permissions).unwrap_or_default()
            }))
        }

        "app.getOnboarding" => {
            let st = state.lock().await;
            let settings = st
                .db
                .get_setting("app")
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?
                .unwrap_or_else(|| json!({}));
            let dismissed = settings
                .get("onboardingDismissed")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let providers = providers::list_providers(&st.db, &st.secrets, true)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            let has_provider = !providers.is_empty();
            let has_secret = providers.iter().any(|p| p.has_secret);
            let has_project = st.workspace.get().is_some();
            let session_count = sessions::session_count(&st.db)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            let has_session = session_count > 0;
            let steps = vec![
                json!({"id":"provider","title":"Add a model provider","done": has_provider, "action":"settings.providers"}),
                json!({"id":"secret","title":"Save your API key","done": has_secret, "action":"settings.providers"}),
                json!({"id":"project","title":"Open a project folder","done": has_project, "action":"project.open"}),
                json!({"id":"prompt","title":"Send your first prompt","done": has_session, "action":"chat.focus"}),
                json!({"id":"plugin","title":"Load a development plugin (optional)","done": !st.plugins.list().is_empty(), "action":"settings.plugins"}),
            ];
            let critical_incomplete = !has_provider || !has_secret || !has_session;
            Ok(json!({
                "showChecklist": critical_incomplete && !dismissed,
                "steps": steps
            }))
        }

        "audit.append" => {
            let kind = params.get("kind").and_then(|v| v.as_str()).unwrap_or("custom");
            let session_id = params.get("sessionId").and_then(|v| v.as_str());
            let payload = params.get("payload").cloned().unwrap_or(json!({}));
            let st = state.lock().await;
            audit::append(&st.db, kind, session_id, payload)
                .map_err(|e| rpc_err(1000, e.to_string(), "INTERNAL"))?;
            Ok(json!({ "ok": true }))
        }

        _ => Err(rpc_err(
            -32601,
            format!("method not found: {method}"),
            "NOT_FOUND",
        )),
    }
}
