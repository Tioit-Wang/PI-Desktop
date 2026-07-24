# 21. Plugin Signing & Updates

## 1. 目标

为插件分发提供完整性与来源可信保障。

分层：

1. **Checksum**：防传输损坏/篡改（先做）
2. **Signature**：防伪造来源（后做）
3. **Update channel**：可控升级

## 2. 校验级别

| 级别 | 条件 | 策略 |
|---|---|---|
| L0 | 无 checksum | 仅 dev/local dir 允许 |
| L1 | sha256 checksum | 市场下载最低要求 |
| L2 | checksum + signature | 官方/认证插件要求（后续） |

## 3. Checksum 流程

下载后：

```text
sha256(file) == downloadInfo.shasum
```

失败：
- 不安装
- 提示“完整性校验失败”
- 记录审计

## 4. 签名方案（后续冻结实现细节）

建议：

- 算法：`Ed25519`
- 发布者密钥对
- 市场或发布者公钥分发
- 签名对象：`pluginId + version + shasum`

示例：

```ts
type PluginSignature = {
 alg: "ed25519"
 publisherId: string
 signedAt: string
 payload: {
 pluginId: string
 version: string
 shasum: string
 }
 signature: string // base64
}
```

验证失败即拒绝安装/更新。

## 5. 发布者信任

```ts
type PublisherTrust = {
 publisherId: string
 displayName: string
 publicKey: string
 level: "official" | "verified" | "community"
}
```

宿主维护：
- 内置官方公钥
- 用户可添加自定义可信发布者（高级）

## 6. 更新通道

```ts
type UpdateChannel = "stable" | "beta" | "dev"
```

规则：
- 默认 stable
- beta/dev 需用户显式切换
- 不同 channel 的版本不可盲目降级

## 7. 更新策略

### 手动更新（先做）
- 检查更新
- 展示 changelog
- 用户确认后升级

### 自动更新（后做）
可配置：
- off
- notify-only
- auto-for-official
- auto-all（不推荐默认）

自动更新仍需通过校验与权限变更审查。

## 8. 权限变更审查

升级时若新版本新增 permissions：

1. 阻断静默升级
2. 展示权限 diff
3. 用户确认后继续

示例：

```text
+ net.fetch
+ fs.write.workspace
```

## 9. 回滚

P2 目标：

- 保留上一版本备份
- 升级失败自动回滚
- 用户可手动回退（同 id 旧 version）

## 10. 安全事件响应

若发现恶意插件版本：

- 市场侧可标记 yanked
- 宿主 checkUpdates / install 时拒绝
- 已安装用户给出风险提示与一键禁用

## 11. 验收

1. checksum 不匹配无法安装
2. 新增权限升级会提示
3. 官方插件签名策略可配置开关（开发期）
4. 更新检查结果可展示到 UI
