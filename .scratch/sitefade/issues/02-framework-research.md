# 研究：扩展构建框架与 UI 栈现状

Type: research
Status: resolved

## Question

2025 年的扩展构建框架现状：WXT / Plasmo / CRXJS（Vite 插件）各自的维护活跃度、MV3 支持、Chromium+Firefox 双目标构建能力、"自主打包可分发产物"的支持度；以及 popup/设置页的 UI 框架选择。

## Answer

- **推荐 WXT**（wxt.dev）：积极维护；Vite 底座；MV3（保留 MV2 兼容）；同一代码库构建 Chrome / Edge / Firefox / Safari；manifest 自动生成；开发期 HMR；官方 publishing 指南与 zip 打包支持（`wxt build` 直接产出各浏览器 `dist` + 可分发压缩包）——完全满足"不上架、GitHub 分享、自主打包"场景。
- **Plasmo 有维护风险**：主分支最新发布 v0.90.5（2025-05-17），此后基本无新动作；框架层维护停滞对长期项目是风险。
- **CRXJS 只是 bundler 插件**，不自成框架，配套 WXT（其作者同时是 WXT 生态核心）。
- **UI 栈**：WXT 框架无关。popup + 设置页属轻量界面，推荐 **Svelte 5** 或 **Vue 3**（体积小、模板简洁）；React 亦可但无必要。TypeScript 默认。
- **备查**（本图出界，仅在将来上架时相关）：WXT 产物经打包压缩，若未来提交 AMO 需附源码与构建说明（Firefox 扩展工坊的源码提交要求）。

关键来源：wxt.dev 对比页（WXT vs Plasmo vs CRXJS 功能表）；AddOne News 与社区 2025 框架现状分析；Plasmo releases。

## Comments

绘图会话直解。UI 栈最终三选一由票「UI 技术栈与打包形态锁定」拍板。