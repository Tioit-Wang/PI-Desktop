# Open Questions

> Updated for baseline `0.3.1`.  
> High-priority questions were frozen in `decisions-log.md`.

## Still open (non-blocking for M1)

### Packaging / release
1. Final Node pi sidecar packaging format for release builds (bundled Node vs single-binary approach)
2. Code signing / notarization operational setup for macOS distribution
3. Auto-update channel design (post-MVP)

### Marketplace (post-MVP)
1. Official marketplace domain and provider IDs
2. Whether third-party sources are enabled by default
3. Private source auth: token header vs mTLS
4. Whether `.zip` remains accepted beside `.piplug`

### Plugin advanced policy
1. When to enforce strict separate-process plugin runtime (M4 vs later)
2. Whether future plugin settings may include secret fields under special storage
3. Optional “keep data on uninstall” UX copy/defaults beyond hard default delete

### Product polish
1. Exact app icon / brand system
2. Whether first-run onboarding is modal wizard or inline checklist
3. Timeline for additional locales (e.g. zh-CN)

## Decision rules

- D001–D020 style decisions go into `decisions-log.md`
- Architecture boundary changes require ADR
- Non-blocking polish can remain here until implementation nears
