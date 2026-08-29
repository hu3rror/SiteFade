# UI 偏好引导（架构深化 C1）

Type: grilling
Status: resolved
Blocked by: none

## Question

架构评审（`improve-codebase-architecture`，报告 `/tmp/architecture-review-1787970472.html`）三个深化候选之一 C1（Strong）：两条入口 `main.ts`（options/popup）重复同一 boot 序列（loadSettings → applyTheme → initI18n → 设 html lang；options 另设 title），主题/语言副作用散在两处。是否抽 `initUi()` 深模块吸收？范围、interface 形状、测试策略、新术语登记。

## Answer

用户全票照推荐通过（一轮 grilling，Q1–Q4）：

- **范围（Q1-B）**：新建 `src/lib/ui.ts` 导出 `initUi(): Promise<void>`，内部完成 loadSettings → applyTheme → initI18n → 设 html lang。**额外暴露 `applyUiLanguage(pref)`**（= initI18n + 设 html lang），`App.svelte` 的 `onLanguageChange` 改走它——顺带修复潜在缺陷：设置页切换语言后 `<html lang>` 残留旧值直到刷新（a11y）。主题一路本就是单调用 `applyTheme`，不包装。
- **interface（Q2-A）**：`initUi()` 无参自吸收 loadSettings，调用者只学一个函数（深度最大）。mount 与 title 留各入口（options/popup 的 App 组件与 title 不同，吸收进 initUi 会膨胀成通用 launcher）。
- **测试（Q3-A）**：抽纯函数 `htmlLangFor(uiLang): 'zh-CN' | 'en'` 进 `i18n.ts`（纯逻辑文件，与 `resolveLang` 并列），在 `i18n.test.ts` 加用例。`initUi`/`applyUiLanguage` 是 DOM 副作用，node 测试环境无 DOM，不写单测，靠 `pnpm check` + 既有 115 测试回归 + 手测。
- **文档（Q4-A）**：CONTEXT.md「UI 偏好」登记两个新术语：**文档语言（document language）**（`<html lang>` 的 BCP-47 标签值，与界面语言的内部枚举值区分）与 **UI 偏好引导（UI preference bootstrap）**（挂载前按序应用偏好，避免首帧闪烁）；「界面语言」条目补「切换偏好时同步更新文档语言」。

## Comments

决策票沿用仓库 `issues/` 惯例（非 `docs/adr/`）。实现未开始；按 handoff 约定 grilling 定案后再动代码。实现建议 TDD：先写 `htmlLangFor` 测试 → 抽纯函数 → `ui.ts` 吸收 → 改两入口 + `onLanguageChange`。
