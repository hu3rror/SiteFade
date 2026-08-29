# 操作提示集中化（架构深化 C2）

Type: grilling
Status: resolved
Blocked by: none

## Question

架构评审（`improve-codebase-architecture`，报告 `/tmp/architecture-review-1787970472.html`）三个深化候选之二 C2（Worth exploring）：`onToast` 穿 ImportSection / RulesSection / SecuritySection 三个 interface，计时与渲染态留在 App → 模块级 toast 存储。

## Answer

用户全票照推荐通过（一轮 grilling，Q1–Q6）：

- **模块形态（Q1-A）**：新建 `src/lib/toast.svelte.ts`——模块级 `$state` 消息 + `showToast()` 写口 + 内部自动隐藏 timer + `currentToast()` 函数读取，复用 `i18n.svelte.ts` 先例（`.svelte.ts` = runes 状态模块）。不塞进 i18n.svelte.ts、不用 Svelte context。
- **入参类型（Q2-A）**：`showToast(text: string)` 接收**已翻译文本**；调用方按「错误标识」契约决定传 key 还是原始串，toast 层不关心。不改成 `(key, params)`（牵动 16 处调用点且违背契约）。
- **计时归属（Q3-A）**：timer 为模块私有（`let timer`），`showToast` 内 clear 重设；延迟固定 3000ms 不参数化（参数化是 Speculative Generality）。
- **移除范围（Q4-A）**：三个 section 全移除 `onToast` prop（interface 缩小），App.svelte 删 `toast`/`toastTimer`/`notify`，模板保留 `{#if currentToast()}<div class="toast">{currentToast()}</div>{/if}`（渲染位置仍在 App，仅数据源改模块）。SecuritySection `persist(hash, toast)` 参数顺手改名 `msg`（消除歧义遗留）。
- **术语（Q5-A）**：CONTEXT.md 登记「**操作提示（toast）**」——设置页操作结果的瞬时反馈，约 3 秒自动消失，内容是「错误标识」契约翻译后的文本，仅本机不持久。
- **测试（Q6-A）**：与 C1 决议一致，toast 模块是 DOM + timer 副作用，无纯逻辑 seam（3s 固定、无分支），**不写单测**，靠 `pnpm check` + 全量回归 + 手测。

## Comments

决策票沿用仓库 `issues/` 惯例。实现建议：先建 `toast.svelte.ts` → 改三个 section（机械替换 `onToast(x)` → `showToast(x)` + 移除 prop）→ App.svelte 收尾 → SecuritySection 命名。
