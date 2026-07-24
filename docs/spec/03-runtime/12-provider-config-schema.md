# 12. Provider Config Schema

## 1. Storage location

Owned by Rust host DB/settings store.

Tables (logical):

- `providers`
- `provider_models` (user-defined)
- `model_catalog_cache`
- `secrets_meta` (no raw secret values)

## 2. Provider record JSON schema (logical)

```json
{
  "$id": "pi-desktop.provider.v1",
  "type": "object",
  "required": ["id", "name", "vendorKey", "type", "protocol", "enabled", "authKind"],
  "properties": {
    "id": { "type": "string", "minLength": 1 },
    "name": { "type": "string", "minLength": 1 },
    "vendorKey": { "type": "string", "minLength": 1 },
    "type": { "enum": ["native", "openai_compatible", "custom"] },
    "protocol": {
      "enum": ["openai", "anthropic", "google", "openai_compatible", "bedrock", "custom_http"]
    },
    "enabled": { "type": "boolean" },
    "baseUrl": { "type": "string" },
    "authKind": {
      "enum": [
        "api_key",
        "api_key_and_base_url",
        "bearer",
        "azure_api_key",
        "aws_sdk_default",
        "custom_headers",
        "none"
      ]
    },
    "secretRef": { "type": "string" },
    "headers": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "apiStyle": { "enum": ["chat_completions", "responses", "auto"] },
    "compatibility": {
      "type": "object",
      "properties": {
        "supportsTools": { "type": "boolean" },
        "supportsVision": { "type": "boolean" },
        "supportsStreaming": { "type": "boolean" },
        "supportsReasoning": { "type": "boolean" }
      }
    },
    "defaultModelId": { "type": "string" },
    "createdAt": { "type": "string" },
    "updatedAt": { "type": "string" }
  }
}
```

## 3. Built-in vendor presets

Presets only prefill form defaults; they are not a closed world.

| vendorKey | default protocol | authKind | baseUrl required |
|---|---|---|---|
| openai | openai | api_key | no |
| anthropic | anthropic | api_key | no |
| google | google | api_key | no |
| openrouter | openai_compatible | api_key_and_base_url | yes |
| deepseek | openai_compatible | api_key_and_base_url | yes |
| groq | openai_compatible | api_key_and_base_url | yes |
| together | openai_compatible | api_key_and_base_url | yes |
| fireworks | openai_compatible | api_key_and_base_url | yes |
| mistral | openai_compatible or native | api_key | optional |
| xai | openai_compatible | api_key_and_base_url | yes |
| azure_openai | openai_compatible | azure_api_key | yes |
| bedrock | bedrock | aws_sdk_default | no |
| ollama | openai_compatible | none | yes |
| lmstudio | openai_compatible | none | yes |
| custom | openai_compatible | api_key_and_base_url | yes |

## 4. Model catalog cache record

```ts
type ModelCatalogCacheRecord = {
  providerId?: string // empty for global bundled
  modelId: string
  displayName: string
  vendorKey: string
  capabilities: string[]
  contextWindow?: number
  source: "bundled" | "discovered" | "user"
  updatedAt: string
  raw?: unknown
}
```

## 5. IPC / host methods (provider domain)

- `providers.list`
- `providers.get`
- `providers.create`
- `providers.update`
- `providers.delete`
- `providers.testConnection`
- `providers.listModels`
- `providers.refreshModels`
- `providers.upsertUserModel`
- `providers.deleteUserModel`

## 6. Security constraints

1. raw secrets never returned by list/get provider APIs
2. `headers` must not store `Authorization: Bearer <secret>` if secret store can be used
3. export settings excludes secrets by default

## 7. Migration

- schemaVersion on settings DB
- provider records additive-evolved
- unknown future protocol values should not crash older app versions (ignore/disable with warning)

## 8. SQL draft (logical, Rust-owned SQLite)

```sql
CREATE TABLE providers (
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

CREATE TABLE provider_models (
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

CREATE TABLE model_catalog_cache (
  id TEXT PRIMARY KEY,
  provider_id TEXT,
  vendor_key TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  context_window INTEGER,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  raw_json TEXT
);

CREATE UNIQUE INDEX idx_model_catalog_unique
  ON model_catalog_cache(COALESCE(provider_id, ''), vendor_key, model_id);

CREATE TABLE recent_models (
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  used_at TEXT NOT NULL,
  PRIMARY KEY (provider_id, model_id)
);

CREATE TABLE secrets_meta (
  secret_ref TEXT PRIMARY KEY,
  provider_id TEXT,
  kind TEXT NOT NULL,
  backend TEXT NOT NULL, -- safeStorage | file_fallback
  updated_at TEXT NOT NULL
);
```

> Raw secret material is **not** stored in these tables.

## 9. Host method contracts (v1)

### `providers.list`
- in: `{ includeDisabled?: boolean }`
- out: `{ providers: ProviderPublic[] }`
- `ProviderPublic` excludes raw secrets; includes `hasSecret: boolean`

### `providers.create` / `providers.update`
- in: provider fields + optional `secretValue`
- behavior: persist config; if secretValue present, write secret store and set `secretRef`
- out: `ProviderPublic`

### `providers.delete`
- in: `{ id, deleteSecret?: boolean }` default `deleteSecret=true`
- out: `{ ok: true }`

### `providers.testConnection`
- in: `{ id, modelId?: string }`
- out: `{ ok: boolean, latencyMs?: number, error?: AppError, sampleModelId?: string }`

### `providers.listModels`
- in: `{ id, query?: string, source?: "cache"|"live"|"all" }`
- out: `{ models: ModelCatalogItem[] }`

### `providers.refreshModels`
- in: `{ id }`
- out: `{ added: number, updated: number, removed: number, models: ModelCatalogItem[] }`

### `providers.upsertUserModel` / `providers.deleteUserModel`
- manage free-form / override model entries

## 10. Validation rules

1. `name` unique (case-insensitive) among providers
2. `openai_compatible` / local gateways require absolute `baseUrl` unless preset says optional
3. `authKind=none` forbidden for cloud presets that require keys
4. headers keys are case-insensitive unique
5. secretValue max length enforced (e.g. 8KB)
6. modelId must be non-empty trimmed string; allow `/`, `.`, `:`, `-`
7. unknown protocol on older clients => provider shown disabled with warning, not crash

## 11. Secret ref format

```text
secret:provider:<providerId>:api_key
```

Future multi-secret providers may add suffixes (`:client_secret`, etc.).

