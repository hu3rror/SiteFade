# SiteFade

[English](README.md) · [简体中文](README_zh-CN.md)

一个给 Chromium 和 Firefox 的小扩展（Manifest V3）。清单里出现的站点，访问一被浏览器写进历史，SiteFade 就把它删掉。不管打开多少次，它都不会出现在历史里。

## 一次访问是怎么消失的

浏览器记历史是事件驱动：页面一加载，这次访问就落盘了，扩展拦不住这一步。SiteFade 选择晚一步动手。

1. 浏览器写入本次访问。
2. `history.onVisited` 触发。
3. 拿真实 URL 跟规则清单比对。
4. 命中就调 `history.deleteUrl` 删掉；没命中则什么都不做。

这个设计带来几个特性：

- 删除幂等且安静。URL 早已不存在时，删除会默默失败，不报错。
- 启用时不清扫。开扩展只保护以后的访问，既有历史原样保留。
- 没有定时清理。删除发生在写入的同一时刻，没有可回填、可排期的任务。
- 匹配全程本地。清单编译成主机后缀 Trie 加上精确主机表、精确 URL 表，数据不出本机。

## 清单

一行一条规则。`#` 开头的是注释，空行跳过。导入时每条规则都会规范化（小写、IDN 转 punycode、去末尾斜杠），重复项合并，无效项单独报出来而不是让整个导入失败。导入摘要会告诉你几条新增、几条重复、几条无效，明细可以展开。

| 规则形态 | 示例 | 匹配什么 |
|---|---|---|
| 裸域名 | `baidu.com` | 该域名及全部子域 |
| 单级通配符 | `*.baidu.com` | 恰好一层子域，不含根 |
| 多级含根 | `+.baidu.com` | 根域名加全部子域 |
| 多级不含根 | `.baidu.com` | 只子域，不含根 |
| 裸 `*` | `*` | 不带点的主机名，如 `localhost` |
| IP 字面量 | `127.0.0.1`、`[::1]` | 该主机上的所有 URL |
| 主机:端口 | `example.com:8080` | 仅该主机加端口 |
| 精确 URL | `https://x.com/a` | scheme + 主机 + 路径；query 和 hash 不算 |

特殊 scheme（`chrome://`、`about:`、`data:`）在导入时直接判无效；`file://` 只能写成精确 URL。

规则有两个来源：

- 手动规则随浏览器账号同步，上限 1000 条。超过上限会被明确拒绝，不会悄悄丢。
- 远程源从一个 URL 拉取规则清单。内容只存本机，各设备各自拉取；添加时才拉第一次，启动时不拉。拉取失败分网络、HTTP、解析三类，连错 3 次自动停用该源，手动刷新成功一次就清零。每个源在运行期单独申请主机权限、随时可撤销——装扩展本身不申请任何网站权限。

## 安装

### Chromium（Chrome / Edge / Brave 等）

1. 从最新 Release 拿 `sitefade-<版本>-chrome.zip` 解压；或自己跑 `pnpm build`，用 `dist/chrome-mv3/`。
2. 打开 `chrome://extensions`，打开右上角开发者模式。
3. 「加载已解压的扩展程序」，选含 `manifest.json` 的目录。

把 zip 直接拖进 `chrome://extensions` 也能装。

### Firefox

1. 从最新 Release 拿 `sitefade-<版本>-firefox.zip`；或跑 `pnpm build:firefox`，用 `dist/firefox-mv3/`。
2. 打开 `about:debugging#/runtime/this-firefox`，把 zip（或 `manifest.json`）作为临时附加组件加载。

临时加载的扩展重启浏览器就失效，这是未签名扩展的正常表现。本项目不上商店，也不做签名。

### 浏览器会问到哪些权限

`history`：删历史必须有，同时会显示「读取浏览历史」的警告，这正是产品的目的。`storage`、`alarms`：存规则、供远程源刷新（刷新默认关）。`activeTab`：让 popup 能读到当前标签页地址。不预先申请任何网站权限。

设置页负责导入、规则清单（可搜索、分页）、远程源、可选的 4 位 PIN 锁、导出与重置。

## 构建与发布

需要 Node 20+ 和 pnpm。技术栈：WXT + Svelte 5 + TypeScript，原生 CSS 加变量，无 UI 组件库；界面只做中文，不做 i18n。

```bash
pnpm install
pnpm dev             # 开发模式（Chromium），热更新
pnpm test            # 单元测试
pnpm check           # svelte-check 类型检查
pnpm zip             # Chromium 构建并打包
pnpm zip:firefox     # Firefox 构建并打包
```

发布由 GitHub Actions 自动完成。发版就两条命令：

```bash
pnpm version patch  # 改 version + commit + 打 v* tag，一步完成
# pnpm version minor | major（或直接写版本号：pnpm version 0.2.0）
git push --follow-tags
```

`pnpm version` 改 `package.json`、提交、再打带注释的 `v*` tag，三者一次产出，从根上杜绝了「tag 和 version 对不上」。工作流随后会跑类型检查、单测，构建并打包两个浏览器，然后把三个 zip 挂到一个草稿 release 上，release notes 从提交历史自动生成。去 Releases 页核对后发布即可。tag 和 package.json 版本不一致仍会被拦下，这是保留的保险，因为 zip 文件名里嵌的就是这个版本。

## 隐私

所有处理都在本机：没有遥测、没有上报，唯一的出站流量是你配置的远程源拉取。规则和源定义随账号在各设备间同步；远程内容和 PIN 哈希只存本地，PIN 永远不同步。