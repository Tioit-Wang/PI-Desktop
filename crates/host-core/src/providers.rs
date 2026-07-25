use anyhow::Result;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::{ms_to_ts, now_ms, Database};
use crate::secrets::{secret_ref_for_provider, SecretStore};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderPublic {
    pub id: String,
    pub name: String,
    pub vendor_key: String,
    #[serde(rename = "type")]
    pub provider_type: String,
    pub protocol: String,
    pub enabled: bool,
    pub base_url: Option<String>,
    pub auth_kind: String,
    pub has_secret: bool,
    pub default_model_id: Option<String>,
    pub api_style: Option<String>,
    /// Explicit provider-level reasoning override.  `None` means the model
    /// catalog resolver should infer capability from the selected model.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_reasoning: Option<bool>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCreateInput {
    pub name: String,
    pub vendor_key: Option<String>,
    #[serde(rename = "type")]
    pub provider_type: Option<String>,
    pub protocol: Option<String>,
    pub base_url: Option<String>,
    pub auth_kind: Option<String>,
    pub default_model_id: Option<String>,
    pub secret_value: Option<String>,
    pub api_style: Option<String>,
    pub supports_reasoning: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderUpdateInput {
    pub id: String,
    pub name: Option<String>,
    pub vendor_key: Option<String>,
    #[serde(rename = "type")]
    pub provider_type: Option<String>,
    pub protocol: Option<String>,
    pub base_url: Option<String>,
    pub auth_kind: Option<String>,
    pub default_model_id: Option<String>,
    pub secret_value: Option<String>,
    pub api_style: Option<String>,
    pub supports_reasoning: Option<bool>,
    pub enabled: Option<bool>,
}

const PROVIDER_SELECT: &str =
    "SELECT id, name, vendor_key, type, protocol, enabled, base_url, auth_kind, secret_ref,
            default_model_id, api_style, config_json, created_at, updated_at
     FROM providers";

fn config_reasoning_override(raw: &str) -> Option<bool> {
    serde_json::from_str::<serde_json::Value>(raw)
        .ok()
        .and_then(|v| v.get("compatibility")?.get("supportsReasoning")?.as_bool())
}

fn config_with_reasoning_override(raw: &str, value: bool) -> Result<String> {
    let mut config: serde_json::Value = serde_json::from_str(raw)
        .map_err(|e| anyhow::anyhow!("provider config_json is invalid: {e}"))?;
    let object = config
        .as_object_mut()
        .ok_or_else(|| anyhow::anyhow!("provider config_json must be a JSON object"))?;
    let compatibility = object
        .entry("compatibility")
        .or_insert_with(|| serde_json::json!({}));
    let compatibility = compatibility.as_object_mut().ok_or_else(|| {
        anyhow::anyhow!("provider config_json.compatibility must be a JSON object")
    })?;
    compatibility.insert("supportsReasoning".into(), serde_json::json!(value));
    Ok(config.to_string())
}

fn provider_from_row(
    row: &rusqlite::Row<'_>,
    secrets: &SecretStore,
) -> rusqlite::Result<ProviderPublic> {
    let secret_ref: Option<String> = row.get(8)?;
    Ok(ProviderPublic {
        id: row.get(0)?,
        name: row.get(1)?,
        vendor_key: row.get(2)?,
        provider_type: row.get(3)?,
        protocol: row.get(4)?,
        enabled: row.get::<_, i64>(5)? != 0,
        base_url: row.get(6)?,
        auth_kind: row.get(7)?,
        has_secret: secret_ref.as_ref().map(|r| secrets.has(r)).unwrap_or(false),
        default_model_id: row.get(9)?,
        api_style: row.get(10)?,
        supports_reasoning: row
            .get::<_, String>(11)
            .ok()
            .and_then(|raw| config_reasoning_override(&raw)),
        created_at: ms_to_ts(row.get(12)?),
        updated_at: ms_to_ts(row.get(13)?),
    })
}

fn upsert_secret_meta(
    db: &Database,
    secret_ref: &str,
    provider_id: &str,
    backend: &str,
) -> Result<()> {
    db.conn()
        .prepare_cached(
            "INSERT INTO secrets_meta (secret_ref, owner_kind, owner_id, kind, backend, updated_at)
             VALUES (?1, 'provider', ?2, 'api_key', ?3, ?4)
             ON CONFLICT(secret_ref) DO UPDATE SET
               updated_at = excluded.updated_at, backend = excluded.backend",
        )?
        .execute(params![secret_ref, provider_id, backend, now_ms()])?;
    Ok(())
}

pub fn list_providers(
    db: &Database,
    secrets: &SecretStore,
    include_disabled: bool,
) -> Result<Vec<ProviderPublic>> {
    let sql = if include_disabled {
        format!("{PROVIDER_SELECT} ORDER BY created_at ASC")
    } else {
        format!("{PROVIDER_SELECT} WHERE enabled = 1 ORDER BY created_at ASC")
    };
    let mut stmt = db.conn().prepare_cached(&sql)?;
    let rows = stmt.query_map([], |row| provider_from_row(row, secrets))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn create_provider(
    db: &Database,
    secrets: &SecretStore,
    input: ProviderCreateInput,
) -> Result<ProviderPublic> {
    let id = Uuid::new_v4().to_string();
    let now = now_ms();
    let secret_ref = secret_ref_for_provider(&id);
    let mut backend = None;
    if let Some(secret) = input.secret_value.as_ref().filter(|s| !s.is_empty()) {
        let b = secrets.set(&secret_ref, secret)?;
        upsert_secret_meta(db, &secret_ref, &id, &b)?;
        backend = Some(b);
    }

    let vendor_key = input.vendor_key.unwrap_or_else(|| "custom".into());
    let provider_type = input
        .provider_type
        .unwrap_or_else(|| "openai_compatible".into());
    let protocol = input.protocol.unwrap_or_else(|| "openai_compatible".into());
    let auth_kind = input
        .auth_kind
        .unwrap_or_else(|| "api_key_and_base_url".into());
    let config_json = input
        .supports_reasoning
        .map(|value| {
            serde_json::json!({
                "compatibility": { "supportsReasoning": value }
            })
        })
        .unwrap_or_else(|| serde_json::json!({}));

    db.conn()
        .prepare_cached(
            "INSERT INTO providers (
                id, name, vendor_key, type, protocol, enabled, base_url, auth_kind, secret_ref,
                api_style, default_model_id, config_json, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
        )?
        .execute(params![
            id,
            input.name,
            vendor_key,
            provider_type,
            protocol,
            input.base_url,
            auth_kind,
            if backend.is_some() {
                Some(secret_ref.clone())
            } else {
                None
            },
            input.api_style,
            input.default_model_id,
            config_json.to_string(),
            now,
        ])?;

    get_provider(db, secrets, &id)?.ok_or_else(|| anyhow::anyhow!("provider missing after create"))
}

pub fn update_provider(
    db: &Database,
    secrets: &SecretStore,
    input: ProviderUpdateInput,
) -> Result<Option<ProviderPublic>> {
    let existing = get_provider(db, secrets, &input.id)?;
    let Some(existing) = existing else {
        return Ok(None);
    };
    let mut secret_ref = existing
        .has_secret
        .then(|| secret_ref_for_provider(&input.id));

    if let Some(secret) = input.secret_value.as_ref().filter(|s| !s.is_empty()) {
        let sref = secret_ref_for_provider(&input.id);
        let backend = secrets.set(&sref, secret)?;
        upsert_secret_meta(db, &sref, &input.id, &backend)?;
        secret_ref = Some(sref);
    }
    let config_json = if let Some(value) = input.supports_reasoning {
        let raw: String = db.conn().query_row(
            "SELECT config_json FROM providers WHERE id = ?1",
            params![input.id],
            |row| row.get(0),
        )?;
        Some(config_with_reasoning_override(&raw, value)?)
    } else {
        None
    };

    db.conn()
        .prepare_cached(
            "UPDATE providers SET
                name = COALESCE(?1, name),
                vendor_key = COALESCE(?2, vendor_key),
                type = COALESCE(?3, type),
                protocol = COALESCE(?4, protocol),
                base_url = COALESCE(?5, base_url),
                auth_kind = COALESCE(?6, auth_kind),
                default_model_id = COALESCE(?7, default_model_id),
                api_style = COALESCE(?8, api_style),
                enabled = COALESCE(?9, enabled),
                secret_ref = COALESCE(?10, secret_ref),
                config_json = COALESCE(?11, config_json),
                updated_at = ?12
             WHERE id = ?13",
        )?
        .execute(params![
            input.name,
            input.vendor_key,
            input.provider_type,
            input.protocol,
            input.base_url,
            input.auth_kind,
            input.default_model_id,
            input.api_style,
            input.enabled.map(|b| if b { 1 } else { 0 }),
            secret_ref,
            config_json,
            now_ms(),
            input.id
        ])?;
    get_provider(db, secrets, &input.id)
}

pub fn delete_provider(db: &Database, secrets: &SecretStore, id: &str) -> Result<bool> {
    let sref = secret_ref_for_provider(id);
    let _ = secrets.delete(&sref);
    db.conn()
        .prepare_cached("DELETE FROM secrets_meta WHERE secret_ref = ?1")?
        .execute(params![sref])?;
    let n = db
        .conn()
        .prepare_cached("DELETE FROM providers WHERE id = ?1")?
        .execute(params![id])?;
    Ok(n > 0)
}

pub fn get_provider(
    db: &Database,
    secrets: &SecretStore,
    id: &str,
) -> Result<Option<ProviderPublic>> {
    let sql = format!("{PROVIDER_SELECT} WHERE id = ?1");
    db.conn()
        .prepare_cached(&sql)?
        .query_row(params![id], |row| provider_from_row(row, secrets))
        .optional()
        .map_err(Into::into)
}

pub fn get_secret_for_provider(
    db: &Database,
    secrets: &SecretStore,
    provider_id: &str,
) -> Result<Option<String>> {
    let secret_ref: Option<String> = db
        .conn()
        .prepare_cached("SELECT secret_ref FROM providers WHERE id = ?1")?
        .query_row(params![provider_id], |row| row.get(0))
        .optional()?
        .flatten();
    if let Some(sref) = secret_ref {
        secrets.get(&sref)
    } else {
        Ok(None)
    }
}

pub fn provider_count_with_secret(db: &Database, secrets: &SecretStore) -> Result<i64> {
    let providers = list_providers(db, secrets, true)?;
    Ok(providers.iter().filter(|p| p.has_secret).count() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_context() -> (tempfile::TempDir, Database, SecretStore) {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::open(&dir.path().join("pi.sqlite")).unwrap();
        let secrets = SecretStore::open(dir.path()).unwrap();
        (dir, db, secrets)
    }

    #[test]
    fn reasoning_override_roundtrips_and_preserves_provider_config() {
        let (_dir, db, secrets) = test_context();
        let provider = create_provider(
            &db,
            &secrets,
            ProviderCreateInput {
                name: "Custom".into(),
                vendor_key: None,
                provider_type: None,
                protocol: None,
                base_url: None,
                auth_kind: Some("none".into()),
                default_model_id: Some("model-1".into()),
                secret_value: None,
                api_style: None,
                supports_reasoning: Some(true),
            },
        )
        .unwrap();
        assert_eq!(provider.supports_reasoning, Some(true));

        db.conn()
            .execute(
                "UPDATE providers
                 SET config_json = ?1
                 WHERE id = ?2",
                params![
                    json!({
                        "headers": { "x-demo": "keep" },
                        "compatibility": { "supportsTools": true },
                        "custom": { "nested": 42 }
                    })
                    .to_string(),
                    provider.id
                ],
            )
            .unwrap();

        let updated = update_provider(
            &db,
            &secrets,
            ProviderUpdateInput {
                id: provider.id.clone(),
                name: None,
                vendor_key: None,
                provider_type: None,
                protocol: None,
                base_url: None,
                auth_kind: None,
                default_model_id: None,
                secret_value: None,
                api_style: None,
                supports_reasoning: Some(false),
                enabled: None,
            },
        )
        .unwrap()
        .unwrap();
        assert_eq!(updated.supports_reasoning, Some(false));

        let raw: String = db
            .conn()
            .query_row(
                "SELECT config_json FROM providers WHERE id = ?1",
                params![provider.id],
                |row| row.get(0),
            )
            .unwrap();
        let config: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(config["headers"]["x-demo"], "keep");
        assert_eq!(config["compatibility"]["supportsTools"], true);
        assert_eq!(config["compatibility"]["supportsReasoning"], false);
        assert_eq!(config["custom"]["nested"], 42);

        // An update without the field leaves the explicit override intact.
        let unchanged = update_provider(
            &db,
            &secrets,
            ProviderUpdateInput {
                id: provider.id,
                name: Some("Renamed".into()),
                vendor_key: None,
                provider_type: None,
                protocol: None,
                base_url: None,
                auth_kind: None,
                default_model_id: None,
                secret_value: None,
                api_style: None,
                supports_reasoning: None,
                enabled: None,
            },
        )
        .unwrap()
        .unwrap();
        assert_eq!(unchanged.supports_reasoning, Some(false));
    }

    #[test]
    fn provider_without_override_omits_reasoning_capability() {
        let (_dir, db, secrets) = test_context();
        let provider = create_provider(
            &db,
            &secrets,
            ProviderCreateInput {
                name: "No override".into(),
                vendor_key: None,
                provider_type: None,
                protocol: None,
                base_url: None,
                auth_kind: Some("none".into()),
                default_model_id: None,
                secret_value: None,
                api_style: None,
                supports_reasoning: None,
            },
        )
        .unwrap();
        assert_eq!(provider.supports_reasoning, None);
        let wire = serde_json::to_value(provider).unwrap();
        assert!(wire.get("supportsReasoning").is_none());
    }
}
