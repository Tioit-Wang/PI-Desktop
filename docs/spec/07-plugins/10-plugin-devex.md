# 10. Plugin Developer Experience

## 1. Goals

Let a developer create and load a local plugin within 10 minutes.

## 2. Developer path

```text
Create template
 → edit manifest / main / panel
 → Load Development Plugin in PI-Desktop
 → verify in the command palette
 → pack piplug
```

## 3. Template types

Official templates (provided later):

1. `panel-basic`: panel + commands only
2. `agent-tool-basic`: register a tool
3. `skill-pack`: skills only
4. `full-demo`: panel + tool + skill + settings

Current repo example:
- `examples/plugins/hello`

## 4. SDK plan

Suggested package name: `@pi-desktop/plugin-sdk`

Provides:
- manifest types
- permission enums
- API types (`PiPluginHostApi`)
- manifest validation function
- test helper (mock host)

## 5. Local development commands (planned)

```bash
# validate manifest
pnpm pi-plugin check .

# pack
pnpm pi-plugin pack .

# outputs dist/demo.hello-0.1.0.piplug
```

## 6. Hot reload

Development mode supports watch:

- manifest changed: re-validate + reload
- main changed: reload runtime
- renderer changed: refresh panel

On failure the UI shows load_error without crashing the host.

## 7. Debugging

Minimum requirements:
- Plugin log panel (filter by pluginId)
- View registered commands/tools
- Copy error stack traces

Later:
- Dedicated DevTools for the panel
- mock tool invoker

## 8. Documentation checklist (developer site / repo docs)

- Quick start
- manifest fields
- Permission reference
- API manual
- Publishing manual (pack/sign)
- Security best practices

## 9. Quality gate (recommended before publishing)

- manifest validation passes
- No calls to undeclared permissions
- Has a README
- Has a version changelog
- If it includes a tool: provide parameter examples

## 10. Acceptance

1. A new plugin can be copied from the hello example
2. Development load succeeds
3. Reload works after code changes
4. The pack artifact can be installed
