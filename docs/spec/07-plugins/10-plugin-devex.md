# 23. Plugin Developer Experience

## 1. 目标

让开发者 10 分钟内创建并加载一个本地插件。

## 2. 开发者路径

```text
创建模板
 → 改 manifest / main / panel
 → 在 PI-Desktop Load Development Plugin
 → 命令面板验证
 → 打包 piplug
```

## 3. 模板类型

官方模板（后续提供）：

1. `panel-basic`：只面板 + 命令
2. `agent-tool-basic`：注册 tool
3. `skill-pack`：仅 skills
4. `full-demo`：panel + tool + skill + settings

当前仓库示例：
- `examples/plugins/hello`

## 4. SDK 规划

包名建议：`@pi-desktop/plugin-sdk`

提供：
- manifest 类型
- 权限枚举
- API 类型（`PiPluginHostApi`）
- manifest 校验函数
- 测试 helper（mock host）

## 5. 本地开发命令（规划）

```bash
# 校验 manifest
pnpm pi-plugin check .

# 打包
pnpm pi-plugin pack .

# 输出 dist/demo.hello-0.1.0.piplug
```

## 6. 热重载

开发模式支持 watch：

- 变更 manifest：重新 validate + reload
- 变更 main：reload runtime
- 变更 renderer：panel 刷新

失败时 UI 显示 load_error，不崩宿主。

## 7. 调试

最低要求：
- 插件日志面板（按 pluginId 过滤）
- 可查看注册的 commands/tools
- 可复制错误堆栈

后续：
- 独立 DevTools 给 panel
- mock tool 调用器

## 8. 文档清单（开发者站点/仓库 docs）

- 快速开始
- manifest 字段
- 权限说明
- API 手册
- 发布手册（pack/sign）
- 安全最佳实践

## 9. 质量门槛（发布前建议）

- manifest 校验通过
- 无未声明权限调用
- 有 README
- 有版本 changelog
- 若含 tool：提供参数样例

## 10. 验收

1. 基于 hello 示例可复制出新插件
2. 开发加载成功
3. 修改代码后可重载
4. pack 产物可安装
