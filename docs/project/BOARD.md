# PI-Desktop Project Board

GitHub Projects requires additional token scopes (`project`).
Until that is enabled, track delivery with:

- GitHub Issues
- Milestones
- this board document

## Columns

| Column | Meaning |
|---|---|
| Backlog | Logged, not started |
| Ready | Ready to implement |
| In Progress | Active work |
| Review | Waiting validation |
| Done | Completed |

## Status snapshot (2026-07-25)

| Milestone | GitHub | Local status |
|---|---|---|
| M0 Spec Freeze | [closed](https://github.com/vastsa/PI-Desktop/milestone/1) | Done |
| M1 App Skeleton | [closed](https://github.com/vastsa/PI-Desktop/milestone/2) | Done |
| M2 Pi Chat Runtime | [closed](https://github.com/vastsa/PI-Desktop/milestone/3) | Done |
| M3 Workspace Tools | [closed](https://github.com/vastsa/PI-Desktop/milestone/4) | Done |
| M4 Plugin Foundation | [closed](https://github.com/vastsa/PI-Desktop/milestone/5) | Done |
| M5 Desktop Hardening | [open](https://github.com/vastsa/PI-Desktop/milestone/6) | In Progress |

Open issue:
- [#6 M5: Packaging and desktop hardening](https://github.com/vastsa/PI-Desktop/issues/6)

## Swimlanes

### Done
- M0 Spec Freeze
- English-first policy
- Rust host-core architecture decision
- Private repo initialization
- UX design system spec (07/08/09)
- AI development workflow spec (03)
- E2E test plan spec (04)
- Change checklist spec (05)
- AGENTS.md agent instruction file
- M1 App Skeleton (pnpm monorepo, Electron, host-core health, i18n)
- M2 Pi Chat Runtime (provider/secrets, streaming chat, session persistence)
- M3 Workspace Tools (Read/Glob/Grep/Write/Edit/Bash, permissions, path sandbox)
- M4 Plugin Foundation (dev load, command palette, plugin tool registration)
- M5 packaging scaffold (electron-builder macOS arm64 `--dir`, host/sidecar resources)

### In Progress
- M5 polish for first macOS arm64 package
  - code signing
  - custom app icon
  - full DMG notarization
  - final isolation / logging hardening pass as needed

### Backlog
- Playwright automated desktop e2e
- Marketplace
- Windows/Linux packaging
- Skills depth / MCP / additional locales (post-MVP)

## Validation snapshot (2026-07-25)

- `cargo test -p host-core` — pass
- `pnpm --filter @pi-desktop/shared test` — pass
- `node scripts/e2e-smoke.mjs` — 15/15 pass (with live model)
- `node scripts/e2e-agent-live.mjs` — pass (streaming assistant)
- Electron boot smoke — host + sidecar host-proxy mode OK

## Upgrade to GitHub Projects later

```bash
gh auth refresh -s read:project,project
gh project create --owner vastsa --title "PI-Desktop Roadmap"
```
