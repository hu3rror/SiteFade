# SiteFade

Chromium + Firefox 浏览器扩展（WXT + Svelte 5 + TS，MV3）：访问清单内站点后立即从历史删除其访问记录。不上架，GitHub 分享自主打包。

## 领域词汇

术语、通配符与规则语义以仓库根 `CONTEXT.md` 为唯一权威。写代码用术语、或要新增概念时先读它（`domain-modeling` 技能负责登记）。

## 仓库约定

- **决策记录**在 `.scratch/sitefade/issues/`（`Type: grilling` / `Status` 结构），`map.md` 索引；新决策沿用该格式，不另开 `docs/adr/`。
- **i18n 文案**单一来源 `public/_locales/{zh_CN,en}/messages.json`；消息 key 一律下划线（Chrome 只许 `[a-zA-Z0-9_]`，点分 key 会校验失败）。
- **错误输出**：纯 key 字段用 `ErrorKey` 联合类型（`src/lib/types.ts`）；混合字段（`FetchOutcome.detail`、`PopupResponse.error`，key 或原始串）保持 `string`；`t()` 对非 key 原始串恒等透出（见 CONTEXT「错误标识」）。
- **测试**：vitest 为 node 环境（无 DOM）——副作用模块（写 DOM / timer）不写单测；纯逻辑（`i18n.ts`、`parser.ts` 等）写单测。
- **发布**：tag 必须等于 `package.json` version（workflow 校验失败即报错）；打 tag 前先 bump version。

## 会话流程

架构或计划讨论：`grilling`（设计树）→ `domain-modeling`（术语登记 CONTEXT.md）→ 定案后 `implement`（TDD 在预约定 seam）→ `code-review`（本环境无并行子代理，两轴内联执行）。
