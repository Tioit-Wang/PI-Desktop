# 12. Plugin IPC and Host Services

## 1. Goals

Complete the plugin-related host services and UI IPC so implementation does not rely on ad-hoc conventions.

## 2. Main-process services

```text
PluginManager
 ├─ PluginRegistryStore
 ├─ ManifestValidator
 ├─ PackageInstaller
 ├─ PermissionGateway
 ├─ ContributionRegistry
 │ ├─ CommandRegistry
 │ ├─ AgentToolRegistry
 │ └─ SkillRegistry
 ├─ PluginRuntimeBroker
 ├─ PluginPanelHostService
 └─ MarketClient
```

## 3. UI IPC (additions)

### plugin domain
- `plugin/list`
- `plugin/detail`
- `plugin/loadDev`
- `plugin/installFromPath`
- `plugin/installFromPackage`
- `plugin/enable`
- `plugin/disable`
- `plugin/uninstall`
- `plugin/reload`
- `plugin/getLogs`
- `plugin/getPermissions`
- `plugin/grantPermissions`
- `plugin/revokePermissions`
- `plugin/openDataDir`
- `plugin/openInstallDir`

### commandPalette domain
- `commandPalette/search`
- `commandPalette/execute`
- `commandPalette/listRecent`

### market domain (implemented later, protocol defined first)
- `market/search`
- `market/getDetail`
- `market/install`
- `market/checkUpdates`
- `market/listProviders`

## 4. Events (main → renderer)

- `plugin/event/changed` (installed/enabled change)
- `plugin/event/loadError`
- `plugin/event/permissionRequired`
- `market/event/updateAvailable`

## 5. ContributionRegistry behavior

### Registration
- key must be unique
- Plugin commands share the prefix: `plugin.<pluginId>.<commandId>`
- Plugin tool prefix policy: `plugin_<pluginIdSafe>_<toolName>` (fixed in the implementation)

### Query
- The command palette only queries contributions that are enabled + loaded successfully
- The Agent only sees registered tools

### Deregistration
- Remove everything on disable/unload/uninstall

## 6. RuntimeBroker call chain

Plugin API call:

```text
plugin runtime
 → RPC to PluginRuntimeBroker
 → PermissionGateway.check
 → Host service execute
 → audit log
 → response
```

## 7. PanelHost interaction

- Create an isolated view when opening a panel
- Pass in pluginId / theme tokens
- Destroy the view and message subscriptions on close

## 8. Failure isolation

- Plugin API timeout: return TIMEOUT
- runtime crash: mark load_error, clean up contributions
- panel crash: only close the panel, do not unload the plugin (can prompt to reload)

## 9. Acceptance

1. The plugin list IPC works
2. The command palette IPC can execute plugin commands
3. Start/stop triggers contribution registration/deregistration
4. The market IPC runs end-to-end under a mock provider (later milestone)
