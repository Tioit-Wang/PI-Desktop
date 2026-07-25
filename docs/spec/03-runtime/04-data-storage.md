# 04. Data Storage

## 0. Ownership decision

**Rust host-core owns SQLite exclusively (D002).**

- Node pi sidecar does not open the DB directly
- Electron main does not write DB files directly
- All session/settings/plugin registry writes go through host RPC

## 1. Goal

Local-first, recoverable after restart, sensitive data isolated.

## 2. Storage Partitions

| Partition | Contents | Suggested medium |
|---|---|---|
| settings | Non-sensitive config | SQLite / JSON |
| secrets | API keys | OS safeStorage + metadata index |
| sessions | Sessions and messages | SQLite |
| logs | Runtime logs | Files |
| cache | Model catalog cache, etc. | Files/SQLite |

## 3. Suggested Paths

```text
~/.pi-desktop/
 ├── settings.sqlite
 ├── sessions.sqlite
 ├── secrets.meta.json
 ├── secrets.bin # or platform secure storage
 ├── logs/app.log
 └── cache/
```

Exact file names may be adjusted during implementation.

## 4. Session Data Model (logical)

### sessions
- id
- title
- project_path
- model_id
- mode (`chat`|`agent`)
- created_at
- updated_at
- status

### messages
- id
- session_id
- role (`user`|`assistant`|`tool`|`system`)
- content_json
- created_at
- turn_id
- parent_id nullable

### tool_calls
- id
- message_id
- tool_name
- args_json
- result_json
- status
- started_at
- ended_at

### turn_runs
- id
- session_id
- status (`running`|`completed`|`aborted`|`error`)
- started_at
- ended_at
- error_code nullable

## 5. Settings Model (logical)

- providers[]
- defaultProviderId
- defaultModelId
- permissionPolicy
- uiPreferences
- proxyConfig (later)

Provider entries do not store apiKey plaintext directly, only:

- hasSecret
- secretUpdatedAt

## 6. Secrets Rules

1. The renderer never persists secrets
2. Main uses Electron `safeStorage` (when available)
3. When secure storage is unavailable, define an explicit fallback policy and warn about the risk
4. Exported sessions exclude secrets by default

## 7. Consistency

- Either write messages to disk before confirming the UI's final state, or use "in-memory while running + persist final state" — pick one
- MVP recommendation:
 - user message persisted immediately
 - assistant/tool persisted on the end event
 - running state may keep a lightweight snapshot

## 8. Migration

- schema_version table
- migrate on startup
- destructive migrations must be backup-able

## 9. Backup and Cleanup (later)

- one-click session export
- clear cache
- log rotation

MVP only needs:
- not losing sessions
- being able to delete sessions
