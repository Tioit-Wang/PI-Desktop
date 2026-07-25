use anyhow::Result;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::db::{ms_to_ts, now_ms, ts_to_ms, Database};

/// Wire format matches the legacy Electron `scheduled-tasks.json` records so
/// the renderer keeps working unchanged (camelCase, RFC3339 timestamps).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTask {
    pub id: String,
    pub title: String,
    pub prompt: String,
    pub cadence: String,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_run_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRun {
    pub id: String,
    pub task_id: String,
    pub session_id: Option<String>,
    pub status: String,
    pub error_code: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
}

const CADENCES: [&str; 4] = ["manual", "hourly", "daily", "weekly"];

fn normalize_cadence(value: Option<&str>) -> String {
    match value {
        Some(v) if CADENCES.contains(&v) => v.to_string(),
        _ => "manual".to_string(),
    }
}

fn task_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ScheduledTask> {
    Ok(ScheduledTask {
        id: row.get(0)?,
        title: row.get(1)?,
        prompt: row.get(2)?,
        cadence: row.get(3)?,
        enabled: row.get::<_, i64>(4)? != 0,
        created_at: ms_to_ts(row.get(5)?),
        updated_at: ms_to_ts(row.get(6)?),
        last_run_at: row.get::<_, Option<i64>>(7)?.map(ms_to_ts),
    })
}

const TASK_SELECT: &str =
    "SELECT id, title, prompt, cadence, enabled, created_at, updated_at, last_run_at
     FROM scheduled_tasks";

pub fn list_tasks(db: &Database) -> Result<Vec<ScheduledTask>> {
    let sql = format!("{TASK_SELECT} ORDER BY created_at DESC");
    let mut stmt = db.conn().prepare_cached(&sql)?;
    let rows = stmt.query_map([], task_from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn get_task(db: &Database, id: &str) -> Result<Option<ScheduledTask>> {
    let sql = format!("{TASK_SELECT} WHERE id = ?1");
    db.conn()
        .prepare_cached(&sql)?
        .query_row(params![id], task_from_row)
        .optional()
        .map_err(Into::into)
}

pub fn create_task(db: &Database, params_json: &Value) -> Result<ScheduledTask> {
    let prompt = params_json
        .get("prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let title: String = params_json
        .get("title")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(if prompt.is_empty() {
            "Scheduled task"
        } else {
            &prompt
        })
        .chars()
        .take(80)
        .collect();
    let cadence = normalize_cadence(params_json.get("cadence").and_then(|v| v.as_str()));
    let id = Uuid::new_v4().to_string();
    let now = now_ms();
    db.conn()
        .prepare_cached(
            "INSERT INTO scheduled_tasks (id, title, prompt, cadence, enabled, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 1, ?5, ?5)",
        )?
        .execute(params![id, title, prompt, cadence, now])?;
    Ok(get_task(db, &id)?.expect("task just inserted"))
}

pub fn update_task(db: &Database, params_json: &Value) -> Result<Option<ScheduledTask>> {
    let Some(id) = params_json.get("id").and_then(|v| v.as_str()) else {
        return Ok(None);
    };
    let cadence = params_json
        .get("cadence")
        .and_then(|v| v.as_str())
        .map(|c| normalize_cadence(Some(c)));
    let n = db
        .conn()
        .prepare_cached(
            "UPDATE scheduled_tasks SET
                title = COALESCE(?1, title),
                prompt = COALESCE(?2, prompt),
                cadence = COALESCE(?3, cadence),
                enabled = COALESCE(?4, enabled),
                updated_at = ?5
             WHERE id = ?6",
        )?
        .execute(params![
            params_json.get("title").and_then(|v| v.as_str()),
            params_json.get("prompt").and_then(|v| v.as_str()),
            cadence,
            params_json
                .get("enabled")
                .and_then(|v| v.as_bool())
                .map(|b| if b { 1 } else { 0 }),
            now_ms(),
            id
        ])?;
    if n == 0 {
        return Ok(None);
    }
    get_task(db, id)
}

pub fn delete_task(db: &Database, id: &str) -> Result<bool> {
    let n = db
        .conn()
        .prepare_cached("DELETE FROM scheduled_tasks WHERE id = ?1")?
        .execute(params![id])?;
    Ok(n > 0)
}

/// One-shot import from the legacy Electron JSON store. Existing ids are
/// left untouched, making re-imports a no-op. Returns the imported count.
pub fn import_tasks(db: &Database, tasks: &[Value]) -> Result<usize> {
    let conn = db.conn();
    let tx = conn.unchecked_transaction()?;
    let mut imported = 0;
    for task in tasks {
        let Some(id) = task.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        let Some(prompt) = task.get("prompt").and_then(|v| v.as_str()) else {
            continue;
        };
        let title = task
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Scheduled task");
        let cadence = normalize_cadence(task.get("cadence").and_then(|v| v.as_str()));
        let enabled = task
            .get("enabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);
        let created = task
            .get("createdAt")
            .and_then(|v| v.as_str())
            .map(ts_to_ms)
            .unwrap_or_else(now_ms);
        let updated = task
            .get("updatedAt")
            .and_then(|v| v.as_str())
            .map(ts_to_ms)
            .unwrap_or(created);
        let last_run = task.get("lastRunAt").and_then(|v| v.as_str()).map(ts_to_ms);
        let n = tx
            .prepare_cached(
                "INSERT OR IGNORE INTO scheduled_tasks
                    (id, title, prompt, cadence, enabled, last_run_at, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            )?
            .execute(params![
                id,
                title,
                prompt,
                cadence,
                if enabled { 1 } else { 0 },
                last_run,
                created,
                updated
            ])?;
        imported += n;
    }
    tx.commit()?;
    Ok(imported)
}

/// Record a run start: stamps the task's last_run_at and opens a task_runs row.
pub fn begin_run(db: &Database, task_id: &str, session_id: Option<&str>) -> Result<String> {
    let conn = db.conn();
    let tx = conn.unchecked_transaction()?;
    let now = now_ms();
    tx.prepare_cached(
        "UPDATE scheduled_tasks SET last_run_at = ?1, updated_at = ?1 WHERE id = ?2",
    )?
    .execute(params![now, task_id])?;
    let run_id = Uuid::new_v4().to_string();
    tx.prepare_cached(
        "INSERT INTO task_runs (id, task_id, session_id, started_at) VALUES (?1, ?2, ?3, ?4)",
    )?
    .execute(params![run_id, task_id, session_id, now])?;
    tx.commit()?;
    Ok(run_id)
}

pub fn finish_run(
    db: &Database,
    run_id: &str,
    status: &str,
    error_code: Option<&str>,
) -> Result<bool> {
    let status = match status {
        "completed" | "aborted" | "error" => status,
        _ => "completed",
    };
    let n = db
        .conn()
        .prepare_cached(
            "UPDATE task_runs SET status = ?1, error_code = ?2, ended_at = ?3
             WHERE id = ?4 AND status = 'running'",
        )?
        .execute(params![status, error_code, now_ms(), run_id])?;
    Ok(n > 0)
}

pub fn list_runs(db: &Database, task_id: Option<&str>, limit: i64) -> Result<Vec<TaskRun>> {
    let limit = limit.clamp(1, 200);
    let map_row = |row: &rusqlite::Row<'_>| -> rusqlite::Result<TaskRun> {
        Ok(TaskRun {
            id: row.get(0)?,
            task_id: row.get(1)?,
            session_id: row.get(2)?,
            status: row.get(3)?,
            error_code: row.get(4)?,
            started_at: ms_to_ts(row.get(5)?),
            ended_at: row.get::<_, Option<i64>>(6)?.map(ms_to_ts),
        })
    };
    let mut out = Vec::new();
    if let Some(task_id) = task_id {
        let mut stmt = db.conn().prepare_cached(
            "SELECT id, task_id, session_id, status, error_code, started_at, ended_at
             FROM task_runs WHERE task_id = ?1 ORDER BY started_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![task_id, limit], map_row)?;
        out.extend(rows.collect::<rusqlite::Result<Vec<_>>>()?);
    } else {
        let mut stmt = db.conn().prepare_cached(
            "SELECT id, task_id, session_id, status, error_code, started_at, ended_at
             FROM task_runs ORDER BY started_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], map_row)?;
        out.extend(rows.collect::<rusqlite::Result<Vec<_>>>()?);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_db() -> Database {
        let dir = std::env::temp_dir().join(format!("pi-desktop-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        Database::open(&dir.join("test.sqlite")).unwrap()
    }

    #[test]
    fn crud_and_run_lifecycle() {
        let db = test_db();
        let task = create_task(&db, &json!({ "prompt": "run tests", "cadence": "daily" })).unwrap();
        assert_eq!(task.cadence, "daily");
        assert!(task.enabled);
        assert_eq!(task.title, "run tests");

        let updated = update_task(&db, &json!({ "id": task.id, "enabled": false }))
            .unwrap()
            .unwrap();
        assert!(!updated.enabled);

        let run = begin_run(&db, &task.id, None).unwrap();
        assert!(finish_run(&db, &run, "completed", None).unwrap());
        assert!(!finish_run(&db, &run, "completed", None).unwrap());
        let runs = list_runs(&db, Some(&task.id), 10).unwrap();
        assert_eq!(runs.len(), 1);
        assert_eq!(runs[0].status, "completed");
        let after = get_task(&db, &task.id).unwrap().unwrap();
        assert!(after.last_run_at.is_some());

        assert!(delete_task(&db, &task.id).unwrap());
        assert!(list_runs(&db, Some(&task.id), 10).unwrap().is_empty());
    }

    #[test]
    fn import_is_idempotent_and_preserves_fields() {
        let db = test_db();
        let legacy = json!([{
            "id": "t1",
            "title": "Nightly",
            "prompt": "nightly check",
            "cadence": "daily",
            "enabled": false,
            "createdAt": "2025-06-01T00:00:00Z",
            "updatedAt": "2025-06-02T00:00:00Z",
            "lastRunAt": "2025-06-03T00:00:00Z"
        }]);
        let arr = legacy.as_array().unwrap().clone();
        assert_eq!(import_tasks(&db, &arr).unwrap(), 1);
        assert_eq!(import_tasks(&db, &arr).unwrap(), 0);
        let task = get_task(&db, "t1").unwrap().unwrap();
        assert_eq!(task.title, "Nightly");
        assert!(!task.enabled);
        assert_eq!(
            ts_to_ms(&task.last_run_at.unwrap()),
            ts_to_ms("2025-06-03T00:00:00Z")
        );
    }
}
