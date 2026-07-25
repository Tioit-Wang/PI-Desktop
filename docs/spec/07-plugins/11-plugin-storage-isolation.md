# 11. Plugin Storage Isolation

## 1. Goals

Isolate plugin data from the host's core data to avoid cross-contamination and unauthorized reads.

## 2. Directory layout

```text
~/.pi-desktop/
 ├── settings.sqlite
 ├── sessions.sqlite
 ├── plugins/
 │ ├── installed/<plugin-id>/
 │ ├── disabled/ # optional
 │ ├── data/<plugin-id>/
 │ ├── logs/<plugin-id>.log
 │ ├── cache/download/
 │ └── registry.json
 └── ...
```

## 3. registry.json (logical model)

```ts
type PluginRegistry = {
 schemaVersion: 1
 plugins: Array<{
 id: string
 version: string
 enabled: boolean
 source: "installed" | "dev" | "marketplace"
 path: string
 installedAt: string
 updatedAt: string
 permissionsGranted: string[]
 marketplace?: {
 providerId: string
 shasum?: string
 publisherId?: string
 }
 }>
}
```

## 4. Plugin private data

`pi.plugin.getDataPath()` points to:

```text
~/.pi-desktop/plugins/data/<plugin-id>/
```

Uses:
- cache
- local index
- large plugin config files

Prohibited:
- Using this API to obtain another pluginId's path

## 5. Settings storage

Plugin settings can be stored in:

- The plugin_settings table of the host settings db
- Or settings.json under the plugin data directory

Storing centrally in the host is recommended for easier backup and uninstall cleanup.

```ts
// plugin_settings
// plugin_id | key | value_json | updated_at
```

## 6. Log isolation

Each plugin has its own log channel:
- File: `plugins/logs/<plugin-id>.log`
- UI: filterable by plugin

Host core logs are not written into plugin files.

## 7. Session and secret isolation

Plugins cannot directly access:
- sessions.sqlite
- secrets
- provider key
- other plugins' private registry data

If a "controlled session summary API" is offered in the future, it must:
- Have a separate permission
- Be disabled by default
- Be auditable

## 8. Uninstall cleanup policy

Default:
- Delete installed code
- Delete data
- Delete logs (or keep the most recent one)

Advanced:
- Keep data

## 9. Backup suggestions

A future export/backup can be split into:
- Host config only
- Host config + plugin list
- Full (including plugin data)

The MVP does not implement a full backup protocol; it only reserves directory boundaries.

## 10. Acceptance

1. A plugin can only write to its own data directory
2. Data is cleaned up per policy after uninstall
3. The registry can restore the installed list
4. Plugin logs can be viewed separately
