# 研究：删除机制与 history API 事实

Type: research
Status: resolved

## Question

靠什么 API 组合能最可靠地做到"访问写入历史后立即删除"？

1. hook 对比：`history.onVisited` vs `webNavigation.onCommitted` vs `tabs.onUpdated`——哪个在"写入完成后"触发、哪个在写入前触发；onVisited 对同一次访问是否多次触发；各自要求的权限。
2. `deleteUrl` 语义：是删除该 URL 的一次 visit 还是全部？是否连带清理 favicon？删除后 omnibox 建议是否会消失？
3. 已知竞品（History AutoDelete 等）的做法与已知坑。
4. Firefox 与 Chromium 的行为差异；隐私/无痕模式怎么写历史。

## Answer

- **主 hook = `history.onVisited`**。MDN：事件发出时该 URL 已入历史（此时页面标题尚不可知，`title` 为空或旧值——实现只应消费 `url`/`lastVisitTime`）。对比：`webNavigation.onCommitted` 在导航提交时触发，早于历史写入，此后再删除有竞态（visit 可能随后才写入）；`tabs.onUpdated` 需 `tabs` 权限且语义宽泛。onVisited 是"写后"信号，最接近"写入即删"目标。
- **`history.deleteUrl({url})` 一次调用删除该 URL 的全部 visit**（"The URL whose visits should be removed"），返回 Promise。Chrome 与 Firefox 同构（Firefox 实现源自 Chromium 的 history.json）。删除动作不会重入 onVisited（删除走 `onVisitRemoved` 事件）。
- **幂等要求**：onVisited 对一次真实访问可能多次触发（重定向链、URL 规范化、历史项更新）。处理必须幂等——重复 deleteUrl 无害，天然满足。
- **删除效果**：URL 从历史与基于历史的 omnibox 建议中消失；favicon 在该 URL 的最后一次访问被删后随之清理（社区共识；若需绝对确认可在原型阶段用 `history.search` 验证）。
- **权限**：任何 history API 调用都要求 `"history"` 权限；该权限在 Chrome/Firefox 均触发"读取浏览记录"类警告——产品本质所致，接受。onVisited 不需要 `tabs` 或 `webNavigation`。
- **竞品基线**：History AutoDelete 等主流实现同样走 history API 事件 + deleteUrl/deleteRange，无第三方先例能"阻止写入"。
- **隐私模式**：Chrome 无痕/Firefox 隐私窗口不写入持久历史，天然满足"不进历史"，无需处理。

关键来源：MDN `history.deleteUrl` / `history.onVisited`（2025-07 修订）；Chrome history API 参考；MDN webNavigation 事件顺序；开发者社区关于 onVisited 多次触发的讨论（Stack Overflow #63113667）。

## Comments

绘图会话直解（无子代理环境）。结论已写入地图 Decisions so far，并供票「删除机制与匹配器选型」引用。