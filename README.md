# SiteFade

访问清单内站点后，立即从浏览历史中删除其访问记录——让这些站点**不出现在浏览历史**里。

- 双浏览器：Chromium（Chrome/Edge/Brave 等）+ Firefox，Manifest V3
- 不上架商店，GitHub 分享、自主打包
- 界面中文，不做 i18n

## 它能做什么

- **实时删除**：站点被记入历史后立即删除该 URL 的全部访问记录，幂等、失败静默。
- **规则清单**：手动规则（随账号同步，上限 1000 条）+ 远程源（URL 拉取清单，内容仅存本机）。匹配在本地完成，远程内容纯数据解析、从不执行。
- **两种 UI**：工具栏 popup（当前站点状态 + 一个开关）、设置页（导入 / 规则清单 / 远程源 / PIN 锁 / 导出）。
- **PIN 锁**：可选 4 位 PIN 保护设置页，仅存本机 SHA-256 哈希，不存明文、不同步。

## 安装

### Chromium（Chrome / Edge / Brave 等）

1. 从 Release 下载 `sitefade-<版本>-chrome.zip` 并解压，或使用 `pnpm build` 后取 `dist/chrome-mv3/` 目录。
2. 打开 `chrome://extensions`，开启右上角「开发者模式」。
3. 点「加载已解压的扩展程序」，选择解压后的目录（含 `manifest.json`）。
4. 首次启用只保护**未来**的访问，不会清扫既有历史。

> 也可以直接把 zip 拖进 `chrome://extensions` 安装（Chromium 系支持）。

### Firefox

1. 从 Release 下载 `sitefade-<版本>-firefox.zip`，或使用 `pnpm build:firefox` 后取 `dist/firefox-mv3/`。
2. 打开 `about:debugging#/runtime/this-firefox`，点「临时载入附加组件」，选择 zip 或 `manifest.json`。

> Firefox 临时加载的扩展在浏览器重启后失效，属正常现象；上架或签名可解决，本项目不上架。

### 权限说明

安装时申请 `history`、`storage`、`alarms`、`activeTab`：

- `history`：删除历史记录所必需（会显示「读取浏览历史」警告，属产品本质）。
- `storage` / `alarms`：规则存储与远程源定时刷新（默认关闭）。
- `activeTab`：popup 读取当前标签页地址。
- **不申请任何网站访问权限**。远程源按需运行时授权（首次拉取遇到 CORS 时才会请求该来源，可撤销）。

## 规则语法

每行一条规则，`#` 开头为注释，空行忽略。导入时自动规范化（小写、IDN→punycode、去尾斜杠）并去重。

| 形态 | 示例 | 匹配语义 |
|---|---|---|
| 裸域名 | `baidu.com` | 该域名及全部子域 |
| 单级通配符 | `*.baidu.com` | 仅一层子域（不含根） |
| 多级含根 | `+.baidu.com` | 根域名及全部子域 |
| 多级不含根 | `.baidu.com` | 全部子域（不含根） |
| 裸 `*` | `*` | 不含点的主机名（如 `localhost`） |
| IP 字面量 | `127.0.0.1`、`[::1]` | 该主机全部 URL |
| 带端口条目 | `example.com:8080` | 仅该主机+端口 |
| 精确 URL | `https://x.com/a` | 按 scheme+主机+路径；query/hash 忽略 |

`chrome://`、`about:`、`data:` 等特殊 scheme 一律无效（`file://` 仅限精确 URL 规则）。

## 开发

```bash
pnpm install
pnpm dev          # 开发模式（Chromium）
pnpm build        # 产物 dist/chrome-mv3/ + zip
pnpm build:firefox# 产物 dist/firefox-mv3/ + zip
pnpm test         # 单元测试（解析/匹配/PIN/源状态机）
pnpm check        # svelte-check 类型检查
```

技术栈：WXT + Svelte 5 + TypeScript，原生 CSS + 变量，无 UI 组件库。

## 目录

```
src/entrypoints/background.ts   后台：onVisited 删除、匹配器防抖重建、alarms、popup 消息
src/entrypoints/popup/          工具栏小窗
src/entrypoints/options/        设置页
src/lib/matcher/                编译型匹配器（主机后缀 Trie + 精确表）
src/lib/rules/                  规则解析/规范化、手动导入
src/lib/storage/                sync 三单 blob + local 缓存
src/lib/sources/                远程源拉取、失败状态机、管理
src/lib/pin/                    PIN 哈希与锁定
```

## 隐私

- 仅本机处理，无遥测、无网络上报（远程源按你的配置主动拉取除外）。
- 规则与远程源定义随浏览器账号同步；远程内容仅存本机，各设备自行拉取。
- 手动规则、源定义、设置存 `storage.sync`；远程内容与 PIN 哈希存 `storage.local`（PIN 不随账号同步）。
