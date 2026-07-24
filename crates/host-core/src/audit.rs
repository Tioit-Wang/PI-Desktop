use anyhow::Result;
use chrono::Utc;
use rusqlite::params;
use serde_json::Value;
use uuid::Uuid;

use crate::db::Database;

pub fn append(db: &Database, kind: &str, session_id: Option<&str>, payload: Value) -> Result<()> {
    // Redact obvious secrets in payload serialization path (best-effort)
    let redacted = redact_value(payload);
    db.conn().execute(
        "INSERT INTO audit_log (id, ts, kind, session_id, payload_json) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            Uuid::new_v4().to_string(),
            Utc::now().to_rfc3339(),
            kind,
            session_id,
            redacted.to_string()
        ],
    )?;
    Ok(())
}

fn redact_value(value: Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut out = serde_json::Map::new();
            for (k, v) in map {
                let key_l = k.to_ascii_lowercase();
                if key_l.contains("secret")
                    || key_l.contains("api_key")
                    || key_l.contains("apikey")
                    || key_l.contains("authorization")
                    || key_l.contains("token")
                    || key_l.contains("password")
                {
                    out.insert(k, Value::String("***REDACTED***".into()));
                } else {
                    out.insert(k, redact_value(v));
                }
            }
            Value::Object(out)
        }
        Value::Array(arr) => Value::Array(arr.into_iter().map(redact_value).collect()),
        Value::String(s) => {
            if s.starts_with("sk-") && s.len() > 12 {
                Value::String("***REDACTED***".into())
            } else {
                Value::String(s)
            }
        }
        other => other,
    }
}
