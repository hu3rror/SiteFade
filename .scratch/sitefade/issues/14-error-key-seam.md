# 错误标识 seam 类型化（架构深化 C3）

Type: grilling
Status: resolved
Blocked by: none

## Question

架构评审（`improve-codebase-architecture`，报告 `/tmp/architecture-review-1787970472.html`）三个深化候选之三 C3（Speculative）：业务错误 key 裸 `string`、「key 或原始串」契约藏在 `t()` 恒等透出 → `ErrorKey` 联合类型显式化。**不推翻**票 11 的刻意决定（错误标识=字典 key，换取 locality），只把契约变显式。

## Answer

用户全票照推荐通过（一轮 grilling，Q1–Q5）：

- **类型来源（Q1-A）**：手工枚举子集，仅覆盖「纯 key 字段」实际用到的 key——parser 9 个（`error_badScheme`/`hasWhitespace`/`invalidHost`/`invalidIpv6`/`invalidPort`/`invalidPortEntry`/`invalidUrl`/`missingHost`/`tooLong`）+ manage 3 个（`error_httpOnly`/`invalidUrl`/`urlExists`），共 12 个；放 `src/lib/types.ts`。不从 `_locales` 生成（避免 JSON import 类型魔法，仓库偏好低复杂度）；不全量枚举 21 个（避免拖入混合字段）。
- **范围（Q2-A）**：只动纯 key 字段——`parser.ts` `parseLine` 的 `{ error }` 返回、`ParseIssue.reason`、`importRules.ts` 的 `invalidDetail[].reason`、`manage.ts` `AddSourceResult.error`。**混合字段（`FetchOutcome.detail`、`PopupResponse.error`）保持 `string` 不动**（必须接受原始串 `HTTP 404`/`e.message`，强行标注退化成 `ErrorKey | string` 只制造噪音）。
- **t() 契约（Q3-A）**：`t()` 签名不动（恒等透出保持现状）；`ErrorKey` 只标注产出侧（业务字段），消费侧（UI `t(res.error)`）照旧。
- **测试（Q4-A）**：不新增测试——`ErrorKey` 是编译期契约，`pnpm check` 兜底；`parser.test.ts`/`manage.test.ts` 既有断言（key 字符串）继续覆盖运行期，无需改。
- **文档（Q5-A）**：CONTEXT.md「错误标识」条目补一句：业务层错误输出以 `ErrorKey` 联合类型显式标注，混合字段仍为 `string`。

## Comments

决策票沿用仓库 `issues/` 惯例。实现顺序：types.ts 加 `ErrorKey` → parser.ts / importRules.ts / manage.ts 类型标注 → `pnpm check` + 全量测试回归。
