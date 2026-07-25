# 15. Workspace Ignore Rules

## 1. Goal

Prevent tools from scanning/reading/writing sensitive or useless paths by default, while remaining predictable for coding agents.

## 2. Rule layers (priority high → low)

1. **Security denylist** (always on, not user-disable in MVP)
2. **App defaults** (shipped)
3. **Workspace rules** (`.pi-desktopignore` or settings)
4. **User global ignore** (`~/.pi-desktop/ignore`)
5. Explicit tool path still subject to security denylist

## 3. Security denylist (always)

Deny read/write/search outside workspace root unless future trusted tool policy says otherwise.

Also deny inside workspace for:
- `.git/objects/**` (optional optimize; metadata may be readable later)
- private key patterns: `*.pem`, `*.key`, `id_rsa`, `id_ed25519`
- `.env`, `.env.*` (read may be allowed with permission prompt in later revision; MVP default deny for Grep content export)
- credential files: `*.p12`, `*.pfx`, `credentials.json` (Google), `.npmrc` with tokens (best-effort)

> Exact env-file policy can be relaxed later with explicit permission; fail closed in MVP for content search.

## 4. Default ignore (app)

```gitignore
node_modules/
dist/
build/
.target/
target/
.venv/
venv/
__pycache__/
.pytest_cache/
.mypy_cache/
.DS_Store
*.log
coverage/
.turbo/
.next/
.cache/
```

## 5. Workspace file

Support:

```text
.pi-desktopignore
```

Syntax: gitignore-compatible subset.

## 6. Tool behavior

| tool | ignore application |
|---|---|
| Glob | filtered results |
| Grep | filtered file set |
| Read | hard error if denied |
| Write/Edit | hard error if denied |
| Bash | path sandbox still enforced by host; ignore file does not expand bash powers |

## 7. Diagnostics

Tools should return stable errors:
- `PATH_OUTSIDE_WORKSPACE` — path escapes the workspace root
- `WORKSPACE_PATH_DENIED` — reserved detail code for ignore/denylist blocks
  (maps to `PATH_OUTSIDE_WORKSPACE` today; see [08-error-codes §3.6](08-error-codes.md))

UI can show “hidden by ignore rules” counts for Glob/Grep optionally later.

## 8. Acceptance criteria

- [ ] tools cannot escape workspace root
- [ ] default ignores hide node_modules from Glob/Grep
- [ ] workspace ignore file honored
- [ ] security denylist cannot be disabled from UI in MVP
