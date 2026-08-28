# 存储与同步架构（含手动规则同步上限）

Type: grilling
Status: resolved
Blocked by: 03

## Question

配额事实与规模估算见票 03（sync 100 KB 总/8 KB 项/512 项；local 10 MB；10⁴ 条 ≈ 250–400 KB）。同步模型已定：**sync = 手动规则 + 远程源定义 + 设置；local = 远程内容缓存**（各设备自行拉取，内容不同步）。待定：

1. **手动规则上限**：票 03 建议 2000 条（≈40–60 KB，为同源配额里的源定义与设置留余量）。接受？
2. **超限行为**：拒绝新增并提示（推荐，简单）？还是自动转入本地区分（另一份手动列表，不同步）？
3. **存储结构**：每集合一个 key（`manual`、`remoteSources`、`settings`）满足 512 项限制；规则条目带来源标记（`manual` / `remote:<sourceId>`）与 ID；schema 带 `version` 字段以便未来迁移。确认？
4. **匹配器重建时机**：任何写入后立即重建（10⁴ 条 ~几十 ms）vs 写入端防抖合并（推荐）？
5. **多设备冲突**（预判约束，不实现）：json blob 整体 last-write-wins——只记录为架构约束，冲突 UX 留待后续（见地图 Not yet specified）。

## Answer

会话确认（上限由推荐值 2000 调整为 1000）。

1. **手动规则上限 = 1000 条**（≈20–40 KB，sync 配额余量充足）。
2. **超限行为 = 拒绝新增 + 明确提示**（“手动规则已达上限 1000，请清理或改用远程源”）；不做自动转本地的第二份列表。
3. **存储结构**：sync 三个单 blob key——`manual`、`remoteSources`、`settings`，各自带 `version` 字段（当前 1，升级就地在原 key 上进行）；本地按源缓存 key `remote.<sourceId>`（不上 sync）。规则条目带 ID 与来源标记（`manual` / `remote:<sourceId>`），供设置页与 popup 展示“命中规则来自哪”。**单 blob 是硬约束**：sync 的 512 项上限使“逐条 key”方案（≈510 条即满）直接出局，同时 last-write-wins 语义随 blob 整体替换天然成立。
4. **匹配器重建时机 = 写入端防抖合并**（如 200 ms 内合并多次写入、重建一次）；10⁴ 条单次重建 ~几十 ms 可接受，防抖避免批量导入重复重建。
5. **多设备冲突**：blob 整体 last-write-wins 记录为架构约束；冲突 UX（提示与展示）留待 fog 明确后再议。**卸载清理无需自建**：卸载时浏览器移除扩展的 storage（Chrome/Firefox 行为），该项从 fog 移除。

**影响面**：票 08 匹配器按“合并视图（manual + 各远程缓存）+ 防抖重建”实现；票 09 设置页展示来源标记与手动规则用量/上限。

## Comments

用户采纳，手动上限调为 1000。CONTEXT.md 新增“来源”术语；地图 fog 移除“卸载清理”、修订冲突 UX 与 schema v2 表述。