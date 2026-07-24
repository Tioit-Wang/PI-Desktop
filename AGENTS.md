# AGENTS.md — Rules for AI Coding Agents

Concise, mandatory rules for any AI agent working in this repository.

## Language

- **English only** for commits, specs, code identifiers, and comments.
- Match the repo's existing English-first policy ([baseline](docs/spec/00-baseline.md)).

## Three Immutable Rules

### 1. Spec-sync

Every behavior change must update the corresponding `docs/spec/` document. Architectural boundary changes also need an ADR (`docs/adr/`).

→ [03-ai-development-workflow.md §R1](docs/spec/06-delivery/03-ai-development-workflow.md#1-core-immutable-rules)

### 2. Commit-per-change

Every completed logical change must be git committed. No large uncommitted piles.

→ [03-ai-development-workflow.md §R2](docs/spec/06-delivery/03-ai-development-workflow.md#1-core-immutable-rules)

### 3. E2E doc update

Every user-visible or protocol-visible behavior change must add or update a scenario in the e2e test plan.

→ [04-e2e-test-plan.md](docs/spec/06-delivery/04-e2e-test-plan.md)

## Development Loop

1. Read baseline + relevant specs
2. Plan change + list impacted specs/tests
3. Implement
4. Update specs / ADR / decisions-log
5. Update or add e2e scenarios
6. Run checks (lint, typecheck, tests)
7. Commit with conventional message
8. Update BOARD if milestone-related

→ [03-ai-development-workflow.md §2](docs/spec/06-delivery/03-ai-development-workflow.md#2-development-loop)

## Commit Format

```
type(scope): description
```

Types: `feat` `fix` `docs` `test` `chore` `refactor` `perf` `build` `ci`

English messages only. One logical change per commit.

→ [03-ai-development-workflow.md §4](docs/spec/06-delivery/03-ai-development-workflow.md#4-git-commit-rules)

## Before Finishing Work

Run the [change checklist](docs/spec/06-delivery/05-change-checklist.md):

- [ ] Impact analysis done
- [ ] Specs updated per matrix
- [ ] E2E doc updated if behavior changed
- [ ] No secrets / local data in diff
- [ ] Conventional commit message
- [ ] All Definition-of-Done gates pass

## Key References

| Doc | Path |
|---|---|
| Baseline | `docs/spec/00-baseline.md` |
| Spec index | `docs/spec/README.md` |
| Decisions log | `docs/spec/08-meta/decisions-log.md` |
| AI dev workflow | `docs/spec/06-delivery/03-ai-development-workflow.md` |
| E2E test plan | `docs/spec/06-delivery/04-e2e-test-plan.md` |
| Change checklist | `docs/spec/06-delivery/05-change-checklist.md` |
| ADR index | `docs/adr/README.md` |
| Project board | `docs/project/BOARD.md` |

## Never Do

- Commit secrets, API keys, or tokens
- Leave large uncommitted diffs at session end
- Change behavior without updating specs
- Skip e2e doc for user-visible changes
- Modify frozen baseline decisions without ADR + version bump
