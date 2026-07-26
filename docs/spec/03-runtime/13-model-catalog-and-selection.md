# 13. Model Catalog & Selection

## 1. Product rule

Users must be able to use **market-available models broadly**, not only a curated demo subset.

Therefore:

1. Catalog is refreshable
2. Custom model IDs are always allowed
3. OpenAI-compatible gateways are first-class
4. Search is global across enabled providers

## 2. Selection UX

### Model picker fields
- search box
- provider filter
- capability filters: tools / vision / reasoning
- sort: recent / provider / name

### Item display
- model display name
- model id
- provider name
- capability badges
- optional context window

### Advanced
- “Use custom model ID”
- “Refresh catalog”

## 3. Recent models

Persist recent selected model refs:

```ts
type RecentModelRef = {
  providerId: string
  modelId: string
  usedAt: string
}
```

Show top N in picker.

## 4. Session model binding

Each session stores:

- `providerId`
- `modelId`
- `thinkingLevel` (`off|minimal|low|medium|high|xhigh|max`)

Changing model or thinking level mid-session affects subsequent turns only.
The stored thinking preference survives restart; the effective request level
is capability-clamped for the selected model at execution time.

## 5. Capability warnings

If user selects model tagged without tools while in Agent mode:

- show non-blocking warning
- do not hard-block (vendor tags may be incomplete)

## 6. Refresh behavior

`providers.refreshModels`:

1. query runtime-supported discovery endpoints
2. merge into catalog cache
3. keep user-defined models
4. return counts: added/updated/failed providers

## 7. Offline behavior

If refresh fails / offline:

- use cached catalog
- allow custom model id
- still allow providers with known model ids

## 8. Catalog item schema

```ts
type ModelCatalogItem = {
  providerId: string
  vendorKey: string
  modelId: string
  displayName: string
  source: "bundled" | "discovered" | "user" | "recent"
  capabilities: Array<
    | "tools"
    | "vision"
    | "reasoning"
    | "streaming"
    | "json"
    | "long_context"
  >
  contextWindow?: number
  maxOutputTokens?: number
  deprecated?: boolean
  notes?: string
  supportedThinkingLevels?: Array<
    "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"
  >
}
```

## 9. Selection resolution order

When UI/search requests models for picker:

1. recent models for enabled providers
2. user-defined models
3. discovered/refreshed cache
4. bundled snapshot
5. always include "custom model id" entry action

Deduplicate by `(providerId, modelId)` with priority:
`user > discovered > bundled > recent-only`.

## 10. Default model policy

App-level default:
- first successfully tested provider + its default/recommended model
- if none configured, onboarding checklist requires provider setup before first agent run

Session-level:
- inherits app default at creation
- can override independently

## 11. Capability gating

| mode/feature | required capability |
|---|---|
| Agent mode tools | `tools` (warn if missing; hard-block only if runtime cannot function) |
| image input | `vision` |
| reasoning UI affordances | `reasoning` |
| structured repair helpers | `json` optional |

Warnings are non-blocking unless execution is impossible.

### 11.1 Reasoning capability resolution

1. An explicit provider `supportsReasoning: false` is authoritative and
   yields only `off`, including when cached model capabilities say reasoning.
2. An explicit `true` enables the conservative custom-provider levels when
   the model is absent from pi's catalog.
3. Without an override, resolve pi catalog metadata for the exact
   `(vendorKey, modelId)`.
4. The Composer renders the selector only when the effective model supports
   reasoning and lists only `supportedThinkingLevels`.
5. If a stored/requested level is unavailable, choose the nearest supported
   level by scanning upward first and then downward. Non-reasoning models
   always resolve to `off`.
6. Changing to a non-reasoning provider persists `off`; no unsupported level
   leaks into the next request.

## 12. Refresh strategy

- manual refresh button in settings/model picker
- optional refresh on provider create/test success
- no aggressive background polling in MVP
- refresh failures keep previous cache and surface non-fatal error

## 13. Search behavior

- case-insensitive match on displayName, modelId, provider name, vendorKey
- capability filters are AND
- provider filter is exact providerId
- empty query shows recents + popular/bundled first

## 14. Acceptance criteria

- [ ] search finds models across multiple providers
- [ ] custom model id path works without catalog hit
- [ ] recent models surface in the picker
- [ ] refresh merges into cache and picker (never destructively replaces)
- [ ] capability badges visible
- [ ] session model change applies to next turn only
- [ ] reasoning selector is capability-gated and sparse level sets clamp the
      same way in Composer, Electron main, and the pi sidecar
- [ ] explicit reasoning disable removes stale catalog capability
