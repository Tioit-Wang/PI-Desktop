# PI-Desktop

Local-first AI coding agent desktop client.

**Electron shell + Rust host core + pi Agent Harness + plugin system.**

## Current status

This repository currently contains the **baseline specification and architecture decisions**.

- Specs: `docs/spec/`
- ADRs: `docs/adr/`
- Example plugin: `examples/plugins/hello`

Baseline: **`0.3.2`**

## Key decisions

| Area | Choice |
|---|---|
| Desktop shell | Electron |
| UI | React + TypeScript + Vite + Tailwind |
| Default language | English (i18n-ready) |
| Host backend | Rust |
| Agent engine | pi (`pi-ai` + `pi-agent-core`) |
| Agent placement | Node sidecar |
| Extensions | user-installable plugins |
| Host RPC | stdio JSON-RPC (NDJSON) |
| DB owner | Rust host-core |
| Default mode | Agent (Chat read-only) |
| First release | macOS arm64 |
| Marketplace | Postponed (protocol only) |

## Docs

Start here:

1. [Baseline](docs/spec/00-baseline.md)
2. [Spec index](docs/spec/README.md)
3. [Architecture](docs/spec/02-architecture/01-architecture.md)
4. [Rust host core](docs/spec/03-runtime/05-host-core-rust.md)
5. [Plugin system](docs/spec/07-plugins/01-plugin-system.md)
6. [Milestones](docs/spec/06-delivery/01-mvp-milestones.md)
7. [AI dev workflow](docs/spec/06-delivery/03-ai-development-workflow.md)
8. [E2E test plan](docs/spec/06-delivery/04-e2e-test-plan.md)

Agent instructions: [AGENTS.md](AGENTS.md)

## Repo layout

```text
PI-Desktop/
├── apps/ # Electron app (to implement)
├── crates/ # Rust host-core (to implement)
├── packages/ # shared TS packages (to implement)
├── examples/plugins/ # sample plugins
├── docs/spec/ # product/architecture specs
├── docs/adr/ # architecture decision records
└── scripts/
```

## Development status

- [x] Baseline specs
- [x] Plugin system specs
- [x] English-first policy
- [x] Rust host-core architecture
- [x] Private GitHub repository
- [ ] M1 app skeleton
- [ ] M2 pi chat runtime
- [ ] M3 workspace tools
- [ ] M4 plugin foundation
- [ ] M5 packaging/hardening

## Principles

1. pi is the agent engine; PI-Desktop is the product shell
2. Rust owns privileged host capabilities
3. Renderer is unprivileged
4. English is the source language
5. Plugins are powerful but default-deny
6. Local-first MVP before remote/control-plane features

## License

TBD
