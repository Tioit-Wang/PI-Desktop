use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use uuid::Uuid;

pub const PERMISSION_TIMEOUT_MS: u64 = 120_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PermissionDecision {
    AllowOnce,
    AllowSession,
    Deny,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Risk {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRequest {
    pub request_id: String,
    pub session_id: String,
    pub tool_call_id: String,
    pub tool_name: String,
    pub risk: Risk,
    pub args_preview: serde_json::Value,
    pub reason: String,
    pub timeout_ms: u64,
}

#[derive(Debug)]
struct Pending {
    request: PermissionRequest,
    created_at: Instant,
    tx: Option<tokio::sync::oneshot::Sender<PermissionDecision>>,
}

#[derive(Default)]
pub struct PermissionManager {
    pending: HashMap<String, Pending>,
}

impl PermissionManager {
    pub fn tool_risk(tool_name: &str) -> Risk {
        match tool_name {
            "Read" | "Glob" | "Grep" => Risk::Low,
            "Write" | "Edit" | "Bash" => Risk::High,
            name if name.starts_with("plugin_") => Risk::Low,
            _ => Risk::Medium,
        }
    }

    pub fn chat_mode_allows(tool_name: &str) -> bool {
        matches!(tool_name, "Read" | "Glob" | "Grep") || tool_name.starts_with("plugin_")
    }

    pub fn evaluate_auto(
        &self,
        session_id: &str,
        tool_name: &str,
        mode: &str,
        session_grants: &HashMap<String, Vec<String>>,
    ) -> Option<PermissionDecision> {
        if mode == "chat" && !Self::chat_mode_allows(tool_name) {
            return Some(PermissionDecision::Deny);
        }
        let risk = Self::tool_risk(tool_name);
        if matches!(risk, Risk::Low) {
            return Some(PermissionDecision::AllowOnce);
        }
        if session_grants
            .get(session_id)
            .map(|g| g.iter().any(|t| t == tool_name))
            .unwrap_or(false)
        {
            return Some(PermissionDecision::AllowSession);
        }
        None
    }

    pub fn create_request(
        &mut self,
        session_id: &str,
        tool_call_id: &str,
        tool_name: &str,
        args_preview: serde_json::Value,
        reason: &str,
    ) -> (
        PermissionRequest,
        tokio::sync::oneshot::Receiver<PermissionDecision>,
    ) {
        let request_id = Uuid::new_v4().to_string();
        let request = PermissionRequest {
            request_id: request_id.clone(),
            session_id: session_id.to_string(),
            tool_call_id: tool_call_id.to_string(),
            tool_name: tool_name.to_string(),
            risk: Self::tool_risk(tool_name),
            args_preview,
            reason: reason.to_string(),
            timeout_ms: PERMISSION_TIMEOUT_MS,
        };
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.pending.insert(
            request_id,
            Pending {
                request: request.clone(),
                created_at: Instant::now(),
                tx: Some(tx),
            },
        );
        (request, rx)
    }

    pub fn resolve(
        &mut self,
        request_id: &str,
        decision: PermissionDecision,
    ) -> Result<(), String> {
        let Some(mut pending) = self.pending.remove(request_id) else {
            return Err("NOT_FOUND".into());
        };
        if pending.created_at.elapsed() > Duration::from_millis(PERMISSION_TIMEOUT_MS) {
            let _ = pending
                .tx
                .take()
                .map(|tx| tx.send(PermissionDecision::Deny));
            return Err("PERMISSION_TIMEOUT".into());
        }
        if let Some(tx) = pending.tx.take() {
            let _ = tx.send(decision);
        }
        Ok(())
    }

    pub fn expire_stale(&mut self) {
        let timeout = Duration::from_millis(PERMISSION_TIMEOUT_MS);
        let stale: Vec<String> = self
            .pending
            .iter()
            .filter(|(_, p)| p.created_at.elapsed() > timeout)
            .map(|(k, _)| k.clone())
            .collect();
        for id in stale {
            if let Some(mut p) = self.pending.remove(&id) {
                if let Some(tx) = p.tx.take() {
                    let _ = tx.send(PermissionDecision::Deny);
                }
            }
        }
    }
}
