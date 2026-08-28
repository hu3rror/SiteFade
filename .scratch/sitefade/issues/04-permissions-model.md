# 研究：权限集合与远程源拉取模式

Type: research
Status: resolved

## Question

1. SiteFade 的最小权限集合是什么（基于票 01 的 onVisited 主 hook 结论）。
2. 扩展页（service worker / popup / 设置页）fetch 远程源清单的 CORS 约束与正确姿势；`optional_host_permissions` 的跨浏览器支持。
3. 各权限触发的用户警告；AMO 审查约束是否影响本图（已知不上架）。

## Answer

- **最小权限建议**：`permissions: ["history", "storage"]`；若票「远程源规格」确认做"可选定时刷新"，加 `"alarms"`（无警告）。`webNavigation`、`tabs` 均不需要（主 hook 是 `history.onVisited`，见票 01）。10⁴ 条内容在 `storage.local` 默认 10 MB 配额内，不需要 `unlimitedStorage`。
- **`"history"` 权限触发警告**：Chrome「读取你的浏览历史」、Firefox 同类——产品本质所致，接受，不做规避。
- **远程源拉取**：扩展页的 fetch 受 CORS 约束（与普通网页同源策略一致）；声明对应 host 权限后扩展起源不受 same-origin 限制。正确模式：
  1. 优先尝试直接 fetch——很多公开列表端点（如 GitHub raw）返回 `Access-Control-Allow-Origin: *`，无需任何 host 权限即可成功；
  2. 仅在 CORS 失败时，添加源时经一次用户手势（设置页按钮）调用 `chrome.permissions.request`（Firefox：`browser.permissions.request`，MV3 支持 optional host permissions），按源授权（如 `https://raw.githubusercontent.com/*`），不用过宽的 `<all_urls>`；可撤销。
  - 结论：**默认零 host 权限 + 按源运行时授权**，最小暴露。
- **AMO 审查（备查，本图出界）**：AMO 对远程内容/远程拉取有严格政策且需提交源码；不上架则不受约束。保留"按源授权"模式即是最佳卫生，日后上架也走得通。

关键来源：Chrome「Cross-origin network requests」「Declare permissions」「chrome.permissions」文档；MDN permissions；Firefox 扩展工坊 Add-on 政策。

## Comments

绘图会话直解。按源授权的交互细节交票「远程源规格」。