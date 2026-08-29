# i18n 与主题模式（推翻「不做 i18n」，新增 UI 偏好同步）

Type: grilling
Status: resolved
Blocked by: none

## Question

用户拍板本阶段做 **i18n（多语言）+ 主题切换（夜间/白天/自动跟随设备）**，推翻地图既定约束「界面文案默认中文，不做 i18n（原型票可改）」。涉及：语言集合与默认、翻译架构、业务错误消息是否一并抽取、主题偏好与界面语言偏好存哪（是否随账号同步）、存储 schema 变更方式、新领域术语。

## Answer

**主题（theme）**
- 三态：`跟随系统 / 浅色 / 深色`，默认**跟随系统**。切换 UI 只在设置页（新增「外观」区块）；popup 无入口、启动时读取已存偏好应用 `data-theme`（纯 CSS `@media (prefers-color-scheme)` 承载自动跟随，免 JS 监听，OS 变化即时生效）。
- 颜色实现：`base.css` 增加深色变量组（`[data-theme="dark"]` 覆盖 + 跟随系统），修复现有 ~5 处硬编码色（按钮 hover 边框、表头背景、primary 按钮文字色、状态点、toast），新增 `--accent-contrast`（按钮文字色）保证深底对比度；正文按 WCAG AA 核对。
- 偏好存 `settings`（sync，随账号同步），与 `pageSize` 同 blob。

**i18n**
- 覆盖范围：**UI 文案 + 业务错误消息全量**（业务侧错误改发**错误 key**，UI 层 `t()` 查表翻译）+ manifest `__MSG_`（name `SiteFade` 专有名词不动，只抽 description）。
- 语言：`zh_CN` + `en` 两档；默认跟随浏览器 locale（`zh` 前缀→中文），缺失 key 回退 `zh_CN`（中文为完整基线、英文为翻译档）。
- 架构：**自建轻量 `t()` 层**（`chrome.i18n` 语言由浏览器固定、运行时不可切，故自建）。文案单一来源 `public/_locales/{zh_CN,en}/messages.json`（同时喂 manifest `__MSG_`），运行时按「界面语言偏好 → 浏览器语言」选字典。`t(x)` 对非 key 输入恒等返回（原生串如 `HTTP 404`、网络错误文本原样透出）。
- 命中来源标签（`手动/远程「名」`）从 background 改到 UI 层拼装（`StatusSnapshot` 提供结构化 source + sourceName）。
- 偏好存 `settings`（sync）。

**存储**
- settings blob 新增可选字段 `theme`（`system|light|dark`，默认 `system`）与 `language`（`zh_CN|en|null`，null=跟随浏览器）。
- **保持 VERSION=1**，`decodeSettings` 加可选字段、缺省兜底（老 blob 无新字段 → 默认值，零迁移、数据无损）；v2 迁移机制留给未来真正的破坏性变更。

**文档**
- 新术语登记 `CONTEXT.md`：**主题偏好（theme preference）**、**界面语言偏好（UI language preference）** 与**界面语言（UI language）**（偏好=存储选择/可能未设定，语言=生效展示值）、**错误标识（error key）**（业务层产稳定标识、界面层查字典翻译）。
- README 补「随账号同步数据」说明：主题偏好、界面语言随设置同步；PIN 哈希与远程内容仅本机。

## Comments

两轮 grilling 全票「照推荐」通过；Q8 决议本票作为决策留痕挂回地图索引。实现拆分见 `.scratch/i18n-theme/issues/`（7 张垂直切片，01–07）。
