# 14. Secrets Storage

## 1. Goal

Store provider credentials and future sensitive tokens safely under Rust host ownership, with zero raw secret leakage to renderer logs/UI persistence.

## 2. Ownership

| Concern | Owner |
|---|---|
| secret write/read/delete | Rust host-core |
| secret metadata index | SQLite `secrets_meta` |
| OS secure storage integration | Rust host-core |
| renderer knowledge | `hasSecret` boolean only |

Node pi sidecar may receive secret **ephemerally in-memory** for a run via host RPC, never persisted by sidecar.

## 3. Backends

### Primary
- **Electron/OS safe storage style backend** mediated by host
- macOS: Keychain-backed path preferred for first release

### Fallback
If primary backend unavailable:
1. encrypt secret blob with machine-local key material
2. store ciphertext under app data
3. mark `backend=file_fallback` in metadata
4. surface security warning in settings

MVP must implement both paths with automatic selection.

## 4. Data model

```ts
type SecretMeta = {
  secretRef: string
  providerId?: string
  kind: "api_key" | "bearer_token" | "azure_api_key" | "custom"
  backend: "safeStorage" | "file_fallback"
  updatedAt: string
}

// raw value never appears in SQLite tables
// raw value never appears in IPC list/get provider responses
```

`secretRef` format:

```text
secret:provider:<providerId>:api_key
```

## 5. Host RPC

- `secrets.set` `{ secretRef, value, meta }`
- `secrets.delete` `{ secretRef }`
- `secrets.has` `{ secretRef } -> boolean`
- `secrets.getForRuntime` `{ secretRef, reason, runId }` **internal only** (main/host → not exposed to renderer)

### Renderer-facing surface
Renderer uses provider methods that accept optional `secretValue` on create/update and only reads `hasSecret`.

## 6. Access rules

1. Renderer cannot list raw secrets
2. Logs redaction: mask values matching secret patterns / known secret refs
3. `getForRuntime` requires active run context and is audited
4. Export excludes secrets by default
5. Uninstall/reset app deletes secrets unless future explicit migrate tool says otherwise
6. Provider delete defaults to deleting linked secret

## 7. Redaction policy

Never write to logs:
- Authorization headers
- api keys
- bearer tokens
- query params named `key`/`token`/`api_key`

Replace with:
```text
***REDACTED***
```

## 8. Failure modes

| case | behavior |
|---|---|
| set fails | provider update fails atomically if secret required |
| backend downgrades to fallback | warn once per session in settings |
| missing secret at run | `PROVIDER_SECRET_MISSING` |
| decrypt failure | treat as missing + prompt re-enter |

## 9. Acceptance criteria

- [ ] set/has/delete works on macOS arm64 primary path
- [ ] renderer never receives raw secret on provider list/get
- [ ] runtime can fetch secret ephemerally for a turn
- [ ] logs do not contain raw key material in normal failure tests
- [ ] fallback backend works when primary unavailable (dev/test harness)
