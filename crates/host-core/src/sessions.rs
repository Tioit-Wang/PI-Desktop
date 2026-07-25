use anyhow::{anyhow, Result};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::db::{ms_to_ts, now_ms, ts_to_ms, Database};

/// Values accepted by the persisted per-session thinking selector.  Keep this
/// list in the host boundary so old clients cannot write arbitrary provider
/// options into the session row.
pub const THINKING_LEVELS: [&str; 7] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

pub fn is_valid_thinking_level(level: &str) -> bool {
    THINKING_LEVELS.contains(&level)
}

fn default_thinking_level() -> String {
    "off".to_string()
}

fn validate_thinking_level(level: &str) -> Result<()> {
    if is_valid_thinking_level(level) {
        Ok(())
    } else {
        Err(anyhow!(
            "thinkingLevel must be one of {}",
            THINKING_LEVELS.join(", ")
        ))
    }
}

/// Wire format is unchanged from v1: RFC3339 timestamps, `projectPath`
/// resolved from the projects table, flat tool fields on messages. Storage is
/// schema v3 (block-array transcripts, integer times, per-session `seq`, and
/// persisted thinking level).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub title: String,
    pub project_path: Option<String>,
    pub model_id: Option<String>,
    pub provider_id: Option<String>,
    pub mode: String,
    #[serde(default = "default_thinking_level")]
    pub thinking_level: String,
    pub updated_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_args: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_completed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_duration_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDetail {
    #[serde(flatten)]
    pub summary: SessionSummary,
    pub messages: Vec<UiMessage>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub session_id: String,
    pub session_title: String,
    pub message_id: String,
    pub role: String,
    pub snippet: String,
    pub created_at: String,
}

fn is_default_title(title: &str) -> bool {
    matches!(
        title.trim(),
        "" | "New task" | "New chat" | "新建任务" | "新对话"
    )
}

// ---- UiMessage ⇄ storage row mapping ----------------------------------------

/// (text, content_json, meta_json) for a wire message.
fn ui_to_storage(message: &UiMessage) -> (Option<String>, String, Option<String>) {
    let meta = message
        .status
        .as_ref()
        .map(|s| json!({ "status": s }).to_string());
    if message.role == "tool" {
        let mut blocks = Vec::new();
        if let Some(thinking) = &message.thinking {
            blocks.push(json!({ "type": "thinking", "text": thinking }));
        }
        let mut block = serde_json::Map::new();
        block.insert("type".into(), json!("tool_call"));
        if let Some(v) = &message.tool_call_id {
            block.insert("callId".into(), json!(v));
        }
        if let Some(v) = &message.tool_name {
            block.insert("name".into(), json!(v));
        }
        if let Some(v) = &message.tool_args {
            block.insert("args".into(), v.clone());
        }
        if let Some(v) = &message.tool_result {
            block.insert("result".into(), v.clone());
        }
        if let Some(v) = &message.tool_completed_at {
            block.insert("completedAt".into(), json!(v));
        }
        if let Some(v) = message.tool_duration_ms {
            block.insert("durationMs".into(), json!(v));
        }
        if let Some(v) = &message.tool_status {
            block.insert("status".into(), json!(v));
        }
        if message.is_error.unwrap_or(false) {
            block.insert("isError".into(), json!(true));
        }
        if !message.content.is_empty() {
            block.insert("text".into(), json!(message.content));
        }
        blocks.push(Value::Object(block));
        (None, Value::Array(blocks).to_string(), meta)
    } else {
        let mut blocks = Vec::with_capacity(2);
        if let Some(thinking) = &message.thinking {
            blocks.push(json!({ "type": "thinking", "text": thinking }));
        }
        blocks.push(json!({ "type": "text", "text": message.content }));
        (
            Some(message.content.clone()),
            Value::Array(blocks).to_string(),
            meta,
        )
    }
}

struct MessageRow {
    id: String,
    role: String,
    tool_name: Option<String>,
    is_error: i64,
    text: Option<String>,
    content_json: String,
    meta_json: Option<String>,
    created_at: i64,
}

fn row_to_ui(row: MessageRow) -> UiMessage {
    let blocks: Vec<Value> = serde_json::from_str(&row.content_json).unwrap_or_default();
    let meta: Value = row
        .meta_json
        .as_deref()
        .and_then(|raw| serde_json::from_str(raw).ok())
        .unwrap_or(Value::Null);
    let status = meta
        .get("status")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let thinking = blocks
        .iter()
        .filter_map(|b| {
            (b.get("type").and_then(|t| t.as_str()) == Some("thinking"))
                .then(|| b.get("text").and_then(|v| v.as_str()))
                .flatten()
        })
        .collect::<Vec<_>>();
    let thinking = (!thinking.is_empty()).then(|| thinking.concat());

    if row.role == "tool" {
        let block = blocks
            .iter()
            .find(|b| b.get("type").and_then(|t| t.as_str()) == Some("tool_call"))
            .cloned()
            .unwrap_or(Value::Null);
        let text = block
            .get("text")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_default();
        UiMessage {
            id: row.id,
            role: row.role,
            content: text,
            created_at: ms_to_ts(row.created_at),
            thinking,
            status,
            tool_name: row.tool_name,
            tool_call_id: block
                .get("callId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            tool_status: block
                .get("status")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            tool_args: block.get("args").cloned(),
            tool_result: block.get("result").cloned(),
            tool_completed_at: block
                .get("completedAt")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            tool_duration_ms: block.get("durationMs").and_then(|v| v.as_i64()),
            is_error: if row.is_error != 0 { Some(true) } else { None },
        }
    } else {
        let content = row.text.unwrap_or_else(|| {
            blocks
                .iter()
                .filter_map(|b| match b.get("type").and_then(|t| t.as_str()) {
                    Some("text") => b.get("text").and_then(|v| v.as_str()),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("")
        });
        UiMessage {
            id: row.id,
            role: row.role,
            content,
            created_at: ms_to_ts(row.created_at),
            thinking,
            status,
            tool_name: None,
            tool_call_id: None,
            tool_status: None,
            tool_args: None,
            tool_result: None,
            tool_completed_at: None,
            tool_duration_ms: None,
            is_error: if row.is_error != 0 { Some(true) } else { None },
        }
    }
}

fn insert_message(
    conn: &rusqlite::Connection,
    session_id: &str,
    seq: i64,
    turn_id: Option<&str>,
    message: &UiMessage,
    created_at: i64,
) -> Result<()> {
    let (text, content_json, meta_json) = ui_to_storage(message);
    let mut stmt = conn.prepare_cached(
        "INSERT INTO messages (
            id, session_id, turn_id, seq, role, tool_name, is_error, text,
            content_json, meta_json, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
    )?;
    stmt.execute(params![
        message.id,
        session_id,
        turn_id,
        seq,
        message.role,
        message.tool_name,
        if message.is_error.unwrap_or(false) {
            1
        } else {
            0
        },
        text,
        content_json,
        meta_json,
        created_at,
    ])?;
    Ok(())
}

const SUMMARY_SELECT: &str = "SELECT s.id, s.title, p.path, s.model_id, s.provider_id, s.mode,
            s.thinking_level, s.updated_at, s.created_at
     FROM sessions s LEFT JOIN projects p ON p.id = s.project_id";

fn summary_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SessionSummary> {
    Ok(SessionSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        project_path: row.get(2)?,
        model_id: row.get(3)?,
        provider_id: row.get(4)?,
        mode: row.get(5)?,
        thinking_level: row.get(6)?,
        updated_at: ms_to_ts(row.get(7)?),
        created_at: ms_to_ts(row.get(8)?),
    })
}

// ---- sessions ---------------------------------------------------------------

fn first_user_title(db: &Database, session_id: &str) -> Result<Option<String>> {
    let mut stmt = db.conn().prepare_cached(
        "SELECT text FROM messages
         WHERE session_id = ?1 AND role = 'user' AND text IS NOT NULL
         ORDER BY seq ASC LIMIT 1",
    )?;
    let content: Option<String> = stmt
        .query_row(params![session_id], |row| row.get(0))
        .optional()?;
    Ok(content.and_then(|c| {
        let t = c.trim().replace('\n', " ");
        let t = t.split_whitespace().collect::<Vec<_>>().join(" ");
        if t.is_empty() {
            None
        } else {
            let mut out = t.chars().take(48).collect::<String>();
            if t.chars().count() > 48 {
                out.push('…');
            }
            Some(out)
        }
    }))
}

pub fn list_sessions(db: &Database) -> Result<Vec<SessionSummary>> {
    let sql = format!("{SUMMARY_SELECT} ORDER BY s.updated_at DESC");
    let mut stmt = db.conn().prepare_cached(&sql)?;
    let rows = stmt.query_map([], summary_from_row)?;
    let mut out = Vec::new();
    for row in rows {
        let mut session = row?;
        if is_default_title(&session.title) {
            if let Some(title) = first_user_title(db, &session.id)? {
                // Persist so Recents stays stable across restarts.
                let _ = rename_session(db, &session.id, &title);
                session.title = title;
            }
        }
        out.push(session);
    }
    Ok(out)
}

/// Backwards-compatible session constructor.  New callers that need an
/// explicit thinking level should use [`create_session_with_thinking`].
pub fn create_session(
    db: &Database,
    title: Option<String>,
    mode: Option<String>,
    provider_id: Option<String>,
    model_id: Option<String>,
    project_path: Option<String>,
) -> Result<SessionSummary> {
    create_session_with_thinking(db, title, mode, provider_id, model_id, project_path, None)
}

pub fn create_session_with_thinking(
    db: &Database,
    title: Option<String>,
    mode: Option<String>,
    provider_id: Option<String>,
    model_id: Option<String>,
    project_path: Option<String>,
    thinking_level: Option<String>,
) -> Result<SessionSummary> {
    let now = now_ms();
    let id = Uuid::new_v4().to_string();
    let title = title.unwrap_or_else(|| "New task".into());
    let mode = mode.unwrap_or_else(|| "agent".into());
    let thinking_level = thinking_level.unwrap_or_else(default_thinking_level);
    validate_thinking_level(&thinking_level)?;
    let project_id = match project_path
        .as_deref()
        .filter(|path| !path.trim().is_empty())
    {
        Some(path) => Some(db.ensure_project(path, false)?),
        None => None,
    };
    let project_path = match project_id {
        Some(id) => db.project_path(id)?,
        None => None,
    };
    db.conn()
        .prepare_cached(
            "INSERT INTO sessions (
                id, title, project_id, provider_id, model_id, mode, thinking_level,
                created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        )?
        .execute(params![
            id,
            title,
            project_id,
            provider_id,
            model_id,
            mode,
            thinking_level,
            now
        ])?;
    Ok(SessionSummary {
        id,
        title,
        project_path,
        model_id,
        provider_id,
        mode,
        thinking_level,
        updated_at: ms_to_ts(now),
        created_at: ms_to_ts(now),
    })
}

pub fn get_session(db: &Database, id: &str) -> Result<Option<SessionDetail>> {
    let sql = format!("{SUMMARY_SELECT} WHERE s.id = ?1");
    let summary = db
        .conn()
        .prepare_cached(&sql)?
        .query_row(params![id], summary_from_row)
        .optional()?;
    let Some(summary) = summary else {
        return Ok(None);
    };

    let mut stmt = db.conn().prepare_cached(
        "SELECT id, role, tool_name, is_error, text, content_json, meta_json, created_at
         FROM messages WHERE session_id = ?1 ORDER BY seq ASC",
    )?;
    let rows = stmt.query_map(params![id], |row| {
        Ok(MessageRow {
            id: row.get(0)?,
            role: row.get(1)?,
            tool_name: row.get(2)?,
            is_error: row.get(3)?,
            text: row.get(4)?,
            content_json: row.get(5)?,
            meta_json: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;
    let messages = rows
        .collect::<rusqlite::Result<Vec<_>>>()?
        .into_iter()
        .map(row_to_ui)
        .collect();
    Ok(Some(SessionDetail { summary, messages }))
}

/// Backwards-compatible configurator.  Omitting the thinking level preserves
/// the current persisted value.
pub fn configure_session(
    db: &Database,
    id: &str,
    mode: &str,
    provider_id: Option<&str>,
    model_id: Option<&str>,
) -> Result<Option<SessionSummary>> {
    configure_session_with_thinking(db, id, mode, provider_id, model_id, None)
}

pub fn configure_session_with_thinking(
    db: &Database,
    id: &str,
    mode: &str,
    provider_id: Option<&str>,
    model_id: Option<&str>,
    thinking_level: Option<&str>,
) -> Result<Option<SessionSummary>> {
    if !matches!(mode, "chat" | "agent") {
        return Err(anyhow!("mode must be chat or agent"));
    }
    if let Some(level) = thinking_level {
        validate_thinking_level(level)?;
    }
    let changed = db
        .conn()
        .prepare_cached(
            "UPDATE sessions
             SET mode = ?2, provider_id = ?3, model_id = ?4,
                 thinking_level = COALESCE(?5, thinking_level), updated_at = ?6
             WHERE id = ?1",
        )?
        .execute(params![
            id,
            mode,
            provider_id,
            model_id,
            thinking_level,
            now_ms()
        ])?;
    if changed == 0 {
        return Ok(None);
    }
    Ok(get_session(db, id)?.map(|detail| detail.summary))
}

pub fn delete_session(db: &Database, id: &str) -> Result<bool> {
    let n = db
        .conn()
        .prepare_cached("DELETE FROM sessions WHERE id = ?1")?
        .execute(params![id])?;
    Ok(n > 0)
}

pub fn rename_session(db: &Database, id: &str, title: &str) -> Result<bool> {
    let n = db
        .conn()
        .prepare_cached("UPDATE sessions SET title = ?1, updated_at = ?2 WHERE id = ?3")?
        .execute(params![title, now_ms(), id])?;
    Ok(n > 0)
}

pub fn append_message(
    db: &Database,
    session_id: &str,
    message: &UiMessage,
    turn_id: Option<&str>,
) -> Result<()> {
    let conn = db.conn();
    let tx = conn.unchecked_transaction()?;
    let now = now_ms();
    let seq: Option<i64> = tx
        .prepare_cached(
            "UPDATE sessions SET last_seq = last_seq + 1, updated_at = ?2
             WHERE id = ?1 RETURNING last_seq",
        )?
        .query_row(params![session_id, now], |r| r.get(0))
        .optional()?;
    let Some(seq) = seq else {
        return Err(anyhow!("session not found: {session_id}"));
    };
    insert_message(
        &tx,
        session_id,
        seq - 1,
        turn_id,
        message,
        ts_to_ms(&message.created_at),
    )?;
    tx.commit()?;
    Ok(())
}

pub fn replace_messages(db: &Database, session_id: &str, messages: &[UiMessage]) -> Result<()> {
    let conn = db.conn();
    let tx = conn.unchecked_transaction()?;
    tx.prepare_cached("DELETE FROM messages WHERE session_id = ?1")?
        .execute(params![session_id])?;
    for (seq, message) in messages.iter().enumerate() {
        insert_message(
            &tx,
            session_id,
            seq as i64,
            None,
            message,
            ts_to_ms(&message.created_at),
        )?;
    }
    tx.prepare_cached("UPDATE sessions SET last_seq = ?1, updated_at = ?2 WHERE id = ?3")?
        .execute(params![messages.len() as i64, now_ms(), session_id])?;
    tx.commit()?;
    Ok(())
}

/// Insert a session with caller-provided timestamps and messages in one
/// transaction. Idempotent: if a session with the same id already exists the
/// call is a no-op and returns false.
pub fn import_session(
    db: &Database,
    summary: &SessionSummary,
    messages: &[UiMessage],
) -> Result<bool> {
    validate_thinking_level(&summary.thinking_level)?;
    let conn = db.conn();
    let exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sessions WHERE id = ?1",
        params![summary.id],
        |row| row.get(0),
    )?;
    if exists > 0 {
        return Ok(false);
    }
    let tx = conn.unchecked_transaction()?;
    let project_id = match summary
        .project_path
        .as_deref()
        .filter(|path| !path.trim().is_empty())
    {
        Some(path) => Some(db.ensure_project(path, false)?),
        None => None,
    };
    let source = summary.id.strip_prefix("import-").map(|rest| {
        for known in ["claude-code", "opencode", "codex", "pi"] {
            if rest.starts_with(&format!("{known}-")) {
                return known.to_string();
            }
        }
        "external".to_string()
    });
    tx.prepare_cached(
        "INSERT INTO sessions (
            id, title, project_id, provider_id, model_id, mode, thinking_level, source,
            last_seq, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
    )?
    .execute(params![
        summary.id,
        summary.title,
        project_id,
        summary.provider_id,
        summary.model_id,
        summary.mode,
        summary.thinking_level,
        source,
        messages.len() as i64,
        ts_to_ms(&summary.created_at),
        ts_to_ms(&summary.updated_at),
    ])?;
    for (seq, message) in messages.iter().enumerate() {
        insert_message(
            &tx,
            &summary.id,
            seq as i64,
            None,
            message,
            ts_to_ms(&message.created_at),
        )?;
    }
    tx.commit()?;
    Ok(true)
}

pub fn session_count(db: &Database) -> Result<i64> {
    Ok(db
        .conn()
        .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))?)
}

// ---- turns ------------------------------------------------------------------

pub fn begin_turn(
    db: &Database,
    session_id: &str,
    provider_id: Option<&str>,
    model_id: Option<&str>,
) -> Result<String> {
    let id = Uuid::new_v4().to_string();
    db.conn()
        .prepare_cached(
            "INSERT INTO turns (id, session_id, provider_id, model_id, started_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )?
        .execute(params![id, session_id, provider_id, model_id, now_ms()])?;
    Ok(id)
}

pub fn end_turn(
    db: &Database,
    turn_id: &str,
    status: &str,
    error_code: Option<&str>,
    usage: Option<&Value>,
) -> Result<bool> {
    let status = match status {
        "completed" | "aborted" | "error" => status,
        _ => "completed",
    };
    let input_tokens = usage
        .and_then(|u| u.get("inputTokens"))
        .and_then(|v| v.as_i64());
    let output_tokens = usage
        .and_then(|u| u.get("outputTokens"))
        .and_then(|v| v.as_i64());
    let n = db
        .conn()
        .prepare_cached(
            "UPDATE turns SET status = ?1, error_code = ?2, ended_at = ?3,
                input_tokens = COALESCE(?4, input_tokens),
                output_tokens = COALESCE(?5, output_tokens),
                usage_json = COALESCE(?6, usage_json)
             WHERE id = ?7 AND status = 'running'",
        )?
        .execute(params![
            status,
            error_code,
            now_ms(),
            input_tokens,
            output_tokens,
            usage.map(|u| u.to_string()),
            turn_id,
        ])?;
    Ok(n > 0)
}

// ---- search -----------------------------------------------------------------

pub fn search_messages(db: &Database, query: &str, limit: i64) -> Result<Vec<SearchHit>> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let limit = limit.clamp(1, 100);
    // trigram FTS needs >= 3 chars; shorter queries fall back to LIKE.
    if query.chars().count() >= 3 {
        let quoted = format!("\"{}\"", query.replace('"', "\"\""));
        let mut stmt = db.conn().prepare_cached(
            "SELECT m.id, m.session_id, s.title, m.role, m.created_at,
                    snippet(messages_fts, 0, '', '', '…', 16)
             FROM messages_fts
             JOIN messages m ON m.mid = messages_fts.rowid
             JOIN sessions s ON s.id = m.session_id
             WHERE messages_fts MATCH ?1
             ORDER BY m.created_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![quoted, limit], |row| {
            Ok(SearchHit {
                message_id: row.get(0)?,
                session_id: row.get(1)?,
                session_title: row.get(2)?,
                role: row.get(3)?,
                created_at: ms_to_ts(row.get(4)?),
                snippet: row.get(5)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    } else {
        let escaped = query
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_");
        let mut stmt = db.conn().prepare_cached(
            "SELECT m.id, m.session_id, s.title, m.role, m.created_at,
                    substr(m.text, 1, 160)
             FROM messages m
             JOIN sessions s ON s.id = m.session_id
             WHERE m.text LIKE '%' || ?1 || '%' ESCAPE '\\'
             ORDER BY m.created_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![escaped, limit], |row| {
            Ok(SearchHit {
                message_id: row.get(0)?,
                session_id: row.get(1)?,
                session_title: row.get(2)?,
                role: row.get(3)?,
                created_at: ms_to_ts(row.get(4)?),
                snippet: row.get(5)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Database {
        let dir = std::env::temp_dir().join(format!("pi-desktop-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        Database::open(&dir.join("test.sqlite")).unwrap()
    }

    fn user_msg(id: &str, content: &str, ts: &str) -> UiMessage {
        UiMessage {
            id: id.into(),
            role: "user".into(),
            content: content.into(),
            created_at: ts.into(),
            thinking: None,
            status: None,
            tool_name: None,
            tool_call_id: None,
            tool_status: None,
            tool_args: None,
            tool_result: None,
            tool_completed_at: None,
            tool_duration_ms: None,
            is_error: None,
        }
    }

    #[test]
    fn configure_session_persists_pi_runtime_selection() {
        let db = test_db();
        let session = create_session(&db, None, None, None, None, Some("/tmp/x".into())).unwrap();
        db.conn()
            .execute(
                "INSERT INTO providers (
                    id, name, vendor_key, type, protocol, enabled, base_url,
                    auth_kind, secret_ref, api_style, default_model_id,
                    created_at, updated_at
                 ) VALUES (
                    'provider-1', 'Provider', 'custom', 'openai_compatible',
                    'openai_compatible', 1, NULL, 'none', NULL,
                    'chat_completions', 'model-1', 1, 1
                 )",
                [],
            )
            .unwrap();

        let configured = configure_session_with_thinking(
            &db,
            &session.id,
            "chat",
            Some("provider-1"),
            Some("model-1"),
            Some("high"),
        )
        .unwrap()
        .unwrap();

        assert_eq!(configured.mode, "chat");
        assert_eq!(configured.provider_id.as_deref(), Some("provider-1"));
        assert_eq!(configured.model_id.as_deref(), Some("model-1"));
        assert_eq!(configured.thinking_level, "high");
        // Omitting the new field is backwards-compatible and preserves the
        // configured value rather than resetting it to off.
        let preserved = configure_session(&db, &session.id, "chat", None, None)
            .unwrap()
            .unwrap();
        assert_eq!(preserved.thinking_level, "high");
        assert!(configure_session(&db, &session.id, "invalid", None, None).is_err());
        assert!(configure_session_with_thinking(
            &db,
            &session.id,
            "chat",
            None,
            None,
            Some("turbo")
        )
        .is_err());
    }

    #[test]
    fn create_session_returns_canonical_project_path() {
        let dir = tempfile::tempdir().unwrap();
        let project = dir.path().join("project");
        std::fs::create_dir_all(&project).unwrap();
        let db = Database::open(&dir.path().join("test.sqlite")).unwrap();
        let spelling_with_trailing_slash = format!("{}/", project.display());

        let session = create_session(
            &db,
            None,
            None,
            None,
            None,
            Some(spelling_with_trailing_slash),
        )
        .unwrap();

        let canonical = project
            .canonicalize()
            .unwrap()
            .to_string_lossy()
            .to_string();
        assert_eq!(session.project_path.as_deref(), Some(canonical.as_str()));
        assert_eq!(
            get_session(&db, &session.id)
                .unwrap()
                .unwrap()
                .summary
                .project_path
                .as_deref(),
            Some(canonical.as_str())
        );
    }

    #[test]
    fn import_session_is_idempotent_and_preserves_timestamps() {
        let db = test_db();
        let summary = SessionSummary {
            id: "import-claude-code-abc".into(),
            title: "Imported".into(),
            project_path: Some("/tmp/proj".into()),
            model_id: None,
            provider_id: None,
            mode: "agent".into(),
            thinking_level: "off".into(),
            created_at: "2025-01-01T00:00:00Z".into(),
            updated_at: "2025-01-02T00:00:00Z".into(),
        };
        let messages = vec![user_msg("m1", "hello", "2025-01-01T00:00:01Z")];

        assert!(import_session(&db, &summary, &messages).unwrap());
        // Re-import of the same id is skipped.
        assert!(!import_session(&db, &summary, &messages).unwrap());

        let detail = get_session(&db, &summary.id).unwrap().unwrap();
        // Timestamps are stored as ms and re-emitted as RFC3339: compare instants.
        assert_eq!(
            ts_to_ms(&detail.summary.created_at),
            ts_to_ms("2025-01-01T00:00:00Z")
        );
        assert_eq!(
            ts_to_ms(&detail.summary.updated_at),
            ts_to_ms("2025-01-02T00:00:00Z")
        );
        assert_eq!(detail.summary.project_path.as_deref(), Some("/tmp/proj"));
        assert_eq!(detail.messages.len(), 1);
        assert_eq!(detail.messages[0].content, "hello");
        let projects = db.list_projects().unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].path, "/tmp/proj");

        let source: Option<String> = db
            .conn()
            .query_row(
                "SELECT source FROM sessions WHERE id = ?1",
                params![summary.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(source.as_deref(), Some("claude-code"));
    }

    #[test]
    fn import_materializes_unique_projects_but_keeps_pathless_sessions_temporary() {
        let db = test_db();
        let base = SessionSummary {
            id: "import-codex-one".into(),
            title: "Imported".into(),
            project_path: Some("/tmp/project/".into()),
            model_id: None,
            provider_id: None,
            mode: "agent".into(),
            thinking_level: "off".into(),
            created_at: "2025-01-01T00:00:00Z".into(),
            updated_at: "2025-01-01T00:00:00Z".into(),
        };
        assert!(import_session(&db, &base, &[]).unwrap());

        let mut same_project = base.clone();
        same_project.id = "import-codex-two".into();
        same_project.project_path = Some("/tmp/project".into());
        assert!(import_session(&db, &same_project, &[]).unwrap());

        let mut temporary = base.clone();
        temporary.id = "import-codex-temporary".into();
        temporary.project_path = Some("   ".into());
        assert!(import_session(&db, &temporary, &[]).unwrap());

        let projects = db.list_projects().unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].path, "/tmp/project");
        assert_eq!(
            get_session(&db, &temporary.id)
                .unwrap()
                .unwrap()
                .summary
                .project_path,
            None
        );
    }

    #[test]
    fn append_and_roundtrip_tool_message() {
        let db = test_db();
        let session = create_session(&db, None, None, None, None, Some("/tmp/x".into())).unwrap();
        append_message(
            &db,
            &session.id,
            &user_msg("m1", "写一个文件", "2025-05-01T00:00:00Z"),
            None,
        )
        .unwrap();
        let tool = UiMessage {
            id: "m2".into(),
            role: "tool".into(),
            content: "ok".into(),
            created_at: "2025-05-01T00:00:02Z".into(),
            thinking: None,
            status: Some("complete".into()),
            tool_name: Some("Write".into()),
            tool_call_id: Some("c1".into()),
            tool_status: Some("success".into()),
            tool_args: Some(json!({ "path": "a.txt" })),
            tool_result: Some(json!({ "ok": true })),
            tool_completed_at: Some("2025-05-01T00:00:03Z".into()),
            tool_duration_ms: Some(1_000),
            is_error: None,
        };
        append_message(&db, &session.id, &tool, None).unwrap();

        let detail = get_session(&db, &session.id).unwrap().unwrap();
        assert_eq!(detail.messages.len(), 2);
        let m2 = &detail.messages[1];
        assert_eq!(m2.role, "tool");
        assert_eq!(m2.tool_name.as_deref(), Some("Write"));
        assert_eq!(m2.tool_call_id.as_deref(), Some("c1"));
        assert_eq!(m2.tool_status.as_deref(), Some("success"));
        assert_eq!(m2.tool_args, Some(json!({ "path": "a.txt" })));
        assert_eq!(m2.tool_result, Some(json!({ "ok": true })));
        assert_eq!(
            m2.tool_completed_at.as_deref(),
            Some("2025-05-01T00:00:03Z")
        );
        assert_eq!(m2.tool_duration_ms, Some(1_000));
        assert_eq!(m2.content, "ok");
        assert_eq!(m2.status.as_deref(), Some("complete"));

        // seq allocation is monotonic per session.
        let last_seq: i64 = db
            .conn()
            .query_row(
                "SELECT last_seq FROM sessions WHERE id = ?1",
                params![session.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(last_seq, 2);
    }

    #[test]
    fn assistant_thinking_roundtrips_as_canonical_blocks() {
        let db = test_db();
        let session = create_session(&db, None, None, None, None, None).unwrap();
        let assistant = UiMessage {
            id: "assistant-1".into(),
            role: "assistant".into(),
            content: "final answer".into(),
            created_at: "2025-05-01T00:00:01Z".into(),
            thinking: Some("first plan\nsecond plan".into()),
            status: Some("complete".into()),
            tool_name: None,
            tool_call_id: None,
            tool_status: None,
            tool_args: None,
            tool_result: None,
            tool_completed_at: None,
            tool_duration_ms: None,
            is_error: None,
        };
        append_message(&db, &session.id, &assistant, None).unwrap();

        let content_json: String = db
            .conn()
            .query_row(
                "SELECT content_json FROM messages WHERE id = 'assistant-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let blocks: Value = serde_json::from_str(&content_json).unwrap();
        assert_eq!(
            blocks[0],
            json!({
                "type": "thinking",
                "text": "first plan\nsecond plan"
            })
        );
        assert_eq!(
            blocks[1],
            json!({
                "type": "text",
                "text": "final answer"
            })
        );

        let detail = get_session(&db, &session.id).unwrap().unwrap();
        assert_eq!(
            detail.messages[0].thinking.as_deref(),
            Some("first plan\nsecond plan")
        );
        assert_eq!(detail.messages[0].content, "final answer");
    }

    #[test]
    fn import_and_replace_preserve_thinking() {
        let db = test_db();
        let summary = SessionSummary {
            id: "thinking-import".into(),
            title: "Thinking".into(),
            project_path: None,
            model_id: None,
            provider_id: None,
            mode: "agent".into(),
            thinking_level: "medium".into(),
            created_at: "2025-01-01T00:00:00Z".into(),
            updated_at: "2025-01-01T00:00:00Z".into(),
        };
        let mut message = user_msg("m1", "prompt", "2025-01-01T00:00:01Z");
        message.role = "assistant".into();
        message.thinking = Some("persist me".into());
        assert!(import_session(&db, &summary, &[message.clone()]).unwrap());
        let detail = get_session(&db, &summary.id).unwrap().unwrap();
        assert_eq!(detail.summary.thinking_level, "medium");
        assert_eq!(detail.messages[0].thinking.as_deref(), Some("persist me"));

        let session = create_session(&db, None, None, None, None, None).unwrap();
        message.id = "m2".into();
        replace_messages(&db, &session.id, &[message]).unwrap();
        let detail = get_session(&db, &session.id).unwrap().unwrap();
        assert_eq!(detail.messages[0].thinking.as_deref(), Some("persist me"));
    }

    #[test]
    fn replace_messages_resets_stream() {
        let db = test_db();
        let session = create_session(&db, None, None, None, None, None).unwrap();
        append_message(
            &db,
            &session.id,
            &user_msg("a", "one", "2025-05-01T00:00:00Z"),
            None,
        )
        .unwrap();
        append_message(
            &db,
            &session.id,
            &user_msg("b", "two", "2025-05-01T00:00:01Z"),
            None,
        )
        .unwrap();
        replace_messages(
            &db,
            &session.id,
            &[user_msg("c", "compacted", "2025-05-01T00:00:02Z")],
        )
        .unwrap();
        let detail = get_session(&db, &session.id).unwrap().unwrap();
        assert_eq!(detail.messages.len(), 1);
        assert_eq!(detail.messages[0].content, "compacted");
        // Appending after replace continues from the new stream head.
        append_message(
            &db,
            &session.id,
            &user_msg("d", "next", "2025-05-01T00:00:03Z"),
            None,
        )
        .unwrap();
        let detail = get_session(&db, &session.id).unwrap().unwrap();
        assert_eq!(detail.messages.len(), 2);
        assert_eq!(detail.messages[1].content, "next");
    }

    #[test]
    fn turns_lifecycle() {
        let db = test_db();
        let session = create_session(&db, None, None, None, None, None).unwrap();
        let turn = begin_turn(&db, &session.id, Some("p1"), Some("m1")).unwrap();
        assert!(end_turn(
            &db,
            &turn,
            "completed",
            None,
            Some(&json!({ "inputTokens": 10, "outputTokens": 20 }))
        )
        .unwrap());
        // Ending twice is a no-op.
        assert!(!end_turn(&db, &turn, "completed", None, None).unwrap());
        let (status, input, output): (String, i64, i64) = db
            .conn()
            .query_row(
                "SELECT status, input_tokens, output_tokens FROM turns WHERE id = ?1",
                params![turn],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(status, "completed");
        assert_eq!((input, output), (10, 20));
    }

    #[test]
    fn search_finds_cjk_and_short_queries() {
        let db = test_db();
        let session = create_session(&db, Some("重构".into()), None, None, None, None).unwrap();
        append_message(
            &db,
            &session.id,
            &user_msg("m1", "帮我重构数据库结构", "2025-05-01T00:00:00Z"),
            None,
        )
        .unwrap();
        let hits = search_messages(&db, "数据库", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].session_id, session.id);
        // 2-char query falls back to LIKE.
        let hits = search_messages(&db, "重构", 10).unwrap();
        assert_eq!(hits.len(), 1);
        // Deleting the session clears the index (cascade + FTS trigger).
        delete_session(&db, &session.id).unwrap();
        assert!(search_messages(&db, "数据库", 10).unwrap().is_empty());
    }
}
