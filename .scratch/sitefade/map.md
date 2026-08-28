# SiteFade 技术路线地图

## Destination

钉死 SiteFade 的技术路线决策：**删除机制、构建/UI 框架、规则存储与匹配、导入与远程源规格、权限模型**。地图走完 = 所有决策票关闭，路线全部清晰、无遗留待决问题，可直接进入实现。终点是决策，不产出成品代码。

验收线（决定终点的形状）：按此路线可实现的扩展——Chromium + Firefox 双目标、一个代码库、装完即用、支持至多 10⁴ 条规则实时匹配、导入支持网络与本地、不上架仅 GitHub 分享（自主打包产物可挂 release）。

## Notes

- 领域：浏览器扩展，Manifest V3，Chromium + Firefox。
- 流程：每次处理决策票前先读 grilling 与 domain-modeling 技能（wayfinder 规则）；UI 原型票用 prototype 技能。术语与通配符语义见仓库根 `CONTEXT.md`（已定约束，不重复开票）。
- **绘图前两轮 grilling 已确认的既定约束**（不再开票，实现时直接遵守）：
  - 删除承诺 = 实时删除（写入后立即删），不做定时/启动清扫（“自动删除就行了”）。首次启用也不清扫（装完只保护未来访问），由票「删除机制与匹配器选型」确认。
  - 规模基线：10⁴ 条以内。
  - 同步模型：跨设备仅同步**手动添加的规则 + 远程源定义**；远程内容由各设备自行拉取，不同步。手动规则同步上限由票「存储与同步架构」拍板。
  - UI 表面 = 工具栏 popup + 设置页（原型票细化）。
  - 远程源刷新 = 手动为主 + 可选定时（默认关）。
  - 不上架，GitHub 分享 + 自主打包；界面文案默认中文，不做 i18n（原型票可改）。
  - 导入格式 = 每行一条纯文本（含 `#` 注释、空行忽略、类型自动识别、规范化去重），不做 CSV/JSON。
- 本环境无并行子代理工具：research 票由会话直接解析（wayfinder 规则允许），研究结论与来源直接写在票内 `## Answer`。
- 一个会话只解一张需要人往返的票；研究票不受此限。

## Decisions so far

<!-- 索引：每行一条已关闭票；详细持有答案，地图只给一行要旨 -->

- [研究：删除机制与 history API 事实](./issues/01-history-delete-mechanism.md)：以 `history.onVisited`（写后信号）为主 hook 配 `deleteUrl`（一次删该 URL 全部 visit）；仅需 `history` 权限；onVisited 会多次触发，处理须幂等
- [研究：扩展构建框架与 UI 栈现状](./issues/02-framework-research.md)：推荐 WXT（维护活跃、MV3、一库多浏览器、自带打包）；Plasmo 维护停滞有风险；UI 栈待票「UI 技术栈与打包形态锁定」
- [研究：存储配额与 10⁴ 条实时匹配](./issues/03-storage-and-matching.md)：`storage.sync` 100KB/512 项放不下大清单 → 内容缓存走 `storage.local`（10MB，可 unlimitedStorage）；匹配器形态 = 主机后缀 Trie + 精确 URL 表；手动规则上限建议 2000
- [研究：权限集合与远程源拉取模式](./issues/04-permissions-model.md)：最小权限 `history` + `storage`（+`alarms` 可选）；远程源用 `optional_host_permissions` 按源运行时授权；CORS 可用的源免授权
- [规则语法边界与导入规范化规格](./issues/05-rule-grammar-edges.md)：IP 字面量=主机精确命中（IPv6 独立）；带端口条目=精确主机+端口、纯主机规则忽略端口；scheme 仅 http/https（file:// 例外）；精确 URL 按 scheme+host+path 匹配（query/hash 忽略）；不做 www 归一；非法规则单条跳过、导入结束给新增/重复/无效摘要
- [存储与同步架构（含手动规则同步上限）](./issues/06-storage-sync-architecture.md)：手动规则上限 1000、超限拒绝新增并提示；sync 三单 blob key（manual/remoteSources/settings，带 version）——512 项上限使逐条 key 出局；本地按源缓存；匹配器重建=写入端防抖合并；blob 整体 last-write-wins
- [远程源规格（拉取、刷新、失败处理、合并）](./issues/07-remote-source-spec.md)：每源=URL/名称/启用/自动刷新(小时,默认关)/手动刷新；添加即拉、启动不拉、首拉失败可建源；失败原因分类透出、连续 3 次自动停用、响应上限 2MB；远程内容校验同本地；全局去重、手动优先；设置页每源显示状态/条数/上次成功时间
- [删除机制与匹配器选型（技术路线核心决策）](./issues/08-mechanism-matcher-decision.md)：主 hook=onVisited+deleteUrl 幂等、仅需 history 权限；不做任何清扫（含首次启用）；失败静默+popup 权限提示；匹配器=主机后缀 Trie+精确 URL 表（判定与删除分离、防抖重建）；内部页无特判
- [UI 技术栈与打包形态锁定](./issues/10-framework-lock.md)：WXT + Svelte 5 + TypeScript；产物=按浏览器分目录 unpacked + zip、release 挂包 + 中文安装说明；不引 UI 组件库（原生 CSS + 变量）；Node ≥20 LTS
- [UI 表面原型（popup + 设置页）](./issues/09-ui-prototype.md)：popup=状态+开关（“不记入历史”措辞、无最近命中）；设置页=单列流、规则分页（默认每页 50）；PIN 锁：4–6 位、默认关、SHA-256 仅本地、错 5 次锁 30s、popup 重置
  - **实现修订（2025-08 用户实测后）**：规则分页默认改为每页 10；区块改序（添加规则→规则清单→设置锁→导出，远程源并入“添加规则”区块、规则清单不再有手动添加输入）；“导入清单”更名“添加规则”；PIN 固定 4 位（去掉位数选择），改用圆点+数字键盘的 PinPad（隐藏明文、填满自动提交）；重置设置入口移至 PIN 锁定屏与设置页底部（popup 不再提供）

## Not yet specified

- 规则存储 schema 的 v2 场景与迁移策略（version 机制已定：单 blob 带版本、原地升级；何时需要 v2 与具体迁移未定）——临近实现再定。
- 多设备同时编辑手动规则时的冲突 UX（数据语义已定 last-write-wins，提示与展示未定）——首次真出现多设备场景时再定。
- 可选未做项：设置页“立即清理存量命中记录”手动按钮（票 08 决策为默认不做；若日后要补，从此起步）。

## Out of scope

<!-- 明确划出界的：不属本图雾气，永不毕业；只有重画目的地（新 effort）才回得来 -->

- **商店上架**（CWS/AMO 账号、审核、商店页面）——确认不上架；AMO 审查约束因此不适用（卡「构建框架」票记录备查，有源码提交要求）。
- **Safari、移动端**——目标仅 Chromium + Firefox。
- **"阻止写入历史"**——两浏览器均无此 API，能力边界=删除。
- **附加功能**：反指纹、代理、广告拦截、历史导出/恢复。
- **规则语法扩展**：行内注释、优先级、时间段规则、外部过滤列表语法（如 EasyList）。