# 03. AI-Assisted Development Workflow

> Scope: AI agents and human collaborators working on PI-Desktop  
> Status: Accepted  
> Cross-references: [00-baseline](../00-baseline.md) · [decisions-log](../08-meta/decisions-log.md) · [acceptance-criteria](02-acceptance-criteria.md) · [e2e-test-plan](04-e2e-test-plan.md) · [change-checklist](05-change-checklist.md) · [ADR index](../../adr/README.md)

---

## 1. Core Immutable Rules

These three rules govern every change to the PI-Desktop codebase and documentation. They cannot be relaxed by an agent without explicit human override.

### R1 — Spec-first / Spec-sync

> **No behavior change without updating the corresponding spec.**

- Every code, config, or UX change that alters observable behavior must update the relevant `docs/spec/` document before or alongside the change.
- Architectural boundary changes (process model, IPC contract, storage ownership, security boundary) also require an ADR — see `docs/adr/README.md`.
- Pure refactor that preserves behavior and API contracts does not require spec updates, but must still be committed (R2).

### R2 — Commit-per-change

> **Every completed logical change must be git committed.**

- No large uncommitted piles of work. Each logical unit of work — a feature, a fix, a spec update, a chore — gets its own commit.
- Uncommitted work at session end is a violation of this rule.
- If a change is incomplete, either commit it as a draft with a `WIP:` prefix or roll it back.

### R3 — E2E coverage doc

> **Every feature/fix that affects user-visible or protocol-visible behavior must update e2e test documentation.**

- "User-visible": anything the end-user sees or interacts with (UI, CLI output, dialogs, notifications).
- "Protocol-visible": IPC messages, RPC methods, plugin API surfaces, event payloads.
- Document the scenario in `06-delivery/04-e2e-test-plan.md` — even before the automated test exists.
- Internal-only changes (logging format, internal variable rename) do not require e2e doc updates.

---

## 2. Development Loop

Every change follows this sequence. Steps may be iterated if the implementation reveals new requirements.

```
1. Read baseline + relevant specs
2. Plan change + list impacted specs/tests
3. Implement
4. Update specs / ADR / decisions-log if needed
5. Update or add e2e scenarios
6. Run checks (lint, typecheck, tests — when code exists)
7. Commit with conventional message
8. Update BOARD if milestone-related
```

### Step-by-step

| Step | Action | Output |
|---|---|---|
| **1. Read** | Read `00-baseline.md` and any specs relevant to the change area. | Mental model of constraints. |
| **2. Plan** | Describe the intended change. List every spec, ADR, and e2e scenario that will need updates. | Change plan + impact list. |
| **3. Implement** | Write code, config, or assets. | Changed files. |
| **4. Spec-sync** | Update specs per the impact list. Add ADR if architectural. Update `decisions-log.md` if an implementation default changes. | Updated docs/spec/\* and/or docs/adr/\*. |
| **5. E2E doc** | Add or update scenario entries in `04-e2e-test-plan.md`. Link to acceptance criteria IDs (A–H). | Updated e2e test plan. |
| **6. Run checks** | Lint, typecheck, unit tests, build. Skip if only docs changed. | Passing CI (or known skip reason). |
| **7. Commit** | Git commit with conventional message (see §4). | One or more commits. |
| **8. BOARD** | If the change completes a milestone deliverable, update `docs/project/BOARD.md`. | Updated board. |

---

## 3. Spec Update Matrix

Which change types require which doc updates.

| Change type | Spec update | ADR | Decisions-log | E2E doc | BOARD |
|---|---|---|---|---|---|
| New feature (user-visible) | Related domain spec | If architectural boundary | — | New scenario | If milestone deliverable |
| Bug fix (user-visible) | Related spec if behavior clarified | — | — | New or updated scenario | — |
| Bug fix (internal) | — | — | — | — | — |
| Refactor (behavior preserved) | — | — | — | — | — |
| Architectural change | Related specs + baseline | **New ADR** | Update entry if default changes | Update affected scenarios | — |
| New IPC/RPC method | `03-runtime/01-ipc-protocol.md` or `06-host-rpc-protocol.md` | If contract boundary | — | New protocol scenario | — |
| Plugin API addition | `07-plugins/03-plugin-api.md` | If boundary change | — | New plugin scenario | If M4 deliverable |
| Security change | `05-security/01-security.md` | If boundary change | Update if D001–D010 touched | New security scenario | — |
| UX change | Related `04-ux/` spec | — | — | New UI scenario | — |
| Spec-only update | The spec itself | — | — | — | — |
| Chore (deps, tooling) | — | — | If tooling decision | — | — |

---

## 4. Git Commit Rules

### 4.1 Conventional Commits

Format: `type(scope): description`

| Type | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation-only change |
| `test` | Adding or updating tests |
| `chore` | Build, deps, tooling, CI |
| `refactor` | Code restructuring, no behavior change |
| `perf` | Performance improvement |
| `build` | Build system or external dependency change |
| `ci` | CI/CD configuration change |

**Scope** is optional but encouraged — e.g. `feat(host-core):`, `fix(ui):`, `docs(spec):`.

### 4.2 Language

- Commit messages: **English only** (matches baseline language policy).
- Body: optional; use for non-obvious context.

### 4.3 One logical change per commit

- Prefer small, focused commits.
- Spec updates that are tightly coupled to the code change should be in the same commit.
- Pure doc changes (spec rewrite, ADR) may be a separate adjacent `docs:` commit.

### 4.4 Never commit

- Secrets, API keys, tokens, passwords
- Local-only data (user configs, session data, logs)
- `node_modules/`, build artifacts, release packages
- Generated files that should be rebuilt per CI

### 4.5 Pre-commit checklist

Before committing, verify:

1. Change is one logical unit (or clearly split).
2. No secrets or local data in the diff.
3. Specs updated per §3 matrix.
4. E2E doc updated if behavior changed.
5. `git diff --stat` review — nothing unexpected.
6. Commit message follows conventional format.

---

## 5. Branching Model

Lightweight, appropriate for solo / small-team MVP phase.

- **`main`** — always deployable; all completed work merges here.
- **Topic branches** — optional short-lived branches for larger features. Name: `topic/<scope>-<short-description>`. Delete after merge.
- **No long-lived dev branch** — main is the integration target.
- **Rebase or merge** — either is acceptable; prefer merge for traceability.

When the team grows, adopt a more structured model (trunk-based development with PR reviews).

---

## 6. Definition of Done

A change is **Done** when all of the following are true:

1. Code (or doc) implements the planned change.
2. All impacted specs are updated.
3. E2E scenarios are documented (or confirmed not needed per §3).
4. Checks pass (lint, typecheck, tests) — or skip is justified.
5. Change is committed with a conventional message.
6. BOARD updated if milestone deliverable completed.
7. No secrets or local data in the commit.

---

## 7. Forbidden Practices

| Practice | Why |
|---|---|
| Committing secrets | Security violation |
| Large uncommitted diffs | Violates R2; loss of granularity |
| Changing behavior without spec update | Violates R1; specs become unreliable |
| Skipping e2e doc for user-visible changes | Violates R3; traceability gap |
| Modifying baseline frozen decisions without ADR + version bump | Baseline is frozen; changes need formal process |
| Committing generated artifacts that CI should rebuild | Repo bloat, merge conflicts |
| Mixing multiple logical changes in one commit without clear message | Loss of history granularity |

---

## 8. Acceptance Criteria for This Workflow

This workflow spec itself is accepted when:

- [ ] R1/R2/R3 are stated clearly and cross-linked to relevant specs.
- [ ] Development loop is documented and referenced by `AGENTS.md`.
- [ ] Spec update matrix covers all change types in the baseline.
- [ ] Git commit rules match existing repo commit style (`docs:`, `chore:`).
- [ ] Branching model is lightweight and appropriate for solo MVP.
- [ ] Definition of Done is complete and actionable.
- [ ] Forbidden practices list covers known risk areas.
- [ ] `AGENTS.md` points to this doc, `04-e2e-test-plan.md`, and `05-change-checklist.md`.
- [ ] All indexes updated (NAV, delivery README, spec README, docs README, BOARD).
