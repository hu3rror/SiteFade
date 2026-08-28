# UI 技术栈与打包形态锁定

Type: grilling
Status: resolved
Blocked by: 02

## Question

票 02 研究结论：框架推荐 **WXT**；UI 栈在 Svelte 5 / Vue 3 / React 之间选。待定：

1. **UI 框架三选一**：建议 Svelte 5（轻量、模板简洁，popup/设置页规模合适）；Vue 3 次选（生态更熟）；React 最后（体积非必要）。TypeScript 默认（建议接受）。
2. **打包产物形态**（验收线 = GitHub 分享自主打包）：`wxt build` 产出各浏览器 `dist/`，release 挂 `zip` + 安装说明（开发者模式加载 unpacked 或直接装 zip）。确认此形态为验收标准？
3. **其它**：MV3 双目标（已定）；Node 版本基线是否值得在此定（实现会话再定即可，建议不回退）？

## Answer

会话确认，3 条全部采纳。

1. **UI 框架 = Svelte 5 + TypeScript**（WXT 脚手架原生支持；Vue 3 为备选）。popup + 设置页规模下 Svelte 5 体积小、模板简洁。
2. **打包产物形态（验收线 = GitHub 分享自主打包）**：`wxt build` 产出按浏览器分目录的 unpacked（`dist/chrome-mv3/`、`dist/firefox-mv3/`）与 zip；release 挂包 + 中文安装说明 README（开发者模式加载 unpacked / 直接装 zip）。验收 = 一份干净下载的包能在 Chromium 系与 Firefox 手动加载后正常运行。`wxt submit`（商店提交）出界，不碰。
3. **样式方案**：不引入第三方 UI 组件库，原生 CSS + CSS 变量（深色模式留变量口子）。**Node 基线 ≥ 20 LTS**。

**影响面**：票 09 原型按 Svelte 5 心智产出；实现会话按此栈初始化 WXT 项目（脚手架选 Svelte-ts 模板）。

## Comments

用户采纳。09 已解除阻塞；地图 Decisions 更新。