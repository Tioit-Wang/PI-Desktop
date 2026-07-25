use anyhow::Result;
use ignore::WalkBuilder;
use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;
use std::process::Stdio;
use std::time::Instant;
use tokio::process::Command;

use crate::workspace::resolve_in_workspace;

pub const MAX_RESULT_BYTES: usize = 256 * 1024;
pub const MAX_RESULT_LINES: usize = 4000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolsExecuteParams {
    pub session_id: String,
    pub turn_id: Option<String>,
    pub tool_call_id: String,
    pub tool_name: String,
    pub args: Value,
    pub mode: String,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolsExecuteResult {
    pub tool_call_id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
    pub content: Value,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub denied: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

pub fn truncate_output(text: &str) -> (String, bool) {
    let mut truncated = false;
    let mut lines: Vec<&str> = text.lines().collect();
    if lines.len() > MAX_RESULT_LINES {
        lines.truncate(MAX_RESULT_LINES);
        truncated = true;
    }
    let mut out = lines.join("\n");
    if out.len() > MAX_RESULT_BYTES {
        out.truncate(MAX_RESULT_BYTES);
        truncated = true;
    }
    if truncated {
        out.push_str("\n\n[truncated: output exceeded 256KB or 4000 lines]");
    }
    (out, truncated)
}

pub async fn execute_tool(
    workspace: Option<&Path>,
    tool_name: &str,
    args: &Value,
    timeout_ms: u64,
) -> ToolsExecuteResult {
    let started = Instant::now();
    let tool_call_id = "local".to_string();
    let result = match tool_name {
        "Read" => tool_read(workspace, args),
        "Glob" => tool_glob(workspace, args),
        "Grep" => tool_grep(workspace, args),
        "Write" => tool_write(workspace, args),
        "Edit" => tool_edit(workspace, args),
        "Bash" => tool_bash(workspace, args, timeout_ms).await,
        other if other.starts_with("plugin_") => Ok(json!({
            "ok": true,
            "note": "plugin tools are executed by the plugin runtime in Electron/Node",
            "toolName": other,
            "args": args,
        })),
        other => Err((
            "TOOL_NOT_FOUND".into(),
            format!("unknown tool: {other}"),
        )),
    };

    match result {
        Ok(content) => ToolsExecuteResult {
            tool_call_id,
            ok: true,
            is_error: None,
            content,
            duration_ms: started.elapsed().as_millis() as u64,
            denied: None,
            error_code: None,
        },
        Err((code, message)) => ToolsExecuteResult {
            tool_call_id,
            ok: false,
            is_error: Some(true),
            content: json!({ "error": message, "code": code }),
            duration_ms: started.elapsed().as_millis() as u64,
            denied: Some(code == "TOOL_DENIED" || code == "PATH_OUTSIDE_WORKSPACE"),
            error_code: Some(code),
        },
    }
}

fn require_workspace(workspace: Option<&Path>) -> Result<&Path, (String, String)> {
    workspace.ok_or_else(|| {
        (
            "WORKSPACE_REQUIRED".into(),
            "No workspace is open".into(),
        )
    })
}

fn tool_read(workspace: Option<&Path>, args: &Value) -> Result<Value, (String, String)> {
    let root = require_workspace(workspace)?;
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ("INVALID_ARGUMENT".into(), "path required".into()))?;
    let resolved = resolve_in_workspace(root, path).map_err(|e| (e.clone(), e))?;
    const MAX_READ_BYTES: u64 = 512 * 1024;
    if let Ok(meta) = std::fs::metadata(&resolved) {
        if meta.len() > MAX_READ_BYTES {
            return Err((
                "TOOL_FAILED".into(),
                format!(
                    "file too large for Read ({} bytes > {} limit); use Grep or Bash to sample it",
                    meta.len(),
                    MAX_READ_BYTES
                ),
            ));
        }
    }
    let content = std::fs::read_to_string(&resolved).map_err(|e| {
        (
            "TOOL_FAILED".into(),
            format!("read failed: {e}"),
        )
    })?;
    let (content, truncated) = truncate_output(&content);
    Ok(json!({
        "path": relative_display(root, &resolved),
        "content": content,
        "truncated": truncated,
    }))
}

fn tool_write(workspace: Option<&Path>, args: &Value) -> Result<Value, (String, String)> {
    let root = require_workspace(workspace)?;
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ("INVALID_ARGUMENT".into(), "path required".into()))?;
    let content = args
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ("INVALID_ARGUMENT".into(), "content required".into()))?;
    let resolved = resolve_in_workspace(root, path).map_err(|e| (e.clone(), e))?;
    if let Some(parent) = resolved.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            (
                "TOOL_FAILED".into(),
                format!("mkdir failed: {e}"),
            )
        })?;
    }
    std::fs::write(&resolved, content).map_err(|e| {
        (
            "TOOL_FAILED".into(),
            format!("write failed: {e}"),
        )
    })?;
    Ok(json!({
        "path": relative_display(root, &resolved),
        "bytes": content.len(),
    }))
}

fn tool_edit(workspace: Option<&Path>, args: &Value) -> Result<Value, (String, String)> {
    let root = require_workspace(workspace)?;
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ("INVALID_ARGUMENT".into(), "path required".into()))?;
    let old_str = args
        .get("old_string")
        .or_else(|| args.get("oldString"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| ("INVALID_ARGUMENT".into(), "old_string required".into()))?;
    let new_str = args
        .get("new_string")
        .or_else(|| args.get("newString"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| ("INVALID_ARGUMENT".into(), "new_string required".into()))?;
    let resolved = resolve_in_workspace(root, path).map_err(|e| (e.clone(), e))?;
    let original = std::fs::read_to_string(&resolved).map_err(|e| {
        (
            "TOOL_FAILED".into(),
            format!("read failed: {e}"),
        )
    })?;
    if !original.contains(old_str) {
        return Err((
            "TOOL_FAILED".into(),
            "old_string not found in file".into(),
        ));
    }
    let updated = original.replacen(old_str, new_str, 1);
    std::fs::write(&resolved, &updated).map_err(|e| {
        (
            "TOOL_FAILED".into(),
            format!("write failed: {e}"),
        )
    })?;
    Ok(json!({
        "path": relative_display(root, &resolved),
        "replacements": 1,
    }))
}

fn tool_glob(workspace: Option<&Path>, args: &Value) -> Result<Value, (String, String)> {
    let root = require_workspace(workspace)?;
    let pattern = args
        .get("pattern")
        .and_then(|v| v.as_str())
        .unwrap_or("**/*");
    let glob = globset::GlobBuilder::new(pattern)
        .literal_separator(true)
        .build()
        .map_err(|e| ("INVALID_ARGUMENT".into(), e.to_string()))?;
    let mut set = globset::GlobSetBuilder::new();
    set.add(glob);
    let set = set
        .build()
        .map_err(|e| ("INVALID_ARGUMENT".into(), e.to_string()))?;

    let mut matches = Vec::new();
    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .build();
    for entry in walker.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let rel = path.strip_prefix(root).unwrap_or(path);
        if set.is_match(rel) {
            matches.push(rel.to_string_lossy().to_string());
            if matches.len() >= 2000 {
                break;
            }
        }
    }
    matches.sort();
    Ok(json!({ "matches": matches, "count": matches.len() }))
}

fn tool_grep(workspace: Option<&Path>, args: &Value) -> Result<Value, (String, String)> {
    let root = require_workspace(workspace)?;
    let pattern = args
        .get("pattern")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ("INVALID_ARGUMENT".into(), "pattern required".into()))?;
    let re = RegexBuilder::new(pattern)
        .case_insensitive(
            args.get("caseInsensitive")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
        )
        .build()
        .map_err(|e| ("INVALID_ARGUMENT".into(), e.to_string()))?;

    let mut hits = Vec::new();
    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .build();
    for entry in walker.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(path) else {
            continue;
        };
        for (idx, line) in content.lines().enumerate() {
            if re.is_match(line) {
                let rel = path.strip_prefix(root).unwrap_or(path);
                hits.push(json!({
                    "path": rel.to_string_lossy(),
                    "line": idx + 1,
                    "text": line,
                }));
                if hits.len() >= 200 {
                    break;
                }
            }
        }
        if hits.len() >= 200 {
            break;
        }
    }
    Ok(json!({ "matches": hits, "count": hits.len() }))
}

async fn tool_bash(
    workspace: Option<&Path>,
    args: &Value,
    timeout_ms: u64,
) -> Result<Value, (String, String)> {
    let root = require_workspace(workspace)?;
    let command = args
        .get("command")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ("INVALID_ARGUMENT".into(), "command required".into()))?;

    let mut child = Command::new("bash")
        .arg("-lc")
        .arg(command)
        .current_dir(root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| ("TOOL_FAILED".into(), format!("spawn failed: {e}")))?;

    // Drain pipes concurrently with waiting: a child producing more than the
    // OS pipe buffer (~64KB) would otherwise block forever on write and only
    // die at the timeout.
    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();
    let stdout_task = tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut buf = Vec::new();
        if let Some(out) = stdout_pipe.as_mut() {
            let _ = out.read_to_end(&mut buf).await;
        }
        buf
    });
    let stderr_task = tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut buf = Vec::new();
        if let Some(err) = stderr_pipe.as_mut() {
            let _ = err.read_to_end(&mut buf).await;
        }
        buf
    });

    let wait = tokio::time::timeout(
        std::time::Duration::from_millis(timeout_ms),
        child.wait(),
    )
    .await;

    match wait {
        Ok(Ok(status)) => {
            let stdout_buf = stdout_task.await.unwrap_or_default();
            let stderr_buf = stderr_task.await.unwrap_or_default();
            let stdout = String::from_utf8_lossy(&stdout_buf).to_string();
            let stderr = String::from_utf8_lossy(&stderr_buf).to_string();
            let (stdout, trunc_out) = truncate_output(&stdout);
            let (stderr, trunc_err) = truncate_output(&stderr);
            Ok(json!({
                "exitCode": status.code(),
                "stdout": stdout,
                "stderr": stderr,
                "truncated": trunc_out || trunc_err,
            }))
        }
        Ok(Err(e)) => Err(("TOOL_FAILED".into(), format!("bash failed: {e}"))),
        Err(_) => {
            let _ = child.start_kill();
            stdout_task.abort();
            stderr_task.abort();
            Err(("TOOL_TIMEOUT".into(), "bash timed out".into()))
        }
    }
}

fn relative_display(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string()
}

pub fn builtin_tool_defs() -> Value {
    json!([
        {
            "name": "Read",
            "description": "Read a file inside the workspace",
            "risk": "low",
            "parameters": {
                "type": "object",
                "properties": { "path": { "type": "string" } },
                "required": ["path"]
            }
        },
        {
            "name": "Glob",
            "description": "List files by glob pattern inside the workspace",
            "risk": "low",
            "parameters": {
                "type": "object",
                "properties": { "pattern": { "type": "string" } },
                "required": ["pattern"]
            }
        },
        {
            "name": "Grep",
            "description": "Search file contents inside the workspace",
            "risk": "low",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": { "type": "string" },
                    "caseInsensitive": { "type": "boolean" }
                },
                "required": ["pattern"]
            }
        },
        {
            "name": "Write",
            "description": "Create or overwrite a file inside the workspace",
            "risk": "high",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": { "type": "string" },
                    "content": { "type": "string" }
                },
                "required": ["path", "content"]
            }
        },
        {
            "name": "Edit",
            "description": "Replace text in a workspace file",
            "risk": "high",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": { "type": "string" },
                    "old_string": { "type": "string" },
                    "new_string": { "type": "string" }
                },
                "required": ["path", "old_string", "new_string"]
            }
        },
        {
            "name": "Bash",
            "description": "Run a non-interactive shell command in the workspace",
            "risk": "high",
            "parameters": {
                "type": "object",
                "properties": { "command": { "type": "string" } },
                "required": ["command"]
            }
        }
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn bash_large_output_does_not_deadlock() {
        // >64KB (OS pipe buffer) must not deadlock the child; reader tasks
        // drain concurrently with wait(). Single line to stay under the
        // 4000-line truncation and prove full drainage.
        let dir = tempfile::tempdir().unwrap();
        let result = execute_tool(
            Some(dir.path()),
            "Bash",
            &serde_json::json!({ "command": "head -c 200000 /dev/zero | tr '\\0' 'a'" }),
            15_000,
        )
        .await;
        assert!(result.ok, "bash tool failed: {:?}", result.content);
        let stdout = result.content["stdout"].as_str().unwrap_or_default();
        assert_eq!(stdout.len(), 200_000, "stdout fully drained");
    }

    #[tokio::test]
    async fn read_refuses_oversized_file() {
        let dir = tempfile::tempdir().unwrap();
        let big = dir.path().join("big.txt");
        std::fs::write(&big, "a".repeat(600 * 1024)).unwrap();
        let result = execute_tool(
            Some(dir.path()),
            "Read",
            &serde_json::json!({ "path": "big.txt" }),
            5_000,
        )
        .await;
        assert!(!result.ok);
        assert_eq!(result.error_code.as_deref(), Some("TOOL_FAILED"));
    }
}
