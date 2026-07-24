use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use serde_json::Value;
use std::path::Path;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path).context("open sqlite")?;
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS meta (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS providers (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              vendor_key TEXT NOT NULL,
              type TEXT NOT NULL,
              protocol TEXT NOT NULL,
              enabled INTEGER NOT NULL DEFAULT 1,
              base_url TEXT,
              auth_kind TEXT NOT NULL,
              secret_ref TEXT,
              headers_json TEXT NOT NULL DEFAULT '{}',
              api_style TEXT,
              compatibility_json TEXT NOT NULL DEFAULT '{}',
              default_model_id TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS provider_models (
              provider_id TEXT NOT NULL,
              model_id TEXT NOT NULL,
              display_name TEXT NOT NULL,
              context_window INTEGER,
              max_output_tokens INTEGER,
              capabilities_json TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              PRIMARY KEY (provider_id, model_id),
              FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS sessions (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              project_path TEXT,
              model_id TEXT,
              provider_id TEXT,
              mode TEXT NOT NULL DEFAULT 'agent',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              session_id TEXT NOT NULL,
              role TEXT NOT NULL,
              content TEXT NOT NULL,
              status TEXT,
              tool_name TEXT,
              tool_call_id TEXT,
              tool_status TEXT,
              tool_args_json TEXT,
              tool_result_json TEXT,
              is_error INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              sort_index INTEGER NOT NULL,
              FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS secrets_meta (
              secret_ref TEXT PRIMARY KEY,
              provider_id TEXT,
              kind TEXT NOT NULL,
              backend TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS plugins (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              version TEXT NOT NULL,
              enabled INTEGER NOT NULL DEFAULT 1,
              source TEXT NOT NULL,
              path TEXT NOT NULL,
              status TEXT NOT NULL,
              error_message TEXT,
              permissions_json TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_log (
              id TEXT PRIMARY KEY,
              ts TEXT NOT NULL,
              kind TEXT NOT NULL,
              session_id TEXT,
              payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS workspace (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              path TEXT,
              name TEXT
            );

            INSERT OR IGNORE INTO workspace (id, path, name) VALUES (1, NULL, NULL);
            INSERT OR IGNORE INTO meta (key, value) VALUES ('schemaVersion', '1');
            "#,
        )?;
        Ok(Self { conn })
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    pub fn conn_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<Value>> {
        let mut stmt = self
            .conn
            .prepare("SELECT value_json FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            let raw: String = row.get(0)?;
            Ok(Some(serde_json::from_str(&raw)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &Value) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value_json) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
            params![key, value.to_string()],
        )?;
        Ok(())
    }
}
