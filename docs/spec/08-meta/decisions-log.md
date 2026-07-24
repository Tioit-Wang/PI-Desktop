# Decisions Log

> Baseline delta: `0.3.0` → `0.3.4`  
> Date: `2026-07-25`  
> Status: Accepted for implementation

This log freezes previously open questions into concrete decisions.

## A. High-priority architecture decisions

| ID | Topic | Decision | Rationale |
|---|---|---|---|
| D001 | Electron ↔ Rust transport | **Rust sidecar + stdio JSON-RPC (NDJSON)** | Simple isolation, debuggable, replaceable later |
| D002 | SQLite ownership | **Rust host-core owns SQLite exclusively** | Single writer, clearer privilege boundary |
| D003 | Default mode | **Agent** | Product is an agent desktop, not pure chat |
| D004 | Chat tool policy | **Chat is read-only** (`Read`/`Glob`/`Grep` only) | Safer default split between Chat and Agent |
| D005 | Permission timeout | **120s → deny** | Fail closed, do not hang forever |
| D006 | `allow-session` scope | **By `toolName`** | Simple UX; workspace sandbox still enforces path safety |
| D007 | `~/.pi` compatibility | **No auto-import in MVP** | Keep config ownership clean in `~/.pi-desktop` |
| D008 | Node runtime packaging | **Dev uses system Node; packaging strategy frozen at M5** | Unblock M1–M4 without early packaging complexity |
| D009 | Plugin runtime isolation | **Target = separate process; M4 may use host-managed sandboxed runtime** | Ship plugin foundation pragmatically without weakening API gateway |
| D010 | First release platform | **macOS arm64 only** | Focus acceptance and packaging |

## B. Secondary implementation defaults

| ID | Topic | Decision |
|---|---|---|
| D011 | TS schema validation | **typebox** |
| D012 | i18n library | **i18next + react-i18next** |
| D013 | Bash execution style in M3 | **Non-interactive only** (no PTY yet) |
| D014 | Command palette shortcut | **Cmd/Ctrl + Shift + P** |
| D015 | Plugin tool exposed name | **Forced prefix** `plugin_<pluginIdSafe>_<toolName>` |
| D016 | Uninstall plugin data | **Delete by default**, optional keep-data later |
| D017 | enable → load failure | **Auto fallback to disabled** |
| D018 | Plugin secrets in settings | **Not allowed in MVP** |
| D019 | Plugin session summary access | **Denied by default** |
| D020 | Auto-update | **Post-MVP** |
| D021 | First-run onboarding | **Inline checklist (not modal wizard)** |
| D022 | Local telemetry | **Local logs only in MVP (no remote telemetry)** |


## E. Provider & model coverage decisions (0.3.4)

| ID | Topic | Decision | Rationale |
|---|---|---|---|
| D023 | Provider coverage goal | **Universal market coverage** (not a tiny fixed vendor list) | Globalization + real coding workflows |
| D024 | Coverage strategy | **pi-ai native providers + first-class OpenAI-compatible + custom providers** | Maximum reach without rewriting every SDK |
| D025 | Model allowlist | **No closed product allowlist** | Models churn; power users need free-form IDs |
| D026 | Catalog sources | **bundled snapshot + discovery/refresh + user-defined** | Works offline and stays current |
| D027 | Default identity | **Model selection is `(providerId, modelId)`** | Same model id can exist on many gateways |
| D028 | Secrets | **OS safeStorage (or controlled fallback) via secretRef; never in provider JSON** | Security boundary with Rust host ownership |
| D029 | Local models | **Supported through OpenAI-compatible local gateways** | Ollama/LM Studio/vLLM without special-case architecture |
| D030 | Connection test | **First-class host method before trusting provider for runs** | Fail early, actionable setup UX |
| D031 | Secrets backend | **OS safeStorage primary + encrypted file fallback** | Robust on macOS first release |
| D032 | Workspace ignore | **security denylist + defaults + `.pi-desktopignore`** | Safe/predictable tool FS behavior |
| D033 | Tool result limits | **256KB/4000 lines defaults with explicit truncation markers** | Protect context & UI |
| D034 | Desktop visual baseline | **Codex electron-dark 1:1 shell (charcoal gray, floating composer, ~275px sidebar)** | Match local Codex usability and density; keep PI-Desktop product branding |
| D035 | Shell display name | **UI chrome uses shellName "Codex"; product/about remains PI-Desktop** | Satisfy visual 1:1 replica goal while preserving product identity in about/settings |

## C. Still deferred (not blocking M1)

1. Exact marketplace domain / provider IDs
2. Private marketplace auth mechanism
3. Signature key distribution operational details
4. Final Node sidecar packaging format for release builds
5. Additional locales schedule (e.g. zh-CN)
6. Remote catalog update channel details (URL/signature)
7. Exact recommended default model per vendor preset

## D. Decision rules going forward

- Architecture-boundary changes require a new ADR
- Implementation defaults can be updated in this log + related specs
- Any reversal of D001–D010 requires explicit baseline bump
