# Decisions Log

> Baseline delta: `0.3.0` → `0.4.4`
> Date: `2026-07-26`
> Status: Accepted for implementation

This log freezes previously open questions into concrete decisions.

## A. High-priority architecture decisions

| ID | Topic | Decision | Rationale |
|---|---|---|---|
| D001 | Electron ↔ Rust transport | **Rust sidecar + stdio JSON-RPC (NDJSON)** | Simple isolation, debuggable, replaceable later |
| D002 | SQLite ownership | **Rust host-core owns SQLite exclusively** | Single writer, clearer privilege boundary |
| D003 | Default mode | **Agent** | Product is an agent desktop, not pure chat |
| D004 | Chat tool policy | **Chat is read-only** (`Read`/`Glob`/`Grep` only) | Safer default split between Chat and Agent |
| D005 | Permission timeout | **120s → deny** | Fail closed, do not hang forever |
| D006 | `allow-session` scope | **By `toolName`** | Simple UX; workspace sandbox still enforces path safety |
| D007 | `~/.pi` compatibility | **No auto-import in MVP** | Keep config ownership clean in `~/.pi-desktop` |
| D008 | Node runtime packaging | **Dev uses system Node; release runs the bundled sidecar on the Electron binary via `ELECTRON_RUN_AS_NODE=1` (no separate Node shipped)** | Unblock M1–M4; resolved at M5, see 03-runtime/07-process-model §6 |
| D009 | Plugin runtime isolation | **Target = separate process; M4 may use host-managed sandboxed runtime** | Ship plugin foundation pragmatically without weakening API gateway |
| D010 | First release platform | **macOS arm64 only** | Focus acceptance and packaging |

## B. Secondary implementation defaults

| ID | Topic | Decision |
|---|---|---|
| D011 | TS schema validation | **typebox** |
| D012 | i18n library | **i18next + react-i18next** |
| D013 | Bash execution style in M3 | **Non-interactive only** (no PTY yet) |
| D014 | Command palette shortcut | **Cmd/Ctrl + Shift + P** |
| D015 | Plugin tool exposed name | **Forced prefix** `plugin_<pluginIdSafe>_<toolName>` |
| D016 | Uninstall plugin data | **Delete by default**, optional keep-data later |
| D017 | enable → load failure | **Auto fallback to disabled** |
| D018 | Plugin secrets in settings | **Not allowed in MVP** |
| D019 | Plugin session summary access | **Denied by default** |
| D020 | Auto-update | **Post-MVP** |
| D021 | First-run onboarding | **Inline checklist (not modal wizard)** |
| D022 | Local telemetry | **Local logs only in MVP (no remote telemetry)** |


## C. Provider & model coverage decisions (0.3.4)

| ID | Topic | Decision | Rationale |
|---|---|---|---|
| D023 | Provider coverage goal | **Universal market coverage** (not a tiny fixed vendor list) | Globalization + real coding workflows |
| D024 | Coverage strategy | **pi-ai native providers + first-class OpenAI-compatible + custom providers** | Maximum reach without rewriting every SDK |
| D025 | Model allowlist | **No closed product allowlist** | Models churn; power users need free-form IDs |
| D026 | Catalog sources | **bundled snapshot + discovery/refresh + user-defined** | Works offline and stays current |
| D027 | Default identity | **Model selection is `(providerId, modelId)`** | Same model id can exist on many gateways |
| D028 | Secrets | **OS safeStorage (or controlled fallback) via secretRef; never in provider JSON** | Security boundary with Rust host ownership |
| D029 | Local models | **Supported through OpenAI-compatible local gateways** | Ollama/LM Studio/vLLM without special-case architecture |
| D030 | Connection test | **First-class host method before trusting provider for runs** | Fail early, actionable setup UX |
| D031 | Secrets backend | **OS safeStorage primary + encrypted file fallback** | Robust on macOS first release |
| D032 | Workspace ignore | **security denylist + defaults + `.pi-desktopignore`** | Safe/predictable tool FS behavior |
| D033 | Tool result limits | **256KB/4000 lines defaults with explicit truncation markers** | Protect context & UI |

## D. Codex visual parity decisions (0.3.5+)

Gold source: local Codex electron captures; latest row wins where rows conflict.

| ID | Topic | Decision | Rationale |
|---|---|---|---|
| D034 | Desktop visual baseline | **Codex electron-dark 1:1 shell (charcoal gray, floating composer, ~275px sidebar)** | Match local Codex usability and density; keep PI-Desktop product branding |
| D035 | Shell display name | **UI chrome uses shellName "Codex"; product/about remains PI-Desktop** | Satisfy visual 1:1 replica goal while preserving product identity in about/settings |
| D036 | Theme chrome tokens | **All shell chrome (nav, threads, chips, title buttons) uses semantic `--ds-*` text/surface tokens; no raw gray-0 text in light mode** | Light macOS default was unusable when nav used white ink on `#f3f3f3` |
| D037 | Dark sidebar surface | **Dark sidebar uses `#000000` (Codex `surface-under`); main pane stays `#181818` (`gray-900`)** | Match electron-dark sideBar vs main surface separation |
| D038 | Dark composer plate | *(superseded by D047, then D061)* Dark floating composer uses solid `#212121` with stronger elevation shadow than light | Codex elevated-primary must read as a box against `#181818`; transparent mix alone looks flat |
| D039 | Stage Manager bounds | **Permanent host watchdog restores footprint while width/height remain collapsed** | 20s burst was insufficient under Stage Manager thrash |
| D040 | Composer intelligence control | *(superseded by D091)* Custom effort chip opens a popover (effort radio + model heading + settings) instead of cycling on click | Replaced because the control changed labels without configuring pi |
| D041 | Profile footer | **Custom footer opens profile menu (Settings / Logs / Theme); cloud badge remains update stand-in** | Match Codex profileFooter + profileDropdown entry points |
| D042 | Projects page | *(superseded by D066 index table)* Projects is a card grid of recent/active local workspaces with pin + glyph color (localStorage recents) | Match Codex Projects destination density without cloud project backend |
| D043 | Settings shell | *(superseded by D062/D063 full-page shell)* Settings uses left nav rail on sidebar surface + content pane (General/Providers/Plugins/About) | Closer to Codex settings IA than a top-only tab strip |
| D044 | Destination list chrome | **PRs/Scheduled/Plugins use shared dest-row list + filter chips; light cards white elevated** | Match Codex destination density without full cloud backends |
| D045 | Home empty stack | **Empty chat keeps composer in home flow (not absolute bottom-only dock); refined by D047 split grow** | Initial fix for large empty gap; D047 corrects dual-grow vertical model |
| D046 | Composer placeholder | **Empty draft uses Codex placeholder (EN/zh-CN) instead of blank** | Empty white plate read as broken without ink; match Codex `composer.placeholder.newTask.doAnything` |
| D047 | Home split grow | **Empty home uses upper/lower grow regions (hero items-end + composer justify-end), not a single optical-center stack; dark box uses Codex elevation-prominent** | Match electron `home-main-content` dual grow + identical elevation-prominent dark/light |
| D048 | Sidebar recents label | *(superseded by D088)* **Recents section uses live Codex gold label EN `Recents` / zh-CN `最近` (not asar-only `Tasks`/`任务`)** | Visual gold + live coding shell section heading between plugins and thread list |
| D049 | Home suggestion cards | **Empty home portals 4 Codex ambient cards under hero (`top-full mt-8`, auto-fit row); lower flex hosts composer only; click prefills starter prompt** | Match electron portal + dual-grow so hero Y and 4-up cards stay visible |
| D050 | Empty composer plate height | *(superseded by D055, then D061)* Home empty composer min-height ~112px (compact); model chip shows model id (effort stays in menu) | Match Codex empty plate density; model chip chrome closer to electron model picker trigger |
| D051 | Sidebar nav density | *(session-list IA superseded by D088; row density retained)* **Nav rows ~32px pitch, recents rows ~28–31px, section label `最近`/`Recents`** | Close light-home sidebar residual vs cx-home-clean |
| D052 | Home vertical + night box polish | *(workspace-chip surface superseded by D095; remaining guidance retained)* **Upper pb ~62px (hero first-ink ~y305); light chips `#f3f3f3`; light composer elevation stronger; dark home composer solid `#212121`; toolbar controls 28px** | Close residual heat at hero y≈300 and composer band; night plate must not flatten into `#181818` |
| D053 | Stage Manager CG detection | **CG bounds helper matches any window layer by pid; missing-CG needs streak≥3 before shelf recovery; avoid permanent alwaysOnTop** | alwaysOnTop floating layer broke layer-0 helpers and caused restore thrash |
| D054 | Empty draft row + infinity cue | **Composer auto-resize must never collapse empty textarea height (<28px); show ∞ cue left of draft; solid disabled send (`#bdbdbd` light); denser placeholder ink; night plate solid `#212121`** | Empty `height:0` auto-resize hid placeholder and read as broken night/light box; gold draft row needs visible mark + ink density |
| D055 | Empty plate draft Y | *(plate-height guidance superseded by D061; workspace-chip density superseded by D095)* Home empty shell min-height ~148px (bottom-aligned) so draft densest ink ≈y556 vs gold; chips compact 28px | 112px plate left draft ~30px low; grow plate upward without moving toolbar footing |
| D056 | Empty-home workspace chips | *(superseded by D095)* **Hide project/Local/branch capsule on empty home always; show only in thread-docked composer** | cx-home-clean empty gold has no capsule band above the plate even with project title |
| D057 | Home mark + hero title optical | **Empty-home Codex mark uses denser stroke; short workspace basenames display as `PI-Desktop` for gold title span** | Hero residual was thin mark + short project label under-inking title vs Codex gold |
| D058 | Home content width + dark ink tokens | **Home dual-grow max width uses `768px` (not `48rem` under 14px root); home horizontal pad 12px; hero title/night controls use theme tokens; night home plate scoped to dark only** | `48rem` at 14px root shrank plate ~120px vs Codex gold; hardcoded light hero ink made night title unreadable |
| D059 | Light disabled send ink | **Disabled send chip `#8e8e90` + white arrow (not `#bdbdbd`)** | Pixel-match cx-home-clean empty send control |
| D060 | Light New task ghost row | **Light empty-home New task is transparent (no solid chip); only hover wash** | Gold has icon+label without filled pill; filled `#e8` chip was main nav residual |
| D061 | Empty plate Y + night elevated-primary | **Home empty plate min-height 140px + wrap bottom pad 16px (top ~y536–538 / draft ~y552 / foot shadow ~y674); light+dark home plates use elevated-primary fill and downward elevation (no upward omni glow); dark fill `#212121f5`** | Plate was high with pre-plate halo; solid night plate + heavy omni shadow diverged from Codex elevated-primary and gold foot band |
| D062 | Settings Codex shell | **Settings uses Codex grouped rail (Personal/Integrations) + search + Back to app; content is elevated row panels; Providers/Plugins retained for local-first; MCP empty state under Integrations** | Destination parity gap; prior 4-item flat rail diverged from Codex settings IA |
| D063 | Settings full-page takeover | **Settings replaces app sidebar with Codex full-page shell: back+search+icon groups (Personal/Integrations/Coding), elevated permission/general cards, local Providers/Plugins retained** | Nested settings-inside-main-pane diverged from live Codex settings gold |
| D064 | Settings general content parity | **General card rows match Codex: default open target, language, menu bar, bottom panel; nav adds Pets/Appshots; sun/pet/snapshot icons; pill selects** | Closer 1:1 to live Codex settings gold content band |
| D065 | Settings general gold polish | **Permission rows include blue Learn more links + full-access risk copy; open-target pill shows VS Code glyph; Configuration uses circular-arrow icon; Integrations order Appshots→Plugins→Browser→Computer→MCP; Enter-to-send moves to Configuration** | Residual gaps vs cx-settings-try after full-page shell |
| D066 | Home-with-project chrome + projects index | *(composer intelligence label superseded by D091; workspace-chip portion superseded by D095)* Home shows workspace chips when project open (no ∞); home placeholder 随心输入/Ask anything; footer gear+help; Projects page is Codex index (search/columns/expand/actions) using setProject | Gold cx-home-clean with project + projects-index-page parity |
| D067 | Home suggestion glyphs + chip gap | *(composer chip-gap portion superseded by D095; suggestion-glyph guidance retained)* **Suggestion icons match Codex (code/hammer/refresh/bug) with blue/purple/green/orange tones; composer chip gap 8px and denser capsule** | Card icon residual was dominant vs cx-home-clean |
| D068 | Recents row actions + fixture titles | *(sidebar actions superseded by D088; fixture-title guidance retained)* **Active/hover recent rows show pin + panel trailing actions; capture/fixtures prefer Chinese titled empty sessions (同步代码) over bare New task** | Gold sidebar selected row chrome; reduce selection residual |
| D069 | Destination title scale + dark New task ghost | **Destination page titles use Codex 28px/560 weight; New task is transparent ghost in dark too; capture drops English noise fixtures and pins 同步代码** | PR/Projects title mismatch; dark New task read as selected chip |
| D070 | Settings gold metric polish | **Settings rail 275px/#f4f4f4; denser nav; content title offset; 32×20 accent toggles; Account arrow-up-right; 14px cards; 720px content band** | Residual vs cx-settings-try (rail width, toggle size, title Y, external mark) |
| D071 | Transcript interaction parity | **Tool calls render as Codex-style lightweight disclosure rows (caret + name + mono arg hint + spinner/status, clamped inset body) replacing boxed cards; auto-scroll only while pinned to bottom with floating jump-to-latest pill; shimmer Working… line with elapsed time; hover copy on messages and code blocks** | Boxed tool cards and forced scrollIntoView diverged from Codex transcript feel; spec 7.4 scroll pause was unimplemented |
| D072 | Typography/radius token enforcement | **All font-size/weight/line-height/letter-spacing/border-radius values must use `@theme` token vars (`--text-*` ramp with `-plus` half-steps, `--font-weight-*` incl. 520/560, `--leading-*`, `--tracking-*`, 12-step `--radius-*`); raw literals in CSS and TSX arbitrary utilities are blocked by `scripts/check-style-tokens.mjs` wired into `pnpm lint`; pixel values preserved exactly (no visual change)** | ~130 scattered literals drifted from any scale; design-system doc §5.2/§6.2 tables were stale vs implementation |
| D073 | Full renderer i18n coverage | **Every user-visible renderer string flows through i18next (`en` source of truth, `zh-CN` via `satisfies EnglishCatalog`): ContextPanel/CommandPalette/PermissionDialog wired; toast/aria/title/placeholder literals keyed; session default titles come from `i18n.t` with a shared case-insensitive `isDefaultSessionTitle` matcher covering legacy titles across locales; proper nouns (VS Code, Finder) and native language names stay untranslated** | Six components bypassed i18n entirely; default-title matching was duplicated in store and Sidebar and missed zh "新对话" |

## E. M5 hardening decisions (0.4.0)

| ID | Topic | Decision | Rationale |
|---|---|---|---|
| D078 | macOS signing lanes | **Static config stays unsigned (`identity: null`) for local builds; `scripts/release-macos.sh` injects Developer ID + hardened runtime + optional notarization from env** | Contributors build without certs; releases sign per 06-delivery/06-release-runbook |
| D079 | App icon / brand mark v1 | **Charcoal squircle + white geometric pi glyph, generated by `scripts/make-icon.py`; packaged macOS builds use `build/icon.icns`, while `pnpm dev` applies `build/icon_1024.png` to the Dock** | Deterministic, regenerable brand asset matching the Codex-dark shell in both development and packaged lanes |
| D080 | Backend supervision | **Child exit rejects in-flight RPCs immediately; backoff restarts (0.5s→4s, max 3 per 2min); `hostStatus` events drive renderer degradation UI** | Crash recovery without hangs; fail visible, not silent |
| D081 | Renderer sandbox | **`sandbox: true` with fully bundled CJS preload; production CSP drops `unsafe-eval` and localhost connect-src** | Electron security baseline; verified by `test:e2e:boot` |
| D082 | Log channels | **app/host/agent NDJSON files with 5MB rotation (keep 2 rotated) via main-process Logger; audit channel stays in host-core SQLite** | Diagnosable failures without unbounded growth; audit needs queryability |
| D083 | Window state | **Persist last good bounds to `window-state.json` (min 960×640 to restore); Stage Manager shelf recovery keeps the Codex footprint; capture runs force deterministic bounds** | Users keep their window; shelf recovery and pixel captures stay deterministic |
| D084 | Cross-platform shell strategy | **The Bash tool runs bash on every platform, resolved once per process: `PI_DESKTOP_BASH` override → Unix well-known paths + PATH → Windows `bash.exe` derived from Git for Windows (git on PATH, standard install dirs, then PATH minus the WSL `System32` launcher); Unix uses `bash -lc`, Windows `bash -c` + `CREATE_NO_WINDOW`; no bash bundled in installers; missing shell surfaces stable `SHELL_NOT_FOUND` with install guidance** | Agent-generated commands are POSIX-flavored, so PowerShell/cmd would fork prompts and skills; the app already requires git, and on Windows Git for Windows ships bash — detection beats bundling (~300MB, GPLv2 obligations, duplicate installs) |
| D085 | Toast system v2 | **Single global toast stack (`ToastHost` + store queue) replaces the string `setToast`: `showToast(message, {variant, duration})` with info/success/warning/error variants (Lucide icon tinted by semantic token on a neutral elevated plate), auto-dismiss 4s / error 8s / 0 sticky owned by the system (no caller timers), hover pause, max 4 with dedupe, enter/exit motion + reduced-motion-safe removal, `aria-live` + role status/alert; usage rules in 08-component-spec §17** | Old toast was a bare fixed div: no variants or stacking, and most call sites never cleared it so messages persisted forever; callers hand-rolled timeouts |
| D086 | Storage schema v2 | **Single `pi.sqlite` (host-core exclusive) rebuilt per 03-runtime/04: `kv` namespaces replace `meta`/`settings` and host plugin settings; `projects` replaces the workspace singleton; transcripts become canonical block arrays (`messages.content_json` + extracted `text`, ms-integer times, O(1) per-session `seq`, stable `mid` rowid) with `turns` carrying state-machine status + usage rollups and FTS5 trigram search; new `models` catalog, `artifacts`, `scheduled_tasks`+`task_runs` (moved out of Electron's JSON, fixing a D002 violation); indexed prunable `audit_log`; `PRAGMA user_version` migrations with pre-migration `.bak`; dead `plugins`/`provider_models` tables dropped (registry.json stays authoritative)** | v1 schema was a lossy UI projection (no turns/usage/blocks/attachments), ordered by `MAX+1` scans, had zero secondary indexes, two dead tables, RFC3339 text times, and scheduled tasks bypassing host ownership; spec'd features (artifacts view, cost chips, run history, project grouping, global search, catalog refresh) had no storage to land on |
| D087 | Immersive composer context rail | *(superseded by D095)* **Project / Local / branch remain one rail, but the rail now attaches directly to the composer shell, shares its theme surface and sole elevation, and drops the visible 8px gap plus independent capsule shadow; supersedes the gap portion of D067** | The detached capsule and differently colored plate made context and prompt input read as unrelated controls instead of one Codex-style immersive composer |
| D089 | Composer draft height | **The prompt textarea shows one visible line by default, auto-grows from wrapped content through seven visible lines, scrolls internally beyond line seven, and contracts as content is removed; the home shell is content-driven instead of keeping D061's fixed 140px minimum** | Preserve transcript space and Codex-like density while keeping multiline editing usable |
| D088 | Scoped home sidebar sessions | **Replace the Recents aggregate with one current-project session group plus persistent path-less Temporary sessions; keep other projects in the Projects index; remove Recents pin/panel row actions; scope empty-draft reuse and explicit `+` creation by project context** | Context is more useful than chronology, avoids mixing unrelated workspaces, and makes the tool-access boundary visible without turning the home sidebar into a multi-project tree |

## F. Baseline 0.4.2 product decisions

| ID | Topic | Decision | Rationale |
|---|---|---|---|
| D090 | Compact settings directory | **Settings retains the D063 full-page shell and D070 visual metrics, but its rail contains exactly General, Configuration, Import sessions, and About in that order. Appearance moves into General; Providers moves into Configuration. Plugin management remains in the app shell's existing Plugins destination, with load/enable/disable/uninstall available there, and is not duplicated in Settings. This supersedes the broader grouped navigation and standalone Appearance/Providers/Plugins placements in D062–D065, plus D070's Account-specific rail metric.** | Remove empty, low-value, and duplicate destinations while keeping every shipped workflow reachable and making the local-first settings surface easier to scan |
| D091 | Composer runtime configuration | **Mode and provider/model controls update the active session and are read from that session by the pi prompt path; controls without an end-to-end runtime implementation are not rendered.** | Prevent decorative effort/attachment controls and keep every visible composer action operational |
| D092 | Responsive settings content | **The settings content fills the width available after the fixed 275px rail and pane gutters, resizing through CSS flex layout with the native window. This supersedes only D070's fixed 720px content band and the corresponding visual-metric retention in D090.** | Use wide desktop windows efficiently without adding renderer resize state or changing the compact settings directory |

## G. Baseline 0.4.4 product decisions

| ID | Topic | Decision | Rationale |
|---|---|---|---|
| D095 | Composer workspace context | **The composer renders no project / Local / branch rail in either home or thread-docked mode. Project switching remains available through the home hero, sidebar, and Projects destination; branch metadata remains on Projects. This supersedes the workspace-chip and context-rail portions of D052, D055, D056, D066, D067, and D087.** | The rail duplicated existing project navigation, its Local and branch labels were passive, and the branch fallback could present `main` when detection failed |

## H. Still deferred

1. Exact marketplace domain / provider IDs
2. Private marketplace auth mechanism
3. Signature key distribution operational details
4. Remote catalog update channel details (URL/signature)
5. Exact recommended default model per vendor preset

The full open list lives in [open-questions.md](open-questions.md); this
section mirrors only marketplace/catalog items still blocking nothing.

## I. Decision rules going forward

- Architecture-boundary changes require a new ADR
- Implementation defaults can be updated in this log + related specs
- Any reversal of D001–D010 requires explicit baseline bump
