# 11. Provider & Model System

## 1. Goal

PI-Desktop must support **all major market model vendors and models** that users commonly need, without hardcoding a tiny allowlist as product ceiling.

Strategy:

> **Universal provider coverage via pi-ai + OpenAI-compatible escape hatch + refreshable model catalogs.**

We do **not** re-implement every vendor SDK ourselves.  
We standardize on pi’s multi-provider layer and add product-level configuration, catalog, and UX.

## 2. Coverage principle

### Must support
1. First-party major vendors
2. Popular aggregators / gateways
3. Any OpenAI-compatible endpoint
4. User-defined custom providers
5. Continuous model catalog refresh

### Product promise
- Users can connect practically any mainstream vendor/model available through:
  - native pi provider integrations
  - OpenAI-compatible APIs
  - custom provider definitions

### Explicit non-promise
- Guaranteeing every obscure vendor’s proprietary non-standard protocol without an adapter
- Shipping offline full world-model matrix forever without catalog updates

## 3. Architecture

```text
Settings / UI
  → ProviderConfigStore (Rust host DB)
  → AgentRuntime (Node/pi)
      ├─ built-in vendor providers (via pi-ai)
      ├─ openai-compatible provider
      └─ custom provider definitions
  → ModelCatalogService
      ├─ bundled catalog snapshot
      ├─ runtime discovery (where supported)
      └─ refresh from pi model data / remote catalog source
```

## 4. Provider types

| type | description | examples |
|---|---|---|
| `native` | first-class vendor integration via pi-ai | openai, anthropic, google, bedrock, mistral, etc. |
| `openai_compatible` | any OpenAI Chat Completions/Responses compatible gateway | OpenRouter, Together, Groq, Fireworks, DeepSeek, local gateways, corporate proxies |
| `custom` | user-defined provider based on known protocol profile | private deployments, regional gateways |

Protocol profiles (MVP):

1. `openai`
2. `anthropic`
3. `google`
4. `openai_compatible`
5. `bedrock` (if enabled by runtime support)
6. `custom_http` (advanced/experimental later)

## 5. Built-in vendor matrix (ship intent)

> Exact availability depends on pi-ai support at pin version; product must expose all supported ones and keep OpenAI-compatible path open for the rest.

### Tier A — always exposed in UI
- OpenAI
- Anthropic
- Google Gemini
- OpenAI-Compatible (generic)

### Tier B — expose when runtime supports / enable by default if present in pi-ai
- AWS Bedrock
- Azure OpenAI / OpenAI on Azure
- Mistral
- xAI
- DeepSeek
- Groq
- Together
- Fireworks
- Cohere
- Perplexity
- OpenRouter
- Moonshot / Kimi
- Zhipu / GLM
- MiniMax
- Baichuan
- Qwen / DashScope
- 01.AI / Yi
- SiliconFlow
- NVIDIA NIM
- Ollama (local)
- LM Studio (local OpenAI-compatible)
- vLLM / TGI / LocalAI / LiteLLM gateways (via OpenAI-compatible)

### Tier C — user custom
Any vendor not listed but reachable by:
- OpenAI-compatible base URL
- custom headers
- custom auth scheme

## 6. Model support policy

### 6.1 No hard model allowlist ceiling
PI-Desktop must not permanently restrict users to a short fixed model list.

### 6.2 Catalog sources (priority)
1. **Runtime-native discovery** from pi-ai/provider APIs when available
2. **Bundled catalog snapshot** shipped with app
3. **Refreshed catalog** (manual refresh / update channel)
4. **User-defined model entries**

### 6.3 Model families to cover
Catalog and custom model entry must support common capability classes:

- text chat / coding models
- reasoning / thinking models
- long-context models
- vision / multimodal input models
- tool-calling capable models
- JSON/structured output capable models (where provider supports)

## 7. Configuration schema

```ts
type ProviderAuthKind =
  | "api_key"
  | "api_key_and_base_url"
  | "bearer"
  | "azure_api_key"
  | "aws_sdk_default"
  | "custom_headers"
  | "none" // local no-auth

type ProviderConfig = {
  id: string                    // uuid/ulid
  name: string                  // display name
  vendorKey: string             // openai/anthropic/google/openrouter/custom/...
  type: "native" | "openai_compatible" | "custom"
  protocol: "openai" | "anthropic" | "google" | "openai_compatible" | "bedrock" | "custom_http"
  enabled: boolean
  baseUrl?: string
  authKind: ProviderAuthKind
  secretRef?: string            // pointer into secret store
  headers?: Record<string, string> // non-secret headers only
  apiStyle?: "chat_completions" | "responses" | "auto"
  compatibility?: {
    supportsTools?: boolean
    supportsVision?: boolean
    supportsStreaming?: boolean
    supportsReasoning?: boolean
  }
  defaultModelId?: string
  models?: UserModelConfig[]    // optional user-defined models
  createdAt: string
  updatedAt: string
}

type UserModelConfig = {
  id: string                    // provider-local model id/slug
  displayName: string
  providerId: string
  contextWindow?: number
  maxOutputTokens?: number
  capabilities?: Array<"text" | "tools" | "vision" | "reasoning" | "json">
  pricingHint?: string
  hidden?: boolean
}

type SelectedModelRef = {
  providerId: string
  modelId: string
}
```

## 8. Secrets

- API keys stored via secure storage (`SECRET_*` APIs)
- Provider config stores only `secretRef` / hasSecret boolean
- Renderer never receives raw key in list APIs
- Optional key validation call: `providers.testConnection`

## 9. Model catalog service

```ts
interface ModelCatalogService {
  listProviders(): Promise<ProviderDescriptor[]>
  listModels(filter?: ModelQuery): Promise<ModelDescriptor[]>
  refreshCatalog(options?: { providerId?: string }): Promise<RefreshResult>
  resolveModel(ref: SelectedModelRef): Promise<ResolvedModel>
  upsertUserModel(model: UserModelConfig): Promise<void>
}
```

### ModelDescriptor

```ts
type ModelDescriptor = {
  providerId: string
  vendorKey: string
  modelId: string
  displayName: string
  source: "bundled" | "discovered" | "user"
  capabilities: Array<"text" | "tools" | "vision" | "reasoning" | "json">
  contextWindow?: number
  maxOutputTokens?: number
  deprecated?: boolean
  tags?: string[]
}
```

## 10. UI requirements

### Providers page
- add built-in vendor quickly
- add OpenAI-compatible endpoint
- add custom provider
- edit base URL/headers
- set/replace/delete key
- enable/disable provider
- test connection

### Model selector
- search all models across enabled providers
- group by provider/vendor
- show capability badges (tools/vision/reasoning)
- allow “refresh models”
- allow custom model id entry

### Empty/error states
- no provider configured
- key missing
- model not found
- provider unauthorized
- catalog refresh failed (still allow manual model id)

## 11. Runtime selection algorithm

When user selects model M from provider P:

1. load ProviderConfig(P)
2. ensure secret present if required
3. resolve protocol adapter via pi-ai
4. merge baseUrl/headers/auth
5. create/stream via pi runtime
6. map provider errors into shared error codes

If model not in catalog:

- still allow if user explicitly enters model id and provider accepts unknown ids

## 12. Compatibility tiers

| tier | meaning |
|---|---|
| full | tools + streaming + vision verified/expected |
| standard | chat streaming expected |
| limited | best-effort via compatible gateway |
| unknown | user custom, no guarantees |

UI may show tier hints, but must not hard-block unknown models by default.

## 13. Refresh & update policy

1. App ships with bundled catalog snapshot
2. User can click **Refresh model catalog**
3. Refresh may update:
   - discovered models for providers with list APIs
   - bundled catalog via app update channel
4. Refresh failure must not wipe existing catalog

## 14. Local model support

Supported through:

- Ollama native if pi supports / otherwise OpenAI-compatible proxy
- LM Studio OpenAI-compatible endpoint
- vLLM / TGI / LocalAI / LiteLLM endpoints

Requirements:

- custom base URL
- optional no-auth
- manual model id entry always available

## 15. Validation rules

- `name` required
- `vendorKey` required
- `protocol` required
- `baseUrl` required for openai_compatible/custom when endpoint not implicit
- secret required when `authKind` needs key
- headers must not contain raw api keys (use secret store)
- model id non-empty

## 16. Acceptance criteria

1. User can add OpenAI / Anthropic / Gemini natively
2. User can add arbitrary OpenAI-compatible vendor by base URL + key
3. User can select models from catalog search across providers
4. User can enter a custom model id not present in catalog
5. Catalog refresh works without destroying existing providers
6. Missing key/model errors use stable codes
7. No product hard-limit like “only 3 vendors / 10 models”

## 17. Non-goals

- Building our own full provider SDK ecosystem
- Guaranteeing identical tool/vision quality across all vendors
- Marketplace of providers (not needed; config is local)

## 14. Failure taxonomy (provider domain)

| code | meaning | user-facing guidance |
|---|---|---|
| `PROVIDER_AUTH_FAILED` | invalid/expired key or denied auth | re-enter secret / check account |
| `PROVIDER_BASE_URL_INVALID` | malformed or unreachable base URL | fix endpoint |
| `PROVIDER_PROTOCOL_MISMATCH` | wrong protocol for endpoint | switch protocol profile |
| `PROVIDER_MODEL_NOT_FOUND` | model id unknown for provider | refresh catalog or custom id |
| `PROVIDER_RATE_LIMITED` | 429 / quota | retry later / switch model |
| `PROVIDER_TIMEOUT` | network or server timeout | retry / check network |
| `PROVIDER_UNSUPPORTED_CAPABILITY` | tools/vision/reasoning unsupported | switch model or disable feature |
| `PROVIDER_STREAM_INTERRUPTED` | stream dropped mid-turn | retry turn |
| `PROVIDER_SECRET_MISSING` | enabled provider without secret | complete setup |
| `PROVIDER_DISABLED` | provider exists but disabled | enable provider |

All codes must map into shared `AppError` registry.

## 15. Runtime resolution algorithm

When starting a turn with `(providerId, modelId)`:

1. load provider config from host
2. if missing/disabled → fail `PROVIDER_DISABLED` / not found
3. resolve secret via `secretRef` (never log secret)
4. resolve model metadata:
   - user-defined model override
   - catalog cache
   - otherwise accept raw modelId if provider allows free-form ids
5. build runtime provider adapter request for pi-ai
6. execute stream with abort handle
7. translate vendor errors into AppError codes above

## 16. OpenAI-compatible first-class path

Any vendor can be onboarded without a native SDK if it exposes OpenAI-compatible APIs.

Required fields:
- `baseUrl`
- auth (`api_key` / `bearer` / `none` / custom headers)
- model id (catalog or free-form)

Optional:
- `apiStyle` (`chat_completions` | `responses` | `auto`)
- compatibility flags
- custom headers (non-secret)

This is the **universal escape hatch** guaranteeing market coverage beyond native integrations.

## 17. Local / offline model path

Supported via OpenAI-compatible local servers:
- Ollama
- LM Studio
- vLLM
- LocalAI
- LiteLLM proxies
- other local gateways

Auth may be `none`. Catalog refresh may use `/v1/models` when available; otherwise user-defined models.

## 18. Multi-provider product rules

1. Multiple providers of same vendorKey are allowed (e.g. two OpenRouter accounts).
2. Provider `name` is user-editable and unique per workspace/user profile.
3. Default app model is a `(providerId, modelId)` pair, not modelId alone.
4. Session stores its own `(providerId, modelId)` binding.
5. Deleting a provider blocks new turns that reference it; historical sessions keep the ids for audit/display.
6. Export settings never includes raw secrets.
7. Import settings can recreate provider shells and prompt for secrets.

## 19. MVP acceptance criteria

- [ ] Add OpenAI / Anthropic / Google / OpenAI-Compatible providers from UI
- [ ] Add arbitrary OpenAI-compatible custom provider with base URL + key
- [ ] Free-form model id accepted when catalog misses it
- [ ] Catalog refresh populates models for at least one native and one compatible provider
- [ ] Connection test returns structured success/failure without secret leakage
- [ ] Session can switch model between turns
- [ ] Missing secret blocks run with actionable error
- [ ] At least one local provider path (Ollama or LM Studio style) documented and testable

## 20. Non-goals (MVP)

- full multi-modal attachment studio beyond model capability flags
- automatic paid-plan discovery for every vendor portal
- guaranteeing proprietary non-HTTP SDKs without pi-ai support
- cloud-synced provider profiles

