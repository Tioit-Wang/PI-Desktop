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

### Ready
- M1 App Skeleton
- M1 Plugin interface stubs
- M1 Rust host-core skeleton

### Backlog
- M2 Pi Chat Runtime
- M3 Workspace Tools
- M4 Plugin Foundation
- M5 Desktop Hardening

## Milestone links

- [M1 App Skeleton](https://github.com/vastsa/PI-Desktop/milestone/2)
- [M2 Pi Chat Runtime](https://github.com/vastsa/PI-Desktop/milestone/3)
- [M3 Workspace Tools](https://github.com/vastsa/PI-Desktop/milestone/4)
- [M4 Plugin Foundation](https://github.com/vastsa/PI-Desktop/milestone/5)
- [M5 Desktop Hardening](https://github.com/vastsa/PI-Desktop/milestone/6)

## Upgrade to GitHub Projects later

```bash
gh auth refresh -s read:project,project
gh project create --owner vastsa --title "PI-Desktop Roadmap"
```
