use anyhow::Result;
use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::db::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub title: String,
    pub project_path: Option<String>,
    pub model_id: Option<String>,
    pub provider_id: Option<String>,
    pub mode: String,
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
    pub is_error: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDetail {
    #[serde(flatten)]
    pub summary: SessionSummary,
    pub messages: Vec<UiMessage>,
}

fn is_default_title(title: &str) -> bool {
    matches!(
        title.trim(),
        "" | "New task" | "New chat" | "新建任务" | "新对话"
    )
}

fn first_user_title(db: &Database, session_id: &str) -> Result<Option<String>> {
    let mut stmt = db.conn().prepare(
        "SELECT content FROM messages
         WHERE session_id = ?1 AND role = 'user'
         ORDER BY sort_index ASC, created_at ASC
         LIMIT 1",
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
    let mut stmt = db.conn().prepare(
        "SELECT id, title, project_path, model_id, provider_id, mode, updated_at, created_at
         FROM sessions ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(SessionSummary {
            id: row.get(0)?,
            title: row.get(1)?,
            project_path: row.get(2)?,
            model_id: row.get(3)?,
            provider_id: row.get(4)?,
            mode: row.get(5)?,
            updated_at: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows.filter_map(|r| r.ok()) {
        let mut session = row;
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

pub fn create_session(
    db: &Database,
    title: Option<String>,
    mode: Option<String>,
    provider_id: Option<String>,
    model_id: Option<String>,
    project_path: Option<String>,
) -> Result<SessionSummary> {
    let now = Utc::now().to_rfc3339();
    let session = SessionSummary {
        id: Uuid::new_v4().to_string(),
        title: title.unwrap_or_else(|| "New task".into()),
        project_path,
        model_id,
        provider_id,
        mode: mode.unwrap_or_else(|| "agent".into()),
        updated_at: now.clone(),
        created_at: now,
    };
    db.conn().execute(
        "INSERT INTO sessions (id, title, project_path, model_id, provider_id, mode, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            session.id,
            session.title,
            session.project_path,
            session.model_id,
            session.provider_id,
            session.mode,
            session.created_at,
            session.updated_at
        ],
    )?;
    Ok(session)
}

pub fn get_session(db: &Database, id: &str) -> Result<Option<SessionDetail>> {
    let summary = db
        .conn()
        .query_row(
            "SELECT id, title, project_path, model_id, provider_id, mode, updated_at, created_at
             FROM sessions WHERE id = ?1",
            params![id],
            |row| {
                Ok(SessionSummary {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    project_path: row.get(2)?,
                    model_id: row.get(3)?,
                    provider_id: row.get(4)?,
                    mode: row.get(5)?,
                    updated_at: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .optional()?;

    let Some(summary) = summary else {
        return Ok(None);
    };

    let mut stmt = db.conn().prepare(
        "SELECT id, role, content, created_at, status, tool_name, tool_call_id, tool_status,
                tool_args_json, tool_result_json, is_error
         FROM messages WHERE session_id = ?1 ORDER BY sort_index ASC, created_at ASC",
    )?;
    let rows = stmt.query_map(params![id], |row| {
        let tool_args_json: Option<String> = row.get(8)?;
        let tool_result_json: Option<String> = row.get(9)?;
        let is_error: i64 = row.get(10)?;
        Ok(UiMessage {
            id: row.get(0)?,
            role: row.get(1)?,
            content: row.get(2)?,
            created_at: row.get(3)?,
            status: row.get(4)?,
            tool_name: row.get(5)?,
            tool_call_id: row.get(6)?,
            tool_status: row.get(7)?,
            tool_args: tool_args_json.and_then(|s| serde_json::from_str(&s).ok()),
            tool_result: tool_result_json.and_then(|s| serde_json::from_str(&s).ok()),
            is_error: if is_error != 0 { Some(true) } else { None },
        })
    })?;
    let messages = rows.filter_map(|r| r.ok()).collect();
    Ok(Some(SessionDetail { summary, messages }))
}

pub fn delete_session(db: &Database, id: &str) -> Result<bool> {
    let n = db
        .conn()
        .execute("DELETE FROM sessions WHERE id = ?1", params![id])?;
    Ok(n > 0)
}

pub fn rename_session(db: &Database, id: &str, title: &str) -> Result<bool> {
    let now = Utc::now().to_rfc3339();
    let n = db.conn().execute(
        "UPDATE sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, now, id],
    )?;
    Ok(n > 0)
}

pub fn append_message(db: &Database, session_id: &str, message: &UiMessage) -> Result<()> {
    let sort_index: i64 = db.conn().query_row(
        "SELECT COALESCE(MAX(sort_index), -1) + 1 FROM messages WHERE session_id = ?1",
        params![session_id],
        |row| row.get(0),
    )?;
    db.conn().execute(
        "INSERT INTO messages (
            id, session_id, role, content, status, tool_name, tool_call_id, tool_status,
            tool_args_json, tool_result_json, is_error, created_at, sort_index
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            message.id,
            session_id,
            message.role,
            message.content,
            message.status,
            message.tool_name,
            message.tool_call_id,
            message.tool_status,
            message.tool_args.as_ref().map(|v| v.to_string()),
            message.tool_result.as_ref().map(|v| v.to_string()),
            if message.is_error.unwrap_or(false) {
                1
            } else {
                0
            },
            message.created_at,
            sort_index
        ],
    )?;
    let now = Utc::now().to_rfc3339();
    db.conn().execute(
        "UPDATE sessions SET updated_at = ?1 WHERE id = ?2",
        params![now, session_id],
    )?;
    Ok(())
}

pub fn replace_messages(db: &Database, session_id: &str, messages: &[UiMessage]) -> Result<()> {
    db.conn().execute(
        "DELETE FROM messages WHERE session_id = ?1",
        params![session_id],
    )?;
    for message in messages {
        append_message(db, session_id, message)?;
    }
    Ok(())
}

pub fn session_count(db: &Database) -> Result<i64> {
    Ok(db
        .conn()
        .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))?)
}
