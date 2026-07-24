# ADR 0012: Universal provider/model coverage via pi-ai + OpenAI-compatible extensibility

- Status: Accepted
- Date: 2026-07-25

## Context

Product requirement:

> Provider support must cover market vendors/models broadly, not a small fixed set.

Implementing and maintaining every vendor SDK in-house is unrealistic. pi-ai already provides multi-provider abstractions, and most long-tail vendors expose OpenAI-compatible APIs.

## Decision

1. Use **pi-ai** as the native multi-provider engine
2. Treat **OpenAI-compatible providers** as first-class
3. Ship a **refreshable model catalog** + **user-defined model IDs**
4. Do **not** enforce a closed product allowlist that blocks unknown models
5. Expose major vendors in UI presets, while allowing arbitrary custom endpoints

## Consequences

### Positive
- Broad market coverage with manageable engineering scope
- Easy support for gateways and local model servers
- Future vendors can often be onboarded without app rewrite

### Negative
- Capability quality differs by vendor
- Catalog metadata may be incomplete and needs refresh/manual overrides

## Alternatives rejected

1. Only support 3–4 top vendors
2. Build and maintain all vendor SDKs ourselves
3. Hardcode a permanent fixed model list

## Alternatives considered

1. **Tiny fixed vendor list only**
   - rejected: fails globalization and user expectation
2. **Reimplement every vendor SDK in Rust**
   - rejected: duplicates pi-ai, slows delivery, high maintenance
3. **Only OpenAI-compatible, no native providers**
   - rejected: worse UX/quality for major vendors with native quirks
4. **Hardcoded closed model allowlist**
   - rejected: models churn weekly; blocks power users

## Consequences

### Positive
- practical path to “support market vendors/models”
- native quality where pi-ai has integrations
- universal escape hatch for everything else
- catalog remains evolvable without app rewrite

### Negative / tradeoffs
- capability metadata can be incomplete for obscure models
- OpenAI-compatible quirks still need compatibility flags
- catalog freshness depends on refresh/bundled snapshots

## Follow-up specs

- `docs/spec/03-runtime/11-provider-model-system.md`
- `docs/spec/03-runtime/12-provider-config-schema.md`
- `docs/spec/03-runtime/13-model-catalog-and-selection.md`

