use anyhow::Result;
use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::Database;
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
    pub enabled: Option<bool>,
}

pub fn list_providers(db: &Database, secrets: &SecretStore, include_disabled: bool) -> Result<Vec<ProviderPublic>> {
    let sql = if include_disabled {
        "SELECT id, name, vendor_key, type, protocol, enabled, base_url, auth_kind, secret_ref,
                default_model_id, api_style, created_at, updated_at FROM providers ORDER BY created_at ASC"
    } else {
        "SELECT id, name, vendor_key, type, protocol, enabled, base_url, auth_kind, secret_ref,
                default_model_id, api_style, created_at, updated_at FROM providers WHERE enabled = 1
         ORDER BY created_at ASC"
    };
    let mut stmt = db.conn().prepare(sql)?;
    let rows = stmt.query_map([], |row| {
        let secret_ref: Option<String> = row.get(8)?;
        let id: String = row.get(0)?;
        let has_secret = secret_ref
            .as_ref()
            .map(|r| secrets.has(r))
            .unwrap_or(false);
        Ok(ProviderPublic {
            id,
            name: row.get(1)?,
            vendor_key: row.get(2)?,
            provider_type: row.get(3)?,
            protocol: row.get(4)?,
            enabled: row.get::<_, i64>(5)? != 0,
            base_url: row.get(6)?,
            auth_kind: row.get(7)?,
            has_secret,
            default_model_id: row.get(9)?,
            api_style: row.get(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn create_provider(
    db: &Database,
    secrets: &SecretStore,
    input: ProviderCreateInput,
) -> Result<ProviderPublic> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let secret_ref = secret_ref_for_provider(&id);
    let mut backend = None;
    if let Some(secret) = input.secret_value.as_ref().filter(|s| !s.is_empty()) {
        backend = Some(secrets.set(&secret_ref, secret)?);
        db.conn().execute(
            "INSERT INTO secrets_meta (secret_ref, provider_id, kind, backend, updated_at)
             VALUES (?1, ?2, 'api_key', ?3, ?4)
             ON CONFLICT(secret_ref) DO UPDATE SET updated_at = excluded.updated_at, backend = excluded.backend",
            params![secret_ref, id, backend.clone().unwrap_or_else(|| "file_fallback".into()), now],
        )?;
    }

    let vendor_key = input.vendor_key.unwrap_or_else(|| "custom".into());
    let provider_type = input
        .provider_type
        .unwrap_or_else(|| "openai_compatible".into());
    let protocol = input
        .protocol
        .unwrap_or_else(|| "openai_compatible".into());
    let auth_kind = input
        .auth_kind
        .unwrap_or_else(|| "api_key_and_base_url".into());

    db.conn().execute(
        "INSERT INTO providers (
            id, name, vendor_key, type, protocol, enabled, base_url, auth_kind, secret_ref,
            headers_json, api_style, compatibility_json, default_model_id, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7, ?8, '{}', ?9, '{}', ?10, ?11, ?12)",
        params![
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
            now,
            now
        ],
    )?;

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
    let now = Utc::now().to_rfc3339();
    let mut secret_ref = existing
        .has_secret
        .then(|| secret_ref_for_provider(&input.id));

    if let Some(secret) = input.secret_value.as_ref().filter(|s| !s.is_empty()) {
        let sref = secret_ref_for_provider(&input.id);
        let backend = secrets.set(&sref, secret)?;
        secret_ref = Some(sref.clone());
        db.conn().execute(
            "INSERT INTO secrets_meta (secret_ref, provider_id, kind, backend, updated_at)
             VALUES (?1, ?2, 'api_key', ?3, ?4)
             ON CONFLICT(secret_ref) DO UPDATE SET updated_at = excluded.updated_at, backend = excluded.backend",
            params![sref, input.id, backend, now],
        )?;
    }

    db.conn().execute(
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
            updated_at = ?11
         WHERE id = ?12",
        params![
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
            now,
            input.id
        ],
    )?;
    get_provider(db, secrets, &input.id)
}

pub fn delete_provider(db: &Database, secrets: &SecretStore, id: &str) -> Result<bool> {
    let sref = secret_ref_for_provider(id);
    let _ = secrets.delete(&sref);
    db.conn()
        .execute("DELETE FROM secrets_meta WHERE secret_ref = ?1", params![sref])?;
    let n = db
        .conn()
        .execute("DELETE FROM providers WHERE id = ?1", params![id])?;
    Ok(n > 0)
}

pub fn get_provider(db: &Database, secrets: &SecretStore, id: &str) -> Result<Option<ProviderPublic>> {
    db.conn()
        .query_row(
            "SELECT id, name, vendor_key, type, protocol, enabled, base_url, auth_kind, secret_ref,
                    default_model_id, api_style, created_at, updated_at FROM providers WHERE id = ?1",
            params![id],
            |row| {
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
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )
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
        .query_row(
            "SELECT secret_ref FROM providers WHERE id = ?1",
            params![provider_id],
            |row| row.get(0),
        )
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
