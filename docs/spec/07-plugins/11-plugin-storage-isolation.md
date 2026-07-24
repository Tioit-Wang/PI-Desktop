# 24. Plugin Storage Isolation

## 1. 目标

插件数据与宿主核心数据隔离，避免互相污染与越权读取。

## 2. 目录规划

```text
~/.pi-desktop/
 ├── settings.sqlite
 ├── sessions.sqlite
 ├── plugins/
 │ ├── installed/<plugin-id>/
 │ ├── disabled/ # 可选
 │ ├── data/<plugin-id>/
 │ ├── logs/<plugin-id>.log
 │ ├── cache/download/
 │ └── registry.json
 └── ...
```

## 3. registry.json（逻辑模型）

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

## 4. 插件私有数据

`pi.plugin.getDataPath()` 指向：

```text
~/.pi-desktop/plugins/data/<plugin-id>/
```

用途：
- 缓存
- 本地索引
- 插件配置大文件

禁止：
- 通过该 API 获取其他 pluginId 路径

## 5. 设置存储

插件 settings 可存：

- 宿主 settings db 的 plugin_settings 表
- 或插件 data 目录下 settings.json

推荐宿主统一存，便于备份与卸载清理。

```ts
// plugin_settings
// plugin_id | key | value_json | updated_at
```

## 6. 日志隔离

每个插件独立日志通道：
- 文件：`plugins/logs/<plugin-id>.log`
- UI：可按插件过滤

宿主核心日志不写入插件文件。

## 7. 会话与密钥隔离

插件不可直接访问：
- sessions.sqlite
- secrets
- provider key
- 其他插件 registry 私货

若未来提供“受控会话摘要 API”，必须：
- 单独权限
- 默认关闭
- 可审计

## 8. 卸载清理策略

默认：
- 删除 installed 代码
- 删除 data
- 删除 logs（或保留最近一次）

高级：
- 保留 data

## 9. 备份建议

后续导出备份可分：
- 仅宿主配置
- 宿主配置 + 插件列表
- 完整（含插件 data）

MVP 不做完整备份协议，只预留目录边界。

## 10. 验收

1. 插件只能写自己的 data 目录
2. 卸载后 data 按策略清理
3. registry 能恢复已安装列表
4. 插件日志可单独查看
