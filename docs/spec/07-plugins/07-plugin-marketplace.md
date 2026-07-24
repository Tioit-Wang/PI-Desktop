# 20. Plugin Marketplace

## 1. 定位

插件市场是 **分发层**，不是运行时核心。

原则：

> 先本地插件系统可用，再接入市场。

市场负责：
- 发现
- 检索
- 展示元数据
- 下载
- 更新检查

宿主负责：
- 校验
- 授权
- 安装
- 运行
- 安全隔离

## 2. 阶段策略

### Phase A（现在只定 spec）
- 协议与数据模型
- 本地 mock market provider

### Phase B
- 远程市场只读浏览 + 下载安装

### Phase C
- 自动更新、评分、发布者认证、签名强制

## 3. Market Provider 抽象

```ts
interface MarketProvider {
 id: string
 list(query: MarketQuery): Promise<MarketSearchResult>
 get(pluginId: string): Promise<MarketPluginDetail>
 getDownloadInfo(pluginId: string, version?: string): Promise<MarketDownloadInfo>
 checkUpdates(installed: InstalledPluginRef[]): Promise<MarketUpdateInfo[]>
}
```

支持多 provider：
- `official`（官方）
- `custom`（企业私有源）
- `local-mock`（开发）

## 4. 数据模型

### MarketPluginSummary
```ts
type MarketPluginSummary = {
 id: string
 name: string
 description: string
 author: string
 iconUrl?: string
 latestVersion: string
 downloads?: number
 updatedAt: string
 categories?: string[]
 permissionSummary: string[]
 verified?: boolean
}
```

### MarketPluginDetail
```ts
type MarketPluginDetail = MarketPluginSummary & {
 readmeMarkdown?: string
 versions: Array<{
 version: string
 publishedAt: string
 changelog?: string
 minPiDesktop?: string
 }>
 screenshots?: string[]
 homepage?: string
 repository?: string
 permissions: string[]
 safetyNotes?: string
}
```

### MarketDownloadInfo
```ts
type MarketDownloadInfo = {
 pluginId: string
 version: string
 url: string
 sizeBytes: number
 shasum: string // sha256
 signature?: string // 后续强制
 signatureAlg?: "ed25519"
 publishedAt: string
}
```

## 5. 安装链路（市场）

```text
browse/search
 → detail
 → install
 → download to cache
 → verify shasum/(signature)
 → hand to local packaging installer
 → permission review
 → enable?
```

任何校验失败：中止并保留缓存可选清理。

## 6. 更新链路

1. 启动后或定时 `checkUpdates`
2. 对比 installed version 与 latest
3. UI 显示可更新列表
4. 用户确认后下载升级

策略：
- MVP 后第一版：手动更新
- 后续：可选自动更新（仅低风险插件或官方插件）

## 7. 市场 UI 信息架构

```text
Plugins
├─ Installed
├─ Marketplace
│ ├─ Search
│ ├─ Categories
│ └─ Detail
└─ Updates
```

Detail 页必须显示：
- 权限
- 作者
- 版本
- 更新时间
- 风险说明
- 安装按钮

## 8. 信任模型

| 级别 | 含义 |
|---|---|
| verified | 官方或认证发布者 |
| community | 社区插件 |
| unknown | 自定义源/未认证 |

UI 必须可见信任级别。 
不能把 community 伪装成 verified。

## 9. 私有源（企业向后）

支持配置：

```json
{
 "marketProviders": [
 {
 "id": "official",
 "url": "https://market.example.com"
 },
 {
 "id": "corp",
 "url": "https://plugins.company.local",
 "tokenEnv": "PI_DESKTOP_MARKET_TOKEN"
 }
 ]
}
```

## 10. 远程 API 草案（HTTP）

> 非最终实现绑定，仅协议草案。

- `GET /v1/plugins?query=&category=&page=`
- `GET /v1/plugins/:id`
- `GET /v1/plugins/:id/versions`
- `GET /v1/plugins/:id/download?version=`
- `POST /v1/updates/check`

所有下载元数据必须包含 `shasum`。

## 11. 明确不做（市场第一版）

- 应用内付费结算
- 插件远程代码热补丁
- 静默自动安装
- 无校验下载执行
- 评论社交系统（可后置）

## 12. 验收（市场只读+安装）

1. 可浏览插件列表
2. 可查看权限与版本
3. 可下载并安装
4. 校验失败不可安装
5. 安装后出现在 Installed
