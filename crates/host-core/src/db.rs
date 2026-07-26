use anyhow::{anyhow, Context, Result};
use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::Value;
use std::path::Path;

/// Storage schema v4 (docs/spec/03-runtime/04-data-storage.md).
///
/// v3 added per-session thinking levels.  v4 adds durable regenerate history
/// so discarded assistant/tool tails can be browsed like ChatGPT variants.
pub const SCHEMA_VERSION: i64 = 4;

/// Audit rows older than this are pruned at boot.
const AUDIT_RETENTION_MS: i64 = 90 * 24 * 3600 * 1000;
/// task_runs kept per task after the boot prune.
const TASK_RUNS_KEEP: i64 = 100;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecord {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub pinned: bool,
    pub created_at: i64,
    pub last_opened_at: i64,
}

fn normalize_project_path(path: &str) -> Option<String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return None;
    }
    let mut normalized = trimmed.replace('\\', "/");
    while normalized.len() > 1
        && normalized.ends_with('/')
        && !normalized
            .strip_suffix('/')
            .is_some_and(|prefix| prefix.ends_with(':'))
    {
        normalized.pop();
    }
    Some(normalized)
}

/// Canonical storage spelling of a project path: resolve symlinks when the
/// directory exists (matching `WorkspaceState::set`), then normalize
/// separators/trailing slashes.
fn canonical_project_path(path: &str) -> Option<String> {
    let canonical = std::path::Path::new(path)
        .canonicalize()
        .ok()
        .map(|p| p.to_string_lossy().to_string());
    normalize_project_path(canonical.as_deref().unwrap_or(path))
}

fn project_display_name(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("workspace")
        .to_string()
}

/// Upsert a projects row by raw path on any connection (used by live code and
/// the v1 migration alike). Returns None for blank paths.
fn upsert_project_row(conn: &Connection, raw: &str, touch: bool) -> Result<Option<i64>> {
    let Some(path) = canonical_project_path(raw) else {
        return Ok(None);
    };
    let name = project_display_name(&path);
    let now = now_ms();
    let mut stmt = conn.prepare_cached(
        "INSERT INTO projects (path, name, created_at, last_opened_at)
         VALUES (?1, ?2, ?3, ?3)
         ON CONFLICT(path) DO UPDATE SET
           last_opened_at = CASE WHEN ?4 THEN excluded.last_opened_at
                                 ELSE projects.last_opened_at END
         RETURNING id",
    )?;
    let id: i64 = stmt.query_row(params![path, name, now, touch], |r| r.get(0))?;
    Ok(Some(id))
}

const SCHEMA_LATEST: &str = r#"
CREATE TABLE kv (
  ns         TEXT NOT NULL,
  key        TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (ns, key)
) WITHOUT ROWID;

CREATE TABLE projects (
  id             INTEGER PRIMARY KEY,
  path           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  pinned         INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  last_opened_at INTEGER NOT NULL
);

CREATE TABLE providers (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  vendor_key       TEXT NOT NULL DEFAULT 'custom',
  type             TEXT NOT NULL DEFAULT 'openai_compatible',
  protocol         TEXT NOT NULL DEFAULT 'openai_compatible',
  api_style        TEXT,
  auth_kind        TEXT NOT NULL DEFAULT 'api_key_and_base_url',
  base_url         TEXT,
  enabled          INTEGER NOT NULL DEFAULT 1,
  secret_ref       TEXT,
  default_model_id TEXT,
  config_json      TEXT NOT NULL DEFAULT '{}',
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE models (
  provider_id       TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_id          TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  source            TEXT NOT NULL DEFAULT 'user',
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  context_window    INTEGER,
  max_output_tokens INTEGER,
  deprecated        INTEGER NOT NULL DEFAULT 0,
  updated_at        INTEGER NOT NULL,
  PRIMARY KEY (provider_id, model_id)
) WITHOUT ROWID;

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  provider_id TEXT,
  model_id    TEXT,
  mode        TEXT NOT NULL DEFAULT 'agent',
  thinking_level TEXT NOT NULL DEFAULT 'off'
                CHECK (thinking_level IN ('off', 'minimal', 'low', 'medium',
                                          'high', 'xhigh', 'max')),
  source      TEXT,
  pinned      INTEGER NOT NULL DEFAULT 0,
  last_seq    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);
CREATE INDEX idx_sessions_project ON sessions(project_id) WHERE project_id IS NOT NULL;

CREATE TABLE turns (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'running',
  provider_id   TEXT,
  model_id      TEXT,
  error_code    TEXT,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  usage_json    TEXT,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER
);
CREATE INDEX idx_turns_session ON turns(session_id, started_at DESC);

CREATE TABLE messages (
  mid          INTEGER PRIMARY KEY,
  id           TEXT NOT NULL UNIQUE,
  session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_id      TEXT REFERENCES turns(id) ON DELETE SET NULL,
  seq          INTEGER NOT NULL,
  role         TEXT NOT NULL,
  tool_name    TEXT,
  is_error     INTEGER NOT NULL DEFAULT 0,
  text         TEXT,
  content_json TEXT NOT NULL,
  meta_json    TEXT,
  created_at   INTEGER NOT NULL,
  UNIQUE (session_id, seq)
);

CREATE VIRTUAL TABLE messages_fts USING fts5(
  text,
  content='messages', content_rowid='mid',
  tokenize='trigram'
);
CREATE TRIGGER messages_ai AFTER INSERT ON messages WHEN new.text IS NOT NULL
  BEGIN INSERT INTO messages_fts(rowid, text) VALUES (new.mid, new.text); END;
CREATE TRIGGER messages_ad AFTER DELETE ON messages WHEN old.text IS NOT NULL
  BEGIN INSERT INTO messages_fts(messages_fts, rowid, text)
        VALUES ('delete', old.mid, old.text); END;
CREATE TRIGGER messages_au AFTER UPDATE OF text ON messages
  BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, text)
      SELECT 'delete', old.mid, old.text WHERE old.text IS NOT NULL;
    INSERT INTO messages_fts(rowid, text)
      SELECT new.mid, new.text WHERE new.text IS NOT NULL;
  END;

CREATE TABLE artifacts (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  op         TEXT NOT NULL,
  turn_id    TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, path)
) WITHOUT ROWID;
CREATE INDEX idx_artifacts_time ON artifacts(updated_at DESC);

CREATE TABLE message_revisions (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  root_user_id    TEXT NOT NULL,
  revision_index  INTEGER NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 0,
  messages_json   TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  UNIQUE (session_id, root_user_id, revision_index)
);
CREATE INDEX idx_message_revisions_root
  ON message_revisions(session_id, root_user_id, revision_index);

CREATE TABLE scheduled_tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  cadence     TEXT NOT NULL DEFAULT 'manual',
  enabled     INTEGER NOT NULL DEFAULT 1,
  project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  last_run_at INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE task_runs (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'running',
  error_code TEXT,
  started_at INTEGER NOT NULL,
  ended_at   INTEGER
);
CREATE INDEX idx_task_runs ON task_runs(task_id, started_at DESC);

CREATE TABLE secrets_meta (
  secret_ref TEXT PRIMARY KEY,
  owner_kind TEXT NOT NULL DEFAULT 'provider',
  owner_id   TEXT,
  kind       TEXT NOT NULL DEFAULT 'api_key',
  backend    TEXT NOT NULL,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE audit_log (
  id           INTEGER PRIMARY KEY,
  ts           INTEGER NOT NULL,
  kind         TEXT NOT NULL,
  session_id   TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_audit_ts ON audit_log(ts);
CREATE INDEX idx_audit_session ON audit_log(session_id, ts) WHERE session_id IS NOT NULL;
"#;

pub struct Database {
    conn: Connection,
}

pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// Parse an RFC3339 timestamp into epoch ms, falling back to `now`.
pub fn ts_to_ms(value: &str) -> i64 {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.timestamp_millis())
        .unwrap_or_else(|_| now_ms())
}

/// Epoch ms → RFC3339 (UTC, `Z` suffix) for the wire format.
pub fn ms_to_ts(ms: i64) -> String {
    chrono::DateTime::from_timestamp_millis(ms)
        .unwrap_or_else(chrono::Utc::now)
        .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

impl Database {
    /// Open (creating or migrating as needed) the app database inside
    /// `data_dir`: `pi.sqlite`, migrating a legacy v1 `settings.sqlite` once.
    pub fn open_in_dir(data_dir: &Path) -> Result<Self> {
        let v2_path = data_dir.join("pi.sqlite");
        let v1_path = data_dir.join("settings.sqlite");
        if !v2_path.exists() && v1_path.exists() {
            migrate_v1_file(&v1_path, &v2_path)
                .context("migrate legacy settings.sqlite to pi.sqlite")?;
        }
        Self::open(&v2_path)
    }

    /// Open a specific database file, bootstrapping the latest schema on a fresh
    /// file. Fails on files with an unknown newer schema.
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path).context("open sqlite")?;
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
            PRAGMA busy_timeout = 5000;
            PRAGMA temp_store = MEMORY;
            PRAGMA cache_size = -16000;
            PRAGMA trusted_schema = ON;
            "#,
        )?;
        let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        match version {
            0 => {
                let has_tables: i64 = conn.query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'",
                    [],
                    |r| r.get(0),
                )?;
                if has_tables > 0 {
                    return Err(anyhow!(
                        "database {} has tables but no schema version; refusing to touch it",
                        path.display()
                    ));
                }
                // auto_vacuum must be set before the first table exists.
                conn.execute_batch("PRAGMA auto_vacuum = INCREMENTAL;")?;
                let tx = conn.unchecked_transaction()?;
                tx.execute_batch(SCHEMA_LATEST)?;
                tx.pragma_update(None, "user_version", SCHEMA_VERSION)?;
                tx.commit()?;
            }
            2 => {
                // Keep additive migrations transactional so a crash cannot
                // leave a half-migrated database claiming a newer version.
                let tx = conn.unchecked_transaction()?;
                tx.execute_batch(
                    "ALTER TABLE sessions
                     ADD COLUMN thinking_level TEXT NOT NULL DEFAULT 'off'
                     CHECK (thinking_level IN
                       ('off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'));",
                )?;
                tx.pragma_update(None, "user_version", 3)?;
                tx.commit()?;
                migrate_to_v4(&conn)?;
            }
            3 => {
                migrate_to_v4(&conn)?;
            }
            SCHEMA_VERSION => {}
            // Future migrations chain here (5, 6, …) once they exist.
            other => {
                return Err(anyhow!(
                    "database schema version {other} is newer than supported {SCHEMA_VERSION}"
                ));
            }
        }
        let db = Self { conn };
        db.boot_maintenance()?;
        Ok(db)
    }

    /// Crash recovery + retention, run once per process at open.
    fn boot_maintenance(&self) -> Result<()> {
        let now = now_ms();
        self.conn.execute(
            "UPDATE turns SET status = 'aborted', ended_at = ?1 WHERE status = 'running'",
            params![now],
        )?;
        self.conn.execute(
            "UPDATE task_runs SET status = 'aborted', ended_at = ?1 WHERE status = 'running'",
            params![now],
        )?;
        self.conn.execute(
            "DELETE FROM audit_log WHERE ts < ?1",
            params![now - AUDIT_RETENTION_MS],
        )?;
        self.conn.execute(
            "DELETE FROM task_runs WHERE id IN (
               SELECT id FROM (
                 SELECT id, ROW_NUMBER() OVER (
                   PARTITION BY task_id ORDER BY started_at DESC
                 ) AS rn FROM task_runs
               ) WHERE rn > ?1
             )",
            params![TASK_RUNS_KEEP],
        )?;
        let _ = self.conn.execute_batch("PRAGMA incremental_vacuum;");
        Ok(())
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    // ---- kv --------------------------------------------------------------

    pub fn kv_get(&self, ns: &str, key: &str) -> Result<Option<Value>> {
        let mut stmt = self
            .conn
            .prepare_cached("SELECT value_json FROM kv WHERE ns = ?1 AND key = ?2")?;
        let mut rows = stmt.query(params![ns, key])?;
        if let Some(row) = rows.next()? {
            let raw: String = row.get(0)?;
            Ok(Some(serde_json::from_str(&raw)?))
        } else {
            Ok(None)
        }
    }

    pub fn kv_set(&self, ns: &str, key: &str, value: &Value) -> Result<()> {
        let mut stmt = self.conn.prepare_cached(
            "INSERT INTO kv (ns, key, value_json, updated_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(ns, key) DO UPDATE SET
               value_json = excluded.value_json, updated_at = excluded.updated_at",
        )?;
        stmt.execute(params![ns, key, value.to_string(), now_ms()])?;
        Ok(())
    }

    pub fn kv_delete(&self, ns: &str, key: &str) -> Result<()> {
        let mut stmt = self
            .conn
            .prepare_cached("DELETE FROM kv WHERE ns = ?1 AND key = ?2")?;
        stmt.execute(params![ns, key])?;
        Ok(())
    }

    // ---- settings compatibility shims (kv ns='app') -----------------------

    pub fn get_setting(&self, key: &str) -> Result<Option<Value>> {
        self.kv_get("app", key)
    }

    pub fn set_setting(&self, key: &str, value: &Value) -> Result<()> {
        self.kv_set("app", key, value)
    }

    // ---- projects ----------------------------------------------------------

    /// Upsert a project row by path, returning its id. Also bumps
    /// last_opened_at when `touch` is set. The path is canonicalized when it
    /// exists on disk (matching `WorkspaceState::set`) so symlinked spellings
    /// of the same directory share one row.
    pub fn ensure_project(&self, path: &str, touch: bool) -> Result<i64> {
        upsert_project_row(&self.conn, path, touch)?
            .ok_or_else(|| anyhow!("project path must not be blank"))
    }

    pub fn project_path(&self, id: i64) -> Result<Option<String>> {
        let mut stmt = self
            .conn
            .prepare_cached("SELECT path FROM projects WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        Ok(rows.next()?.map(|r| r.get(0)).transpose()?)
    }

    pub fn list_projects(&self) -> Result<Vec<ProjectRecord>> {
        let mut stmt = self.conn.prepare_cached(
            "SELECT id, path, name, pinned, created_at, last_opened_at
             FROM projects
             ORDER BY pinned DESC, last_opened_at DESC, name COLLATE NOCASE",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ProjectRecord {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                pinned: row.get(3)?,
                created_at: row.get(4)?,
                last_opened_at: row.get(5)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }
}

// ---- additive schema migrations -----------------------------------------

fn migrate_to_v4(conn: &Connection) -> Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS message_revisions (
          id              TEXT PRIMARY KEY,
          session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          root_user_id    TEXT NOT NULL,
          revision_index  INTEGER NOT NULL,
          is_active       INTEGER NOT NULL DEFAULT 0,
          messages_json   TEXT NOT NULL,
          created_at      INTEGER NOT NULL,
          UNIQUE (session_id, root_user_id, revision_index)
        );
        CREATE INDEX IF NOT EXISTS idx_message_revisions_root
          ON message_revisions(session_id, root_user_id, revision_index);
        "#,
    )?;
    tx.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    tx.commit()?;
    Ok(())
}

// ---- legacy v1 → latest schema migration ------------------------------------

fn table_exists(conn: &Connection, name: &str) -> Result<bool> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        params![name],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

/// One-shot migration: build a fresh `pi.sqlite` from a legacy v1
/// `settings.sqlite`, then rename the old file to `settings.sqlite.v1.bak`.
/// On failure the partial destination file is removed and the v1 file stays
/// untouched.
fn migrate_v1_file(v1_path: &Path, v2_path: &Path) -> Result<()> {
    // Fold WAL content into the main file so the backup rename is complete.
    {
        let old = Connection::open(v1_path)?;
        let _ = old.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    }

    let result = (|| -> Result<()> {
        let old = Connection::open(v1_path)?;
        let new = Database::open(v2_path)?;
        let conn = new.conn();
        let tx = conn.unchecked_transaction()?;

        // settings → kv(app, *)
        if table_exists(&old, "settings")? {
            let mut stmt = old.prepare("SELECT key, value_json FROM settings")?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let key: String = row.get(0)?;
                let raw: String = row.get(1)?;
                tx.execute(
                    "INSERT OR REPLACE INTO kv (ns, key, value_json, updated_at)
                     VALUES ('app', ?1, ?2, ?3)",
                    params![key, raw, now_ms()],
                )?;
            }
        }

        // workspace singleton → projects + kv(app, currentProjectId)
        if table_exists(&old, "workspace")? {
            let path: Option<String> = old
                .query_row("SELECT path FROM workspace WHERE id = 1", [], |r| r.get(0))
                .unwrap_or(None);
            if let Some(path) = path.filter(|p| !p.is_empty()) {
                if let Some(pid) = upsert_project_row(&tx, &path, true)? {
                    tx.execute(
                        "INSERT OR REPLACE INTO kv (ns, key, value_json, updated_at)
                         VALUES ('app', 'currentProjectId', ?1, ?2)",
                        params![pid.to_string(), now_ms()],
                    )?;
                }
            }
        }

        // providers: headers_json + compatibility_json fold into config_json
        if table_exists(&old, "providers")? {
            let mut stmt = old.prepare(
                "SELECT id, name, vendor_key, type, protocol, enabled, base_url, auth_kind,
                        secret_ref, headers_json, api_style, compatibility_json,
                        default_model_id, created_at, updated_at
                 FROM providers",
            )?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let headers: String = row.get(9)?;
                let compat: String = row.get(11)?;
                let config = serde_json::json!({
                    "headers": serde_json::from_str::<Value>(&headers)
                        .unwrap_or_else(|_| serde_json::json!({})),
                    "compatibility": serde_json::from_str::<Value>(&compat)
                        .unwrap_or_else(|_| serde_json::json!({})),
                });
                let created: String = row.get(13)?;
                let updated: String = row.get(14)?;
                tx.execute(
                    "INSERT INTO providers (
                        id, name, vendor_key, type, protocol, enabled, base_url, auth_kind,
                        secret_ref, api_style, default_model_id, config_json,
                        created_at, updated_at
                     ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
                    params![
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, i64>(5)?,
                        row.get::<_, Option<String>>(6)?,
                        row.get::<_, String>(7)?,
                        row.get::<_, Option<String>>(8)?,
                        row.get::<_, Option<String>>(10)?,
                        row.get::<_, Option<String>>(12)?,
                        config.to_string(),
                        ts_to_ms(&created),
                        ts_to_ms(&updated),
                    ],
                )?;
            }
        }

        // provider_models → models (source = 'user')
        if table_exists(&old, "provider_models")? {
            let mut stmt = old.prepare(
                "SELECT provider_id, model_id, display_name, context_window,
                        max_output_tokens, capabilities_json, updated_at
                 FROM provider_models",
            )?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let updated: String = row.get(6)?;
                tx.execute(
                    "INSERT OR IGNORE INTO models (
                        provider_id, model_id, display_name, source,
                        capabilities_json, context_window, max_output_tokens, updated_at
                     ) VALUES (?1, ?2, ?3, 'user', ?4, ?5, ?6, ?7)",
                    params![
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, Option<i64>>(3)?,
                        row.get::<_, Option<i64>>(4)?,
                        ts_to_ms(&updated),
                    ],
                )?;
            }
        }

        // secrets_meta: provider_id generalizes to owner_kind/owner_id
        if table_exists(&old, "secrets_meta")? {
            let mut stmt = old.prepare(
                "SELECT secret_ref, provider_id, kind, backend, updated_at FROM secrets_meta",
            )?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let updated: String = row.get(4)?;
                tx.execute(
                    "INSERT OR REPLACE INTO secrets_meta
                        (secret_ref, owner_kind, owner_id, kind, backend, updated_at)
                     VALUES (?1, 'provider', ?2, ?3, ?4, ?5)",
                    params![
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        ts_to_ms(&updated),
                    ],
                )?;
            }
        }

        // sessions + messages
        if table_exists(&old, "sessions")? {
            let mut stmt = old.prepare(
                "SELECT id, title, project_path, model_id, provider_id, mode,
                        created_at, updated_at
                 FROM sessions",
            )?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let id: String = row.get(0)?;
                let project_path: Option<String> = row.get(2)?;
                let created: String = row.get(6)?;
                let updated: String = row.get(7)?;
                let project_id: Option<i64> = match project_path.as_deref() {
                    Some(p) if !p.is_empty() => upsert_project_row(&tx, p, false)?,
                    _ => None,
                };
                // `import-claude-code-x` came from the deterministic importer
                // id scheme; recover the source token (longest match first).
                let source = id.strip_prefix("import-").map(|rest| {
                    for known in ["claude-code", "opencode", "codex", "pi"] {
                        if rest.starts_with(&format!("{known}-")) {
                            return known.to_string();
                        }
                    }
                    "external".to_string()
                });
                tx.execute(
                    "INSERT INTO sessions (
                        id, title, project_id, provider_id, model_id, mode, source,
                        created_at, updated_at
                     ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
                    params![
                        id,
                        row.get::<_, String>(1)?,
                        project_id,
                        row.get::<_, Option<String>>(4)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, String>(5)?,
                        source,
                        ts_to_ms(&created),
                        ts_to_ms(&updated),
                    ],
                )?;
            }
        }

        if table_exists(&old, "messages")? {
            let mut stmt = old.prepare(
                "SELECT id, session_id, role, content, status, tool_name, tool_call_id,
                        tool_status, tool_args_json, tool_result_json, is_error,
                        created_at, sort_index
                 FROM messages ORDER BY session_id, sort_index ASC",
            )?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let role: String = row.get(2)?;
                let content: String = row.get(3)?;
                let status: Option<String> = row.get(4)?;
                let tool_name: Option<String> = row.get(5)?;
                let tool_call_id: Option<String> = row.get(6)?;
                let tool_status: Option<String> = row.get(7)?;
                let tool_args: Option<String> = row.get(8)?;
                let tool_result: Option<String> = row.get(9)?;
                let is_error: i64 = row.get(10)?;
                let created: String = row.get(11)?;
                let seq: i64 = row.get(12)?;

                let parse = |s: &Option<String>| -> Option<Value> {
                    s.as_ref().and_then(|raw| serde_json::from_str(raw).ok())
                };
                let (content_json, text) = if role == "tool" {
                    let mut block = serde_json::json!({ "type": "tool_call" });
                    let obj = block.as_object_mut().unwrap();
                    if let Some(v) = tool_call_id.clone() {
                        obj.insert("callId".into(), Value::String(v));
                    }
                    if let Some(v) = tool_name.clone() {
                        obj.insert("name".into(), Value::String(v));
                    }
                    if let Some(v) = parse(&tool_args) {
                        obj.insert("args".into(), v);
                    }
                    if let Some(v) = parse(&tool_result) {
                        obj.insert("result".into(), v);
                    }
                    if let Some(v) = tool_status.clone() {
                        obj.insert("status".into(), Value::String(v));
                    }
                    if is_error != 0 {
                        obj.insert("isError".into(), Value::Bool(true));
                    }
                    if !content.is_empty() {
                        obj.insert("text".into(), Value::String(content.clone()));
                    }
                    (Value::Array(vec![block]).to_string(), None::<String>)
                } else {
                    (
                        serde_json::json!([{ "type": "text", "text": content }]).to_string(),
                        Some(content),
                    )
                };
                let meta = status.map(|s| serde_json::json!({ "status": s }).to_string());
                tx.execute(
                    "INSERT INTO messages (
                        id, session_id, seq, role, tool_name, is_error, text,
                        content_json, meta_json, created_at
                     ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
                    params![
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        seq,
                        role,
                        tool_name,
                        is_error,
                        text,
                        content_json,
                        meta,
                        ts_to_ms(&created),
                    ],
                )?;
            }
            tx.execute_batch(
                "UPDATE sessions SET last_seq = COALESCE(
                   (SELECT MAX(seq) FROM messages WHERE messages.session_id = sessions.id), -1
                 ) + 1;",
            )?;
        }

        // audit_log: integer pk, ms timestamps
        if table_exists(&old, "audit_log")? {
            let mut stmt =
                old.prepare("SELECT ts, kind, session_id, payload_json FROM audit_log")?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let ts: String = row.get(0)?;
                tx.execute(
                    "INSERT INTO audit_log (ts, kind, session_id, payload_json)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![
                        ts_to_ms(&ts),
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, String>(3)?,
                    ],
                )?;
            }
        }

        tx.commit()?;
        Ok(())
    })();

    match result {
        Ok(()) => {
            let bak = v1_path.with_extension("sqlite.v1.bak");
            std::fs::rename(v1_path, &bak).with_context(|| {
                format!("backup rename {} -> {}", v1_path.display(), bak.display())
            })?;
            // Stale WAL/SHM siblings of the renamed file are harmless leftovers.
            for suffix in ["-wal", "-shm"] {
                let _ = std::fs::remove_file(format!("{}{suffix}", v1_path.display()));
            }
            Ok(())
        }
        Err(e) => {
            for suffix in ["", "-wal", "-shm"] {
                let _ = std::fs::remove_file(format!("{}{suffix}", v2_path.display()));
            }
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_open_creates_latest_schema() {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::open(&dir.path().join("pi.sqlite")).unwrap();
        let version: i64 = db
            .conn()
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
        for table in [
            "kv",
            "projects",
            "providers",
            "models",
            "sessions",
            "turns",
            "messages",
            "message_revisions",
            "artifacts",
            "scheduled_tasks",
            "task_runs",
            "secrets_meta",
            "audit_log",
        ] {
            assert!(table_exists(db.conn(), table).unwrap(), "missing {table}");
        }
        let thinking_column: (String, String) = db
            .conn()
            .query_row(
                "SELECT name, dflt_value
                 FROM pragma_table_info('sessions')
                 WHERE name = 'thinking_level'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(thinking_column, ("thinking_level".into(), "'off'".into()));
    }

    #[test]
    fn migrates_v2_sessions_to_v3_thinking_level() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("pi.sqlite");

        // Build a genuine v2 fixture from the current schema by removing only
        // the additive v3 column.  This keeps the migration test aligned with
        // all other v2 tables and triggers instead of relying on a toy schema.
        let v2_column = r#"  thinking_level TEXT NOT NULL DEFAULT 'off'
                CHECK (thinking_level IN ('off', 'minimal', 'low', 'medium',
                                          'high', 'xhigh', 'max')),
"#;
        let v4_table = r#"CREATE TABLE message_revisions (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  root_user_id    TEXT NOT NULL,
  revision_index  INTEGER NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 0,
  messages_json   TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  UNIQUE (session_id, root_user_id, revision_index)
);
CREATE INDEX idx_message_revisions_root
  ON message_revisions(session_id, root_user_id, revision_index);

"#;
        let schema_v2 = SCHEMA_LATEST.replace(v2_column, "").replace(v4_table, "");
        assert_ne!(schema_v2, SCHEMA_LATEST, "v2 fixture must omit thinking_level");
        assert!(!schema_v2.contains("message_revisions"));
        {
            let conn = Connection::open(&path).unwrap();
            conn.execute_batch(&schema_v2).unwrap();
            conn.pragma_update(None, "user_version", 2).unwrap();
            conn.execute(
                "INSERT INTO sessions
                    (id, title, mode, created_at, updated_at)
                 VALUES ('legacy', 'Legacy', 'chat', 1, 2)",
                [],
            )
            .unwrap();
        }

        let db = Database::open(&path).unwrap();
        let version: i64 = db
            .conn()
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
        let (level, title): (String, String) = db
            .conn()
            .query_row(
                "SELECT thinking_level, title FROM sessions WHERE id = 'legacy'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(level, "off");
        assert_eq!(title, "Legacy");

        // Reopening is a no-op and does not attempt to add the column again.
        drop(db);
        let db = Database::open(&path).unwrap();
        let count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('sessions')
                 WHERE name = 'thinking_level'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn migrates_v3_to_v4_message_revisions() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("pi.sqlite");

        let v4_table = r#"CREATE TABLE message_revisions (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  root_user_id    TEXT NOT NULL,
  revision_index  INTEGER NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 0,
  messages_json   TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  UNIQUE (session_id, root_user_id, revision_index)
);
CREATE INDEX idx_message_revisions_root
  ON message_revisions(session_id, root_user_id, revision_index);

"#;
        let schema_v3 = SCHEMA_LATEST.replace(v4_table, "");
        assert_ne!(schema_v3, SCHEMA_LATEST, "v3 fixture must omit message_revisions");
        {
            let conn = Connection::open(&path).unwrap();
            conn.execute_batch(&schema_v3).unwrap();
            conn.pragma_update(None, "user_version", 3).unwrap();
            conn.execute(
                "INSERT INTO sessions
                    (id, title, mode, thinking_level, created_at, updated_at)
                 VALUES ('legacy', 'Legacy', 'chat', 'off', 1, 2)",
                [],
            )
            .unwrap();
        }

        let db = Database::open(&path).unwrap();
        let version: i64 = db
            .conn()
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
        assert!(table_exists(db.conn(), "message_revisions").unwrap());

        // FK cascade: deleting the parent session clears revisions.
        db.conn()
            .execute(
                "INSERT INTO message_revisions
                    (id, session_id, root_user_id, revision_index, is_active, messages_json, created_at)
                 VALUES ('r1', 'legacy', 'u1', 1, 1, '[]', 3)",
                [],
            )
            .unwrap();
        db.conn()
            .execute("DELETE FROM sessions WHERE id = 'legacy'", [])
            .unwrap();
        let remaining: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM message_revisions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(remaining, 0);
    }

    fn kv_roundtrip_and_delete() {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::open(&dir.path().join("pi.sqlite")).unwrap();
        db.kv_set("plugin:demo", "cfg", &serde_json::json!({ "on": true }))
            .unwrap();
        assert_eq!(
            db.kv_get("plugin:demo", "cfg").unwrap().unwrap(),
            serde_json::json!({ "on": true })
        );
        db.kv_delete("plugin:demo", "cfg").unwrap();
        assert!(db.kv_get("plugin:demo", "cfg").unwrap().is_none());
    }

    #[test]
    fn ensure_project_upserts_by_path() {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::open(&dir.path().join("pi.sqlite")).unwrap();
        let a = db.ensure_project("/tmp/demo", true).unwrap();
        let b = db.ensure_project("/tmp/demo/", false).unwrap();
        assert_eq!(a, b);
        assert_eq!(db.project_path(a).unwrap().as_deref(), Some("/tmp/demo"));
        let projects = db.list_projects().unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].path, "/tmp/demo");
        assert_eq!(projects[0].name, "demo");

        let windows = db.ensure_project("C:\\work\\project\\", false).unwrap();
        assert_eq!(
            db.project_path(windows).unwrap().as_deref(),
            Some("C:/work/project")
        );
    }

    #[test]
    fn list_projects_propagates_row_decode_errors() {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::open(&dir.path().join("pi.sqlite")).unwrap();
        db.conn()
            .execute(
                "INSERT INTO projects
                    (path, name, pinned, created_at, last_opened_at)
                 VALUES ('/tmp/broken', 'broken', 'not-a-number', 1, 1)",
                [],
            )
            .unwrap();

        assert!(db.list_projects().is_err());
    }

    #[cfg(unix)]
    #[test]
    fn ensure_project_dedupes_symlinked_spellings() {
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real-project");
        std::fs::create_dir_all(&real).unwrap();
        let link = dir.path().join("link-project");
        std::os::unix::fs::symlink(&real, &link).unwrap();
        let db = Database::open(&dir.path().join("pi.sqlite")).unwrap();
        let a = db.ensure_project(&real.to_string_lossy(), true).unwrap();
        let b = db.ensure_project(&link.to_string_lossy(), true).unwrap();
        assert_eq!(a, b, "symlinked path spellings must share one project row");
        assert_eq!(db.list_projects().unwrap().len(), 1);
    }

    #[test]
    fn migrates_v1_file_and_leaves_backup() {
        let dir = tempfile::tempdir().unwrap();
        let v1 = dir.path().join("settings.sqlite");
        {
            let conn = Connection::open(&v1).unwrap();
            conn.execute_batch(
                r#"
                CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
                CREATE TABLE providers (
                  id TEXT PRIMARY KEY, name TEXT NOT NULL, vendor_key TEXT NOT NULL,
                  type TEXT NOT NULL, protocol TEXT NOT NULL,
                  enabled INTEGER NOT NULL DEFAULT 1, base_url TEXT,
                  auth_kind TEXT NOT NULL, secret_ref TEXT,
                  headers_json TEXT NOT NULL DEFAULT '{}', api_style TEXT,
                  compatibility_json TEXT NOT NULL DEFAULT '{}',
                  default_model_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE sessions (
                  id TEXT PRIMARY KEY, title TEXT NOT NULL, project_path TEXT,
                  model_id TEXT, provider_id TEXT, mode TEXT NOT NULL DEFAULT 'agent',
                  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE messages (
                  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, role TEXT NOT NULL,
                  content TEXT NOT NULL, status TEXT, tool_name TEXT, tool_call_id TEXT,
                  tool_status TEXT, tool_args_json TEXT, tool_result_json TEXT,
                  is_error INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
                  sort_index INTEGER NOT NULL
                );
                CREATE TABLE workspace (id INTEGER PRIMARY KEY CHECK (id = 1), path TEXT, name TEXT);
                INSERT INTO workspace (id, path, name) VALUES (1, '/tmp/proj', 'proj');
                INSERT INTO settings (key, value_json) VALUES ('app', '{"theme":"dark"}');
                INSERT INTO providers VALUES ('p1','Anthropic','anthropic','native','anthropic',
                  1,NULL,'api_key','secret/p1','{"x-a":"1"}',NULL,'{"json":true}','claude-x',
                  '2025-01-01T00:00:00Z','2025-01-01T00:00:00Z');
                INSERT INTO sessions VALUES ('import-claude-code-abc','Imported','/tmp/proj',
                  'claude-x','p1','agent','2025-01-01T00:00:00Z','2025-01-02T00:00:00Z');
                INSERT INTO messages (id, session_id, role, content, is_error, created_at, sort_index)
                  VALUES ('m1','import-claude-code-abc','user','你好世界 hello',0,'2025-01-01T00:00:01Z',0);
                INSERT INTO messages (id, session_id, role, content, tool_name, tool_call_id,
                  tool_status, tool_args_json, is_error, created_at, sort_index)
                  VALUES ('m2','import-claude-code-abc','tool','done','Write','c1','success',
                  '{"path":"a.txt"}',0,'2025-01-01T00:00:02Z',1);
                "#,
            )
            .unwrap();
        }

        let db = Database::open_in_dir(dir.path()).unwrap();
        assert!(dir.path().join("pi.sqlite").exists());
        assert!(dir.path().join("settings.sqlite.v1.bak").exists());
        assert!(!v1.exists());

        assert_eq!(
            db.kv_get("app", "app").unwrap().unwrap(),
            serde_json::json!({ "theme": "dark" })
        );
        let (source, last_seq, project_id): (Option<String>, i64, Option<i64>) = db
            .conn()
            .query_row(
                "SELECT source, last_seq, project_id FROM sessions WHERE id = 'import-claude-code-abc'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(source.as_deref(), Some("claude-code"));
        assert_eq!(last_seq, 2);
        let ppath = db.project_path(project_id.unwrap()).unwrap();
        assert_eq!(ppath.as_deref(), Some("/tmp/proj"));

        let config: String = db
            .conn()
            .query_row(
                "SELECT config_json FROM providers WHERE id = 'p1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let config: Value = serde_json::from_str(&config).unwrap();
        assert_eq!(config["headers"]["x-a"], "1");
        assert_eq!(config["compatibility"]["json"], true);

        // FTS picked up the migrated user message (CJK substring; trigram
        // needs >= 3 chars, shorter queries go through the LIKE fallback).
        let hits: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM messages_fts WHERE messages_fts MATCH '好世界'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(hits, 1);

        // Tool row became a tool_call block.
        let content: String = db
            .conn()
            .query_row(
                "SELECT content_json FROM messages WHERE id = 'm2'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let blocks: Value = serde_json::from_str(&content).unwrap();
        assert_eq!(blocks[0]["type"], "tool_call");
        assert_eq!(blocks[0]["name"], "Write");
        assert_eq!(blocks[0]["args"]["path"], "a.txt");

        // Migration is not re-run: reopening keeps data.
        drop(db);
        let db2 = Database::open_in_dir(dir.path()).unwrap();
        let n: i64 = db2
            .conn()
            .query_row("SELECT COUNT(*) FROM sessions", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1);
    }
}
