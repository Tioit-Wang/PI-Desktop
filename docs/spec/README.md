# PI-Desktop Spec

> Baseline: `0.3.0` 
> Updated: `2026-07-25` 
> Language: **English-first** 
> Stack: Electron + **Rust host core** + pi Agent Harness + user-installable plugins

## Quick entry

| Doc | Description |
|---|---|
| [NAV.md](NAV.md) | One-page full navigation |
| [00-baseline.md](00-baseline.md) | Frozen baseline |
| [01-product/00-overview.md](01-product/00-overview.md) | Overview |
| [02-architecture/01-architecture.md](02-architecture/01-architecture.md) | Architecture |
| [03-runtime/05-host-core-rust.md](03-runtime/05-host-core-rust.md) | Rust host core |
| [04-ux/02-i18n-english-first.md](04-ux/02-i18n-english-first.md) | i18n policy |
| [07-plugins/01-plugin-system.md](07-plugins/01-plugin-system.md) | Plugin system |

## Directory map

```text
docs/spec/
├── 00-baseline.md
├── 01-product/
├── 02-architecture/
├── 03-runtime/
├── 04-ux/
├── 05-security/
├── 06-delivery/
├── 07-plugins/
└── 08-meta/
```

## Reading paths

### Product
1. `00-baseline.md`
2. `01-product/00-overview.md`
3. `01-product/01-product-scope.md`
4. `06-delivery/01-mvp-milestones.md`

### Implementation
1. `00-baseline.md`
2. `02-architecture/01-architecture.md`
3. `03-runtime/05-host-core-rust.md`
4. `03-runtime/02-agent-runtime.md`
5. `03-runtime/01-ipc-protocol.md`
6. `07-plugins/01-plugin-system.md`

### Plugin authors
1. `07-plugins/01-plugin-system.md`
2. `07-plugins/02-plugin-manifest-schema.md`
3. `07-plugins/03-plugin-api.md`
4. `07-plugins/10-plugin-devex.md`
5. `examples/plugins/hello`

## Frozen decisions (short)

1. Electron shell
2. English-first product/docs
3. Rust host backend core
4. pi agent engine in Node sidecar
5. Local-first coding agent MVP
6. user-installable plugins (market later)
