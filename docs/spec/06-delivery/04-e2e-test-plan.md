# 04. E2E Test Plan

> Scope: MVP acceptance scenarios for PI-Desktop  
> Status: Accepted (protocol automation started; full desktop Playwright deferred to M5+)  
> Cross-references: [acceptance-criteria](02-acceptance-criteria.md) · [milestones](01-mvp-milestones.md) · [ai-development-workflow](03-ai-development-workflow.md) · [change-checklist](05-change-checklist.md)

---

## 1. Goals

- Document every user-visible and protocol-visible behavior that MVP must verify.
- Provide a scenario catalog that maps to acceptance criteria (A–H) and milestones (M1–M5).
- Serve as the traceability backbone: scenario ID ↔ acceptance criterion ↔ spec.
- Prepare for future automation without requiring implementation now.

## 2. Non-goals

- Full automated test suite in MVP phase (document scenarios first; automate later).
- Performance / stress testing (post-MVP).
- Cross-platform testing (macOS arm64 only for first release — D010).
- Plugin marketplace scenarios (post-MVP).
- Remote gateway / control-plane scenarios (post-MVP — D004).

---

## 3. Test Pyramid

```
        ╱  E2E  ╲           — few, high-value, cross-system
       ╱ Integration ╲      — IPC/RPC contracts, host↔renderer
      ╱    Unit       ╲     — per-module, fast, isolated
```

| Level | Scope | Count target | Tooling |
|---|---|---|---|
| **Unit** | Single module, no IPC | Many | Vitest / Rust #[test] |
| **Integration** | IPC contract, host↔renderer, host↔sidecar | Moderate | Vitest + IPC mocks or live Electron |
| **E2E** | Full user journey through the desktop app | Few (MVP: ~20) | Playwright / Spectron-like (future) |

**Strategy**: document all E2E scenarios now; write unit/integration tests alongside code; automate E2E after M5.

---

## 4. Tooling Intent

| Tool | Purpose | Status |
|---|---|---|
| **Vitest** | Unit + integration (TS side) | Planned (M1) |
| **Rust #[test]** | Host-core unit tests | Planned (M1) |
| **Playwright** | E2E browser-style testing in Electron | Planned (post-M5) |
| **Spectron-like** | Electron-specific app-level testing | Investigate (post-M5) |

> Decision: document scenarios now; pick concrete E2E runner when code is ready for M5 hardening.

---

## 5. Environment Requirements

| Requirement | Detail |
|---|---|
| Platform | macOS arm64 (D010) |
| Profile | Clean `~/.pi-desktop` profile (no prior config) |
| Fixtures | Sample project directory (`examples/fixtures/sample-project/`) |
| Sample plugin | `examples/plugins/hello` loaded from local path |
| Provider | At least one provider with a valid key (test account) |
| Display | Headless-capable Electron or real display |

---

## 6. Scenario Template

Each scenario is documented in this format:

```markdown
### E2E-<ID>: <title>

- **Preconditions**: what must be true before steps start
- **Steps**: ordered list of user / system actions
- **Expected**: observable outcome that proves correctness
- **Specs linked**: relevant spec file(s)
- **Acceptance criterion**: which A–H letter(s) this verifies
- **Milestone**: M1–M5 target
- **Status**: Draft | Documented | Automated | Passed
```

---

## 7. MVP Scenario Catalog

### Boot & Healthcheck

#### E2E-001: App launches and shows main window

- **Preconditions**: macOS arm64; no prior `~/.pi-desktop` profile.
- **Steps**: 1) Launch PI-Desktop. 2) Observe main window appears.
- **Expected**: Window renders in English; no crash; version info visible.
- **Specs linked**: `03-runtime/07-process-model.md`, `04-ux/01-ui-ia.md`
- **Acceptance**: A (app startup)
- **Milestone**: M1
- **Status**: Draft

#### E2E-002: IPC bridge is functional

- **Preconditions**: App is running.
- **Steps**: 1) Trigger an action that calls preload IPC (e.g. version query). 2) Observe result in renderer.
- **Expected**: Main↔renderer IPC returns expected data; no error.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`
- **Acceptance**: A (bridge normal)
- **Milestone**: M1
- **Status**: Automated (`scripts/e2e-electron-boot.mjs` — sandboxed preload bridge + IPC round-trip)

#### E2E-003: Rust host healthcheck responds

- **Preconditions**: App is running; Rust host-core sidecar started.
- **Steps**: 1) Electron calls host healthcheck RPC. 2) Observe response in logs.
- **Expected**: Host returns `ok` with protocol version; handshake logged.
- **Specs linked**: `03-runtime/05-host-core-rust.md`, `03-runtime/06-host-rpc-protocol.md`
- **Acceptance**: A (bridge normal)
- **Milestone**: M1
- **Status**: Automated (protocol smoke)

#### E2E-004: First-run inline checklist appears

- **Preconditions**: Fresh profile (no `~/.pi-desktop`).
- **Steps**: 1) Launch app on fresh profile. 2) Observe onboarding checklist.
- **Expected**: Inline checklist is displayed; items are actionable.
- **Specs linked**: `04-ux/05-onboarding.md`
- **Acceptance**: A (first-run checklist)
- **Milestone**: M2
- **Status**: Draft

### Provider & Key

#### E2E-005: Add a provider and save API key

- **Preconditions**: App running; no provider configured.
- **Steps**: 1) Open settings. 2) Add a provider. 3) Enter API key. 4) Save.
- **Expected**: Provider appears in list; key stored securely (not in plaintext config).
- **Specs linked**: `03-runtime/12-provider-config-schema.md`, `03-runtime/14-secrets-storage.md`
- **Acceptance**: B (add provider, save key)
- **Milestone**: M2
- **Status**: Draft

#### E2E-006: Key survives restart

- **Preconditions**: Provider + key configured.
- **Steps**: 1) Quit app. 2) Relaunch. 3) Open settings → provider list.
- **Expected**: Provider still listed; key usable (no re-entry needed).
- **Specs linked**: `03-runtime/14-secrets-storage.md`
- **Acceptance**: B (key survives restart)
- **Milestone**: M2
- **Status**: Draft

#### E2E-007: No-provider blocking prompt

- **Preconditions**: App running; no provider configured.
- **Steps**: 1) Attempt to start a chat.
- **Expected**: Clear blocking prompt explaining that a provider must be configured.
- **Specs linked**: `04-ux/06-settings-ia.md`
- **Acceptance**: B (blocking prompt)
- **Milestone**: M2
- **Status**: Draft

### Chat Stream & Abort

#### E2E-008: New session and send message

- **Preconditions**: Provider configured.
- **Steps**: 1) Create new session. 2) Type a message. 3) Send.
- **Expected**: Message sent; assistant begins streaming response.
- **Specs linked**: `03-runtime/02-agent-runtime.md`, `03-runtime/10-session-state-machine.md`
- **Acceptance**: C (new session, send message)
- **Milestone**: M2
- **Status**: Draft

#### E2E-009: Streamed tokens visible in UI

- **Preconditions**: Session active; message sent.
- **Steps**: 1) Observe assistant response as it streams.
- **Expected**: Tokens appear progressively in chat UI; final response complete.
- **Specs linked**: `03-runtime/02-agent-runtime.md`
- **Acceptance**: C (streamed output)
- **Milestone**: M2
- **Status**: Draft

#### E2E-010: Abort generation

- **Preconditions**: Assistant is streaming a response.
- **Steps**: 1) Click abort/stop button during streaming. 2) Observe result.
- **Expected**: Stream stops; partial response preserved; session remains usable.
- **Specs linked**: `03-runtime/02-agent-runtime.md`
- **Acceptance**: C (abort)
- **Milestone**: M2
- **Status**: Draft

#### E2E-011: Switch between history sessions

- **Preconditions**: Two or more sessions exist.
- **Steps**: 1) Switch to a different session in history. 2) Observe chat content.
- **Expected**: Previous session content loads; current session preserved.
- **Specs linked**: `03-runtime/10-session-state-machine.md`
- **Acceptance**: C (switch sessions)
- **Milestone**: M2
- **Status**: Draft

### Workspace Open

#### E2E-012: Open a project directory

- **Preconditions**: App running; no project open.
- **Steps**: 1) Open project directory via UI. 2) Select a local folder.
- **Expected**: Project path displayed; tool paths resolve relative to project root.
- **Specs linked**: `03-runtime/15-workspace-ignore-rules.md`
- **Acceptance**: D (open project, show path)
- **Milestone**: M3
- **Status**: Draft

#### E2E-013: Read-only tools work in project

- **Preconditions**: Project directory open.
- **Steps**: 1) Ask agent to read a file in the project. 2) Observe result.
- **Expected**: `Read`/`Glob`/`Grep` return correct results within project scope.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (Read/Glob/Grep work), D (tools based on project)
- **Milestone**: M3
- **Status**: Draft

### Permission Allow / Deny / Timeout

#### E2E-014: Write/Edit/Bash triggers permission card

- **Preconditions**: Agent mode; project open.
- **Steps**: 1) Ask agent to write a file. 2) Observe permission card.
- **Expected**: Permission card appears with tool name, arguments preview, and allow/deny options.
- **Specs linked**: `04-ux/03-permission-ux.md`, `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (Write/Edit/Bash trigger confirmation)
- **Milestone**: M3
- **Status**: Draft

#### E2E-015: Denied permission blocks execution

- **Preconditions**: Permission card displayed.
- **Steps**: 1) Click deny on permission card. 2) Observe agent response.
- **Expected**: Tool not executed; agent receives denied result; no file changed.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (denied → not executed)
- **Milestone**: M3
- **Status**: Draft

#### E2E-016: Allowed permission executes tool

- **Preconditions**: Permission card displayed.
- **Steps**: 1) Click allow on permission card. 2) Observe agent response and UI.
- **Expected**: Tool executed; result returned to model and displayed in UI; file modified.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (allowed → result returned)
- **Milestone**: M3
- **Status**: Draft

#### E2E-017: Permission timeout defaults to deny

- **Preconditions**: Permission card displayed; no user action.
- **Steps**: 1) Wait 120 seconds without responding to permission card. 2) Observe outcome.
- **Expected**: Permission auto-denied after timeout; tool not executed.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (timeout → deny)
- **Milestone**: M3
- **Status**: Draft

#### E2E-018: Chat mode cannot run Write/Edit/Bash

- **Preconditions**: Chat mode active.
- **Steps**: 1) Ask agent to write a file in Chat mode. 2) Observe behavior.
- **Expected**: Write/Edit/Bash not available in Chat mode; only Read/Glob/Grep work.
- **Specs linked**: `03-runtime/03-tools-and-permissions.md`
- **Acceptance**: E (Chat read-only)
- **Milestone**: M3
- **Status**: Draft

#### E2E-019: Workspace-outside paths are rejected

- **Preconditions**: Agent mode; project open.
- **Steps**: 1) Ask agent to read a file outside the project root. 2) Observe result.
- **Expected**: Tool rejects out-of-scope path; no data returned from outside workspace.
- **Specs linked**: `03-runtime/15-workspace-ignore-rules.md`
- **Acceptance**: E (workspace-outside rejected)
- **Milestone**: M3
- **Status**: Draft

### Session Persistence

#### E2E-020: Session survives restart

- **Preconditions**: Session with message history exists.
- **Steps**: 1) Quit app. 2) Relaunch. 3) Open session list.
- **Expected**: Previous session appears; messages recoverable.
- **Specs linked**: `03-runtime/04-data-storage.md`, `03-runtime/10-session-state-machine.md`
- **Acceptance**: F (session survives restart)
- **Milestone**: M2
- **Status**: Draft

#### E2E-021: Delete session works

- **Preconditions**: Session exists.
- **Steps**: 1) Delete a session. 2) Observe session list.
- **Expected**: Session removed from list; data gone.
- **Specs linked**: `03-runtime/04-data-storage.md`
- **Acceptance**: F (delete session)
- **Milestone**: M2
- **Status**: Draft

### Plugin Load / Command / Disable

#### E2E-022: Load local plugin

- **Preconditions**: App running; sample plugin available at local path.
- **Steps**: 1) Open settings → plugins. 2) Add plugin from local directory. 3) Enable.
- **Expected**: Plugin loads; manifest validated; contributions registered.
- **Specs linked**: `07-plugins/01-plugin-system.md`, `07-plugins/05-plugin-lifecycle.md`
- **Acceptance**: G (load local plugin)
- **Milestone**: M4
- **Status**: Draft

#### E2E-023: Plugin command in palette and executes

- **Preconditions**: Plugin loaded and enabled.
- **Steps**: 1) Open command palette. 2) Find plugin command. 3) Execute.
- **Expected**: Command appears in palette; execution produces expected result.
- **Specs linked**: `07-plugins/09-plugin-command-palette.md`
- **Acceptance**: G (plugin command appears and executes)
- **Milestone**: M4
- **Status**: Draft

#### E2E-024: Plugin registers and calls agent tool

- **Preconditions**: Plugin loaded; plugin declares an agent tool.
- **Steps**: 1) Ask agent to use the plugin's tool. 2) Observe permission card if required. 3) Allow.
- **Expected**: Tool registered with forced prefix (`plugin_<id>_<name>`); call succeeds.
- **Specs linked**: `07-plugins/03-plugin-api.md`, `07-plugins/13-plugin-permissions-matrix.md`
- **Acceptance**: G (plugin agent tool)
- **Milestone**: M4
- **Status**: Draft

#### E2E-025: Disable plugin removes contributions

- **Preconditions**: Plugin enabled and contributions visible.
- **Steps**: 1) Disable plugin in settings. 2) Check command palette and agent tools.
- **Expected**: Commands and tools disappear; no leftover contributions.
- **Specs linked**: `07-plugins/05-plugin-lifecycle.md`
- **Acceptance**: G (disable removes contributions)
- **Milestone**: M4
- **Status**: Draft

#### E2E-026: Plugin error does not crash app

- **Preconditions**: Plugin loaded.
- **Steps**: 1) Trigger a scenario where plugin throws an error. 2) Observe app behavior.
- **Expected**: App remains running; error is captured and reported; no crash.
- **Specs linked**: `07-plugins/04-plugin-security.md`
- **Acceptance**: G (plugin error → no crash)
- **Milestone**: M4
- **Status**: Draft

### Security — No Secret Leakage

#### E2E-027: Secrets not in logs for normal flows

- **Preconditions**: Provider configured with API key.
- **Steps**: 1) Perform a chat session. 2) Inspect log files.
- **Expected**: API keys / tokens not present in any log output for normal flows.
- **Specs linked**: `05-security/01-security.md`, `03-runtime/09-logging-and-observability.md`
- **Acceptance**: H (secrets not in logs)
- **Milestone**: M2
- **Status**: Draft

#### E2E-028: Renderer has no Node integration

- **Preconditions**: App running.
- **Steps**: 1) Inspect renderer process flags.
- **Expected**: `nodeIntegration: false`; `contextIsolation: true`; preload is the only bridge.
- **Specs linked**: `05-security/01-security.md`
- **Acceptance**: Security (no Node in renderer)
- **Milestone**: M1
- **Status**: Draft

#### E2E-029: Unwhitelisted IPC cannot be called

- **Preconditions**: App running.
- **Steps**: 1) Attempt to invoke an IPC method not on the whitelist from renderer.
- **Expected**: Call blocked; no data returned; error or no response.
- **Specs linked**: `03-runtime/01-ipc-protocol.md`, `05-security/01-security.md`
- **Acceptance**: Security (IPC whitelist enforced)
- **Milestone**: M1
- **Status**: Draft

#### E2E-030: Plugin cannot read API key

- **Preconditions**: Plugin loaded; provider configured.
- **Steps**: 1) Plugin attempts to access provider secret via any API. 2) Observe result.
- **Expected**: Access denied; no secret data returned to plugin.
- **Specs linked**: `07-plugins/04-plugin-security.md`, `03-runtime/14-secrets-storage.md`
- **Acceptance**: Security (plugin cannot read API key)
- **Milestone**: M4
- **Status**: Draft

#### E2E-031: Error codes are stable and readable

- **Preconditions**: Trigger an error condition.
- **Steps**: 1) Cause a known error (e.g. invalid provider key). 2) Observe error display.
- **Expected**: Error shows a stable `AppError` code; human-readable message present.
- **Specs linked**: `03-runtime/08-error-codes.md`
- **Acceptance**: H (errors expose stable codes)
- **Milestone**: M2
- **Status**: Draft

### Hardening (M5)

#### E2E-032: Backend crash triggers supervised restart

- **Preconditions**: App running; host-core and sidecar healthy.
- **Steps**: 1) Kill the host-core (or sidecar) process externally. 2) Observe app behavior.
- **Expected**: In-flight RPCs fail fast (no long hang); `hostStatus` shows degraded then restored; child restarts with backoff; after 3 failed restarts in 2 minutes the app stays degraded with a visible fatal status.
- **Specs linked**: `03-runtime/07-process-model.md`
- **Acceptance**: Quality (main path no crash)
- **Milestone**: M5
- **Status**: Documented

#### E2E-033: Window bounds persist across restart

- **Preconditions**: App running with default window size.
- **Steps**: 1) Resize/move the window to a distinct valid size (≥960×640). 2) Quit. 3) Relaunch.
- **Expected**: Window restores at the saved bounds; invalid/tiny saved bounds fall back to the 1200×800 default.
- **Specs linked**: `04-ux/09-interaction-patterns.md`
- **Acceptance**: Quality (key operations feel polished)
- **Milestone**: M5
- **Status**: Documented

#### E2E-034: NDJSON log files are written and redacted

- **Preconditions**: Fresh profile; provider configured; one chat turn completed.
- **Steps**: 1) Run a prompt with a tool call. 2) Open `~/.pi-desktop/logs/`. 3) Inspect `app.log`, `host.log`, `agent.log`.
- **Expected**: NDJSON records exist with `ts/level/channel/message`; tool start/end carry `sessionId`/`toolCallId`; no API key material appears; files rotate at 5 MB.
- **Specs linked**: `03-runtime/09-logging-and-observability.md`
- **Acceptance**: H (diagnostics)
- **Milestone**: M5
- **Status**: Documented

---

## 8. Traceability Matrix

| Acceptance | Scenarios |
|---|---|
| A — App startup | E2E-001, E2E-002, E2E-003, E2E-004 |
| B — Model config | E2E-005, E2E-006, E2E-007 |
| C — Chat & stream | E2E-008, E2E-009, E2E-010, E2E-011 |
| D — Workspace | E2E-012, E2E-013 |
| E — Tools & permissions | E2E-014, E2E-015, E2E-016, E2E-017, E2E-018, E2E-019 |
| F — Persistence | E2E-020, E2E-021 |
| G — Plugins | E2E-022, E2E-023, E2E-024, E2E-025, E2E-026 |
| H — Diagnostics | E2E-027, E2E-031, E2E-034 |
| Security | E2E-028, E2E-029, E2E-030 |

| Milestone | Scenarios |
|---|---|
| M1 | E2E-001, E2E-002, E2E-003, E2E-028, E2E-029 |
| M2 | E2E-004, E2E-005, E2E-006, E2E-007, E2E-008, E2E-009, E2E-010, E2E-011, E2E-020, E2E-021, E2E-027, E2E-031 |
| M3 | E2E-012, E2E-013, E2E-014, E2E-015, E2E-016, E2E-017, E2E-018, E2E-019 |
| M4 | E2E-022, E2E-023, E2E-024, E2E-025, E2E-026, E2E-030 |
| M5 | E2E-032, E2E-033, E2E-034 (+ packaging scenarios in release runbook) |

---

## 9. How AI Must Update This Doc

When adding or changing a feature that affects user-visible or protocol-visible behavior:

1. **Add a new scenario** using the template in §6. Assign the next available ID (`E2E-<N>`).
2. **Link it** to the relevant acceptance criterion (A–H) and milestone (M1–M5).
3. **Set status** to `Draft` unless an automated test already exists.
4. **Update the traceability matrix** in §8.
5. **Commit** the update as part of the change (per [ai-development-workflow](03-ai-development-workflow.md) R3).

---

## 10. Future Automation Mapping

When E2E automation is implemented (post-M5):

- Each `Draft` scenario → Playwright test file.
- Scenario ID becomes test case name: `e2e-001-app-launches`.
- Fixtures and test data paths defined in a `tests/e2e/fixtures/` directory.
- CI gate: all E2E scenarios must pass before release.

Automation section will be expanded in a future ADR when the tooling decision is finalized.

---

## 11. Acceptance Criteria

This test plan spec is accepted when:

- [ ] All MVP acceptance criteria (A–H) have at least one E2E scenario.
- [ ] All security acceptance items have at least one E2E scenario.
- [ ] Every scenario links to at least one spec document.
- [ ] Traceability matrix is complete (scenarios ↔ acceptance ↔ milestones).
- [ ] Scenario template is defined and all entries follow it.
- [ ] AI update rules are documented and cross-linked to workflow spec.
- [ ] Environment requirements match baseline (macOS arm64, clean profile).

## UI shell visual scenarios

### US-UI-01 Codex-aligned shell chrome
- Open the desktop app on macOS dark theme.
- Expect charcoal main surface (`#181818`), left sidebar with New task + Recent tasks, and a floating bottom composer with project/model chips.
- Expect no blue-slate marketing chrome; primary send control is a circular inverted button.

### US-UI-02 Empty thread hero
- Open or create a thread with zero messages.
- Expect centered hero copy: "What should we build" with optional project name underline when a workspace is open.

### US-UI-03 Sidebar destinations
- Click Projects, Pull requests, Scheduled, and Plugins in the left sidebar.
- Expect each destination to replace the main pane with a dedicated page (not only a toast).
- From Projects, open/switch/close a local folder workspace.
- From Pull requests with an active workspace, "Review with agent" creates a chat turn.

### US-UI-04 Composer context chips
- With a git workspace open, composer shows project name, Local, and detected branch.
- Permission toggle switches between Agent and Request approval (chat mode).

### US-UI-05 Locale chrome
- On a zh-CN system locale, sidebar labels render in Chinese (新建任务 / 项目 / 拉取请求 / 已安排 / 插件 / 最近任务).
- Empty-thread hero remains English Codex copy: "What should we build?".
- Composer shows 本地, 请求批准 (chat mode), and 自定义 + effort on the right.

### US-UI-06 Session auto-title
- Create a new task and send a first prompt such as "同步代码".
- Expect the Recent tasks item title to become a truncated form of that prompt instead of remaining "New task".

### US-UI-07 Pull requests list
- Open a git workspace with `gh` authenticated.
- Open Pull requests sidebar destination.
- Expect either real open PRs from `gh pr list`, or an empty-state with the gh error/empty message (not only a toast).

### US-UI-08 Titlebar history
- Navigate Projects → Plugins → a recent task.
- Expect back/forward controls near the traffic-light area to traverse that history.

### US-UI-09 Recents title backfill
- Open an older session that previously showed "New task"/"New chat" but has a first user message.
- Expect Recent tasks to display a truncated first-user-message title after session list load.

### US-UI-10 Scheduled local tasks
- Open Scheduled, create a task with prompt + cadence.
- Expect it to appear in the list; Run now opens a chat session and sends the prompt.


### US-UI-11 Empty draft reuse
- Click New task twice.
- Expect only one empty "New task" draft in Recent tasks and the home hero remains visible.

### US-UI-12 Combined workspace chips
- On chat home, expect project / Local / branch controls to share one capsule bar above the composer.

### US-UI-13 Light theme shell parity
- Set theme to system/light on a light macOS appearance.
- Expect sidebar `#f3f3f3`, main `#ffffff`, text `#1a1c1f`, white floating composer, and home hero with project underline.
- Sidebar nav labels (New task / Projects / Pull requests / Scheduled / Plugins / Recent tasks), thread titles, and composer chips must remain readable dark-on-light (≥4.5:1). Never white/translucent text on the light sidebar.
- Titlebar back/forward controls use dark ink on light chrome.

### US-UI-14 Semantic chrome tokens
- Toggle theme system → light → dark without restart.
- Shell chrome (sidebar items, chips, composer, icon buttons) follows semantic `--ds-text-*` / `--ds-bg-*` tokens in both themes; no hard-coded white (`gray-0`) text on light surfaces.

### US-UI-15 Codex density + elevation
- Sidebar nav rows use ~32px height / 13px type with 8px horizontal padding (Codex `radius-token-row` 10px).
- Floating composer uses Codex elevation-prominent: 0.5px stroke + soft 3px/20px shadow (not heavy 10–30px drop).
- Empty hero title is 28px / 34px line-height, weight 400.
- Window restores ≥1000×700 (target 1200×800) if Stage Manager collapses it.

### US-UI-16 Sidebar footer cloud control
- On light/dark home shell, sidebar footer shows Custom + a circular blue cloud/update badge (~20px, Codex charts-blue).
- Badge click remains available (local stand-in opens logs until real update channel lands).
- Traffic lights sit at Codex `{x:16,y:16}` with 46px toolbar; back/forward nav lives in the drag row after lights.

### US-UI-17 Codex home hero mark
- On empty chat home, a 56px Codex cloud/glyph mark renders above the title at ~30% opacity (hover ~40%).
- Title is 28px / weight 400; active project name uses dotted underline (1px, offset 4px).
- Plus control in composer toolbar is labeled "Add files and more" / 添加文件等内容.

### US-UI-18 Composer plus context menu
- On chat home, click the composer `+` control.
- Menu shows Attach files and folders / Add photos / Capture appshot / Open project (localized).
- Attach/Photos open native multi-select dialogs and insert `@path` tokens into the draft.
- Capture appshot shows a non-blocking "not available yet" toast until host capture lands.



### US-UI-19 Permanent Stage Manager bounds restore
- On macOS with Stage Manager, shrink or unfocus the PI window until width < 960 or height < 640.
- Expect the shell to re-assert a Codex-like footprint (~1200×800, min 960×640) and keep restoring while still collapsed (not only during the first 20s after launch).

### US-UI-20 Dark floating composer box
- Switch to dark theme on chat home.
- Expect main `#181818`, sidebar `#000000`, and the floating composer plate at elevated-primary (`#212121f5` / gray-800 96%) with elevation-prominent stroke + soft lift so the box reads against the main surface.

### US-UI-21 Composer model / effort menu
- On chat home, click the composer right control labeled Custom + effort (e.g. Custom Max / 自定义 最高).
- Expect a popover listing effort options Light/Medium/High/Max (轻度/中/高/最高), current model heading, and a Settings entry. Selecting an effort updates the chip label.

### US-UI-22 Profile footer menu
- On the sidebar footer, click Custom (profile row).
- Expect a Codex-style profile menu with Settings, Logs, and Theme cycle; Settings navigates to the settings page.

### US-UI-23 Projects page grid
- Open Projects from the sidebar.
- Expect Codex-like page title "Projects", primary "Add new project", and either an empty state or a card grid of recent/active projects with colored glyph, path, pin/remove actions, and active highlight.

### US-UI-24 Settings full-page shell
- Open Settings (footer profile → Settings).
- Expect **full-page** Codex settings (no app sidebar/nav). Left rail has Back to app, search, Personal/Integrations/Coding groups with icons; content pane shows section title + elevated cards.

### US-UI-25 Pull requests destination chrome
- Open Pull requests with a project selected.
- Expect segmented filters Open/Draft/All with counts, and PR rows with icon plate, number, title, status badge, branch meta, external link, and Review action.

### US-UI-26 Scheduled destination chrome
- Open Scheduled.
- Expect a create card, a Tasks section, and automation rows with cadence/enabled badges, prompt preview, last run, Run now / enable-toggle / Delete.

### US-UI-27 Dark destination pages
- Force dark theme and open Projects, Pull requests, and Settings.
- Expect black sidebar, main `#181818`, and destination cards/rows readable on elevated dark plates (not flat same-gray).

### US-UI-28 Home empty composer association
- On empty chat home (light + dark), expect hero in the upper grow region and composer in the lower grow region (Codex dual-grow), not a large empty gap with a wrongly absolute-docked box.
- Workspace chips remain directly associated with the composer plate.
- Starting a transcript restores the bottom-docked composer with fade veil.

### US-UI-29 Light composer plate legibility
- On light theme empty home, the white composer shell must read as an elevated box (hairline stroke + elevation-prominent shadow) against `#ffffff` main.
- Toolbar controls and placeholder remain legible (not pure white-on-white).

### US-UI-30 Composer placeholder copy
- Empty composer shows Codex placeholder copy: EN `Ask Codex to do anything`, zh-CN `向 Codex 下达任意指令`.
- Placeholder ink is legible on light and dark floating plates.

### US-UI-31 Home split-grow vertical layout
- Given empty chat home, when the window is ~1200×690, the hero sits in the upper grow region and the composer plate in the lower grow region (composer lower half), matching Codex dual-grow home — not a single mid-stack blob.

### US-UI-32 Dark floating box elevation
- Given dark theme empty home, when the composer shell is painted, it uses elevated-primary `#212121` on `#181818` with elevation-prominent stroke+lift identical to light (no heavier custom dark shadow).

### US-UI-33 Sidebar recents section label
- Sidebar recents section label matches live Codex gold: EN `Recents` / zh-CN `最近` (not “Tasks” / “任务” alone if gold shows 最近).
- Section label uses compact tertiary styling (`px-2 py-1` rhythm) between Plugins and thread list.
- Nav row pitch ~32px; thread row pitch ~28–31px with gap-px list.

### US-UI-34 Home suggestion cards
- On empty chat home (light + dark), four ambient suggestion cards render in an auto-fit row under the hero (portal), not only as a 2x2 stack that collides with the composer.
- Cards use Codex electron elevated plate chrome (hairline ring + shadow-md-strong); dark cards remain visible on `#181818`.
- Hero dual-grow lands near mid/lower optical band (not pinned to the top third).
- Activating a card prefills the composer with the matching starter prompt and focuses the input.

### US-UI-35 Empty composer plate density
- Empty-home floating composer plate uses gold draft→toolbar spacing (~148px min height at 1200×690); draft densest ink near y556 (±8).

### US-UI-36 Hero Y + night box elevation
- At ~1200×690 light home, hero first dark ink is near y≈300 (±12px) vs Codex gold.
- Dark home composer plate reads as elevated-primary `#212121f5` with elevation-prominent against `#181818` (not flat same-surface).
- Light workspace chips capsule is elevated gray (`#f4f4f4`), distinct from main white.
- Model chip shows the active model id; effort options remain in the model/intelligence menu.
- Placeholder and approval chip remain legible on light and dark plates.

### US-UI-39 Home mark + hero title optical
- Empty-home Codex mark is visible (not near-invisible); stroke density closer to Codex gold than a 0.3 ghost.
- Empty-home title with a project uses a readable project label span (short basenames may display as `PI-Desktop` for optical parity).

### US-UI-40 Home content width vs rem root
- At 1200×690 light empty home, composer plate outer width is ~744–760px (not ~640px).
- Home suggestion grid spans the same content column as the composer plate.

### US-UI-41 Dark hero + night box readability
- Dark empty home hero title ink is light-on-dark (`--ds-text-primary` / near white), not hardcoded `#1a1c1f`.
- Night composer plate is elevated-primary `#212121f5` on main `#181818` with elevation-prominent; light theme is not forced to the night plate fill.

### US-UI-42 Light New task ghost chrome
- Light empty-home **New task** row has no solid gray chip fill (transparent on `#f3f3f3` sidebar); icon+label only until hover.




### US-UI-43 Empty home plate Y + night elevated-primary
- Open empty home at ~1200×690 light theme.
- Composer plate top wash ≈y537, draft ≈y552, foot shadow ≈y674; plate min-height ~140px; no large pre-plate halo.
- Switch dark theme: night plate is elevated-primary (`#212121f5` / gray-800 96%) with downward elevation (no heavier omni night shadow).


### US-UI-44 Settings Codex groups + rows
- Open Settings light theme at ~1200×690.
- Full-page shell: rail ~260px on `#f3f3f3`, main `#fff`; Back to app; search pill; General active pill with icon.
- General content: large title, **Permissions** card with 3 blue toggles + Learn more links on auto-review/full-access, **General** card with default open target (VS Code glyph) / language / menu bar / bottom panel rows.
- Integrations order: Appshots, Plugins, Browser, Computer use, then local MCP.
- Dark: rail `#000`, main `#181818`, cards elevated `#212121`.

### US-UI-45 Settings permission learn-more
- On General → Permissions, Auto-review and Full access descriptions include a blue **Learn more** / **了解更多** link.
- Link opens the Codex sandboxing auto-review docs in an external browser.

### US-UI-38 Home chips without project
- On empty chat home, the project/Local/branch capsule is hidden (matches Codex empty gold).
- Starting a transcript restores the workspace capsule above the docked composer.

### US-UI-37 Empty draft infinity + resize
- Empty composer shows a left ∞ cue and visible placeholder ink (not a blank white/night hole).
- Auto-resize never collapses empty textarea below ~28px.
- Disabled send control is a solid gray chip on light (`#8e8e90`), full opacity with white arrow.
- Dark night plate remains elevated-primary `#212121f5` with readable elevation-prominent on `#181818`.

### US-UI-31b (superseded)
- Superseded by US-UI-31 split-grow layout.



### US-UI-46 Home-with-project composer chrome
- Open a project on empty home (no transcript).
- Expect workspace chips (project / Local / branch) above the plate; no ∞ draft mark; placeholder is Ask anything / 随心输入.
- Model chip shows Custom + effort (e.g. 自定义 最高); footer profile uses gear + Custom and help control.

### US-UI-47 Projects index parity
- Open Projects destination.
- Expect large title, search pill, New button, and table columns Name / Sources / Updated.
- Rows expand for recent tasks + actions (pin, start task, remove/close); activating a recent path uses setProject without re-picking via dialog when possible.


### US-UI-48 Home suggestion glyph parity
- On empty home, four ambient cards show Codex glyphs in order: code brackets (blue), hammer (purple), refresh (green), bug (orange).
- Labels remain explore / create / review / fix localization keys.


### US-UI-49 Recents pin/panel actions
- Hover or select a recent task row.
- Expect trailing pin and panel icon buttons (Codex recents chrome).
- Pin persists locally across reloads; active row keeps actions visible.


### US-UI-50 Destination title scale
- Open Projects, Pull requests, Scheduled, Plugins.
- Expect large section titles (~28px) consistent with Codex destination/index pages.
- Dark home New task remains a ghost row (no solid selected chip) unless genuinely active.

### US-UI-52 Settings gold chrome metrics (D070)
- Open Settings light General at ~1200×690.
- Expect ~275px `#f4f4f4` rail, single active General pill, Back + search.
- Expect compact ~32×20 accent-blue toggles; Account arrow-up-right; VS Code open-target glyph.
- Expect Permissions + General elevated cards; local Providers/About may follow Account.

### US-UI-53 Settings dark shell (D070)
- Dark theme Settings General: black rail, elevated cards, blue on-toggles, Back returns to chat.

