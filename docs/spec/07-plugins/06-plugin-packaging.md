# 19. Plugin Packaging

## 1. 目标

定义插件如何被打包、分发、安装，确保跨机器可复现。

## 2. 包格式

### 2.1 目录包（开发/本地）
直接目录，包含 `manifest.json`。

### 2.2 分发包（推荐）
扩展名：`.piplug`（本质 zip）

```text
demo.hello-0.1.0.piplug
└─ (zip)
 ├─ manifest.json
 ├─ main.js
 ├─ renderer/...
 ├─ skills/...
 └─ checksums.json # 可选，包内清单
```

> 实现期也可先支持 `.zip`，但产品层统一识别 `.piplug`。

## 3. 包内约束

1. 根目录必须有 `manifest.json`
2. 不允许包含绝对路径符号链接
3. 不允许路径穿越（`../`）
4. 单包解压后默认大小上限（建议 50MB，可配）
5. 文件数上限（建议 2000，可配）

## 4. checksums.json（可选但推荐）

```json
{
 "algorithm": "sha256",
 "files": {
 "manifest.json": "hex...",
 "main.js": "hex..."
 }
}
```

宿主安装时可校验。

## 5. 安装流程

```text
select package/dir
 → verify archive safety
 → extract to temp
 → validate manifest + files
 → permission review UX
 → move to installed/<id>
 → registry write
 → optional auto enable
```

失败则清理 temp，不留下半安装目录。

## 6. 版本与覆盖

- 同 id 新版本安装：升级
- 升级前备份旧版到 `cache/backup/<id>/<version>`
- 升级失败可回滚（P2）

语义：
- `install`：id 不存在
- `upgrade`：id 存在且 version 更新
- `reinstall`：同版本强制重装

## 7. 卸载与清理

删除：
- `plugins/installed/<id>`
- registry 项

可选删除：
- `plugins/data/<id>`
- 插件日志

## 8. 开发包

开发加载不走 piplug 打包，直接：

```text
Load Development Plugin → 选择目录 → validate → register(source=dev)
```

## 9. 构建建议（开发者）

最小规范：

- 源码可 TypeScript
- 分发前编译为可直接加载的 js/html/css
- 不依赖宿主去现场 `npm install`（MVP 不支持安装期拉依赖）

若插件需要第三方库：
- 自行打包进插件目录（bundle）

## 10. 验收

1. 可从目录安装
2. 可从 `.piplug`/`.zip` 安装（实现阶段按里程碑）
3. 坏包安装失败且无残留
4. 升级后 id 不变、新 version 生效
