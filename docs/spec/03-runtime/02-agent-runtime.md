# 02. Agent Runtime

## 1. Goal

Applied decisions: **D002/D003/D008**.


Wrap pi into a product runtime that desktop layers can consume safely.

Core packages:

- `@earendil-works/pi-ai`
- `@earendil-works/pi-agent-core`

## 2. Runtime placement

Agent loop runs in a **Node/TypeScript pi sidecar**, not in renderer.

```text
packages/agent-runtime/*
apps/desktop/electron/* (supervisor)
crates/host-core (tool execution + permissions)
```

## 3. Core objects

### 3.1 PiRuntime (Node)
- init models/providers
- create Agent
- bind tool bridge
- subscribe/normalize pi events

### 3.2 AgentHostFacade (Electron main)
- session routing
- process supervision
- IPC translation

### 3.3 Host Tool Bridge (Rust)
- receives tool call requests
- applies permission policy
- executes builtin/plugin tools
- returns normalized tool results

## 4. Runtime API (package-level)

```ts
interface AgentRuntime {
 prompt(input: PromptInput): Promise<{ turnId: string }>
 abort(turnId?: string): Promise<void>
 getStatus(): RuntimeStatus
 dispose(): Promise<void>
 subscribe(handler: (event: NormalizedAgentEvent) => void): () => void
}
```

## 5. Prompt flow

1. validate session
2. validate model/secret availability
3. reject if session busy
4. persist user message
5. start pi turn
6. stream normalized events to UI
7. on tool calls, delegate to Rust host bridge
8. finalize and persist

## 5b. Mode defaults

- Default product mode: **Agent**
- Chat mode is available as a safer read-only profile
- Mode is session-scoped and persisted with session metadata

## 6. Providers & models

> Full policy: `11-provider-model-system.md`, `12-provider-config-schema.md`, `13-model-catalog-and-selection.md`.

Coverage strategy:

1. **Native providers** exposed by pi-ai (OpenAI, Anthropic, Google, and others available at pin version)
2. **OpenAI-compatible** first-class path for gateways and long-tail vendors
3. **Custom providers** with protocol profiles
4. **Refreshable model catalog** + **free-form model IDs** (no closed allowlist)

MVP UI always includes at least:
- OpenAI
- Anthropic
- Google Gemini
- OpenAI-Compatible (generic)
- Custom provider entry

Runtime responsibilities:
- resolve `(providerId, modelId)`
- fetch secrets via host (never cache raw secrets in logs)
- translate vendor failures into provider AppError codes
- stream tokens/events to orchestrator
- support abort/cancel mid-stream

Local models are supported through OpenAI-compatible endpoints (Ollama, LM Studio, vLLM, etc.).


## 7. System prompt composition

```text
[base product prompt in English]
+ [mode prompt: chat/agent]
+ [workspace info]
+ [tool instructions]
+ [optional user custom instructions]
```

## 8. Concurrency

| Scope | MVP policy |
|---|---|
| same session | single turn serial |
| different sessions | limited parallel |
| tools | sequential by default |

## 9. Abort semantics

- stop model stream
- attempt cancel interruptible tools
- do not auto-rollback completed writes
- mark turn aborted in UI/storage

## 10. Explicit non-goals

- no DOM knowledge
- no direct FS access bypassing Rust host
- no secret leakage into events/logs

## 11. Implementation status (M5)

Implemented: streaming turns over the OpenAI-compatible protocol path
(universal escape hatch, D024); one active turn per session enforced with
`AGENT_BUSY`; real `turnId` returned per accepted prompt; provider failures
mapped to `PROVIDER_UNAUTHORIZED` / `PROVIDER_RATE_LIMITED` /
`STREAM_FAILED` / `TURN_ABORTED` where detectable.

Tracked gaps (post-MVP backlog): native Anthropic/Google protocol adapters
(DB `protocol` field is stored but the runtime currently always uses the
OpenAI-compatible path); session-scoped mode binding (mode is app-scoped via
`settings.defaultMode`); persisted turn/tool-call tables; richer system
prompt composition (§7).
