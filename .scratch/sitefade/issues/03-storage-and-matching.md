# 研究：存储配额与 10⁴ 条规则实时匹配

Type: research
Status: resolved

## Question

1. `storage.local` / `storage.sync` 在 Chrome 与 Firefox 的配额与权限要求（含 `unlimitedStorage` 的行为差异）。
2. 10⁴ 条规则的规模估算：放到哪一层；"手动规则 + 远程源定义"走 sync 能装多少。
3. 每次访问事件做 10⁴ 条规则判定，可行的数据结构与性能基线。

## Answer

**配额事实**

- `storage.local`：默认 10 MB（Chrome ≤113 为 5 MB），声明 `unlimitedStorage` 后无上限；随扩展卸载清除。
- `storage.sync`：总量 102,400 B（100 KB）／单项 8,192 B／最大 512 项／写 120 次每分、1,800 次每时；超限立即失败并经 `runtime.lastError` 报错。
- Firefox `storage.sync` 默认同为 100 KB 量级（与 Chrome 对齐）；Firefox 的 `unlimitedStorage` 可放开 sync 配额，但 **Chrome 不认** → 跨浏览器统一按 Chrome 的 100 KB 上限设计，不依赖放权。

**规模估算与分层**

- 规则条目平均 25–40 B（域名/通配符形态），10⁴ 条 ≈ 250–400 KB JSON → **远超 sync 100 KB，内容缓存必须放 `storage.local`**（10 MB 默认配额内，无需 unlimitedStorage）。
- sync 只放"手动规则 + 远程源定义 + 设置"这类轻数据。手动规则按 ~30 B/条估算，**建议上限 2000 条（≈40–60 KB）**，为同源配额里的源定义与设置留余量；由票「存储与同步架构」拍板。
- 存储结构：每集合一个 key（手动规则一份、远程源定义一份），远低于 512 项上限。

**匹配器形态（10⁴ 条基线）**

- 朴素线性扫描（每次事件遍历 10⁴ 条字符串判定）可行但数毫秒/事件，非零成本。
- 推荐**编译型匹配器**：
  - 主机名维度：把规则解析为"后缀标签树（Trie，从最右标签逐级向下）"，每条通配符/裸域名规则挂在对应节点（`*`=本层任意单级、`+`=含根多级、`.`=不含根多级、裸域名=含根多级）；判定一次命中的代价 ≈ O(主机名标签数)，与规则总数无关。
  - 精确 URL 维度：HashMap 直接查（含协议/path 归一后的键）。
- 规则集合变更（如导入 10⁴ 条）时重建整棵树：单次重建几十毫秒级，可接受；或在写入端防抖（数百 ms 内合并多次变更），由匹配票定。
- 事件频率：onVisited 约每次顶层导航 1 次（+重定向多次），事件流稀疏，匹配器余量充足。

关键来源：Chrome storage API 参考（10MB/unlimitedStorage 与 sync 配额表）；Firefox storage.sync 文档；Chrome 开发者文档 cross-origin 与权限说明。

## Comments

绘图会话直解。上限数字与重建时机交票「存储与同步架构」「删除机制与匹配器选型」确认。