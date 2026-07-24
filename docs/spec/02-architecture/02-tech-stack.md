# 02. Tech Stack

## 1. Stack table

| Layer | Tech | Baseline | Notes |
|---|---|---|---|
| Desktop shell | Electron | latest stable (pin at impl) | app shell |
| UI | React 19 + TypeScript | modern stable | English-first UI |
| Bundler | electron-vite / Vite | stable | multi-entry build |
| Styling | Tailwind CSS 4 | stable | utility-first |
| State | Zustand | stable | UI state |
| i18n | i18next (or equivalent) | stable | English source locale |
| Host backend | **Rust** | stable Rust toolchain | tools/plugins/permissions/persistence adapters |
| Rust async | tokio | stable | host services |
| Host RPC | JSON-RPC or protobuf over stdio | decide in M1 | Electron/Rust/Node bridge |
| Agent engine | `@earendil-works/pi-agent-core` | ^0.82+ | agent loop |
| Model API | `@earendil-works/pi-ai` | ^0.82+ | providers |
| Node runtime | Node.js | `>= 22.19` | pi requirement |
| DB | SQLite | via Rust and/or node adapter | sessions/settings |
| Packaging | electron-builder | stable | macOS first |
| Package manager | pnpm | 10.x | JS monorepo |
| Lint/test | biome/oxlint + vitest + cargo test | stable | dual stack quality |

## 2. Language policy in engineering

- Product strings: English source
- Specs/ADRs: English primary
- Code identifiers: English
- Commits/issues/PRs: English preferred

## 3. Why Rust host core

- stronger sandboxing foundation
- better process/fs control
- long-term native performance and safety
- cleaner privilege separation from UI and model runtime

## 4. Why keep pi in Node/TS

- mature multi-provider support
- existing agent event model
- skills/extensions ecosystem leverage
- avoid rewriting agent framework

## 5. Dependency boundaries

### Allowed
- official pi packages
- mainstream Electron/React ecosystem
- Rust crates for fs/process/sqlite/rpc/serde

### Careful
- heavy native node addons
- multiple competing RPC frameworks
- large editor stacks too early (Monaco)

### Not in MVP
- remote gateway frameworks
- marketplace backend
- custom LLM provider SDK replacing pi-ai

## 6. Build matrix (MVP)

- JS workspace build (`pnpm`)
- Rust host build (`cargo`)
- integration smoke (`pnpm dev` boots all layers)
