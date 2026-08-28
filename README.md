# SiteFade

[English](README.md) · [简体中文](README_zh-CN.md)

A small extension for Chromium and Firefox (Manifest V3). If a site is on your list, SiteFade removes every visit to it from browsing history the moment one is recorded. However often you open the site, it never shows up in history.

## How a visit disappears

Browsers write history as an event, not a permission: the visit lands the moment the page loads, and no extension can stop that write. SiteFade works one step later.

1. The browser records the visit.
2. `history.onVisited` fires.
3. The real URL is checked against the rule list.
4. On a match, `history.deleteUrl` removes the visit. No match, nothing happens.

Some properties fall out of this design:

- Deletion is idempotent and silent. If the URL is already gone, the remove quietly fails.
- No sweeping on install. Enabling the extension protects future visits only; existing history stays untouched.
- No scheduled cleanup. Deletion happens inline at write time, so there is nothing to backfill or schedule.
- Matching stays entirely local. The list is compiled into a host-suffix trie plus exact host and URL tables. Nothing leaves the machine.

## The list

One rule per line. `#` starts a comment; blank lines are skipped. On import, every rule is normalized (lowercase, IDN to punycode, trailing slash dropped), duplicates collapse, and invalid lines are reported instead of aborting the import. The summary tells you how many rules were new, duplicated, or invalid, and you can expand the details.

| Rule | Example | What it matches |
|---|---|---|
| bare domain | `baidu.com` | domain and all subdomains |
| single-level wildcard | `*.baidu.com` | exactly one sublevel, not the root |
| multi-level incl. root | `+.baidu.com` | root domain and all subdomains |
| multi-level, no root | `.baidu.com` | subdomains only, not the root |
| bare `*` | `*` | dot-less hostnames like `localhost` |
| IP literal | `127.0.0.1`, `[::1]` | every URL on that host |
| host:port | `example.com:8080` | only that host and port |
| exact URL | `https://x.com/a` | scheme + host + path; query and hash ignored |

Special schemes (`chrome://`, `about:`, `data:`) are rejected on import. `file://` is accepted only as an exact URL.

Rules come from two places:

- Manual rules sync with your browser account, up to 1000. Going over the limit is rejected out loud, not silently.
- Remote sources fetch a rule list from a URL. The content stays local; each device fetches for itself. The first fetch happens when you add the source, not at startup. Failures are told apart as network, HTTP, or parse errors. Three failures in a row auto-disable the source; one successful manual refresh resets the count. Each source asks for host permission at runtime, individually and revocably, because installing the extension requests no site permissions at all.

## Install

### Chromium (Chrome, Edge, Brave, ...)

1. Take `sitefade-<version>-chrome.zip` from the latest Release and unzip it. Or install from source: run `pnpm build` and use `dist/chrome-mv3/`.
2. Open `chrome://extensions` and switch on Developer mode.
3. Load unpacked, then pick the folder that holds `manifest.json`.

Dragging the zip straight onto `chrome://extensions` also works.

### Firefox

1. Take `sitefade-<version>-firefox.zip` from the latest Release. Or run `pnpm build:firefox` and use `dist/firefox-mv3/`.
2. Open `about:debugging#/runtime/this-firefox` and load the zip (or `manifest.json`) as a temporary add-on.

A temporary add-on dies on browser restart. That is how unsigned extensions behave; neither store submission nor signing is planned.

### Permissions the browser will ask about

`history`, because deleting visits requires it and it shows the "read browsing history" warning, which is the product. `storage` and `alarms` for rule storage (remote refresh is off by default). `activeTab` so the popup can read the current tab's address. No website permissions up front.

The settings page handles importing, the rule list (searchable, paginated), remote sources, an optional 4-digit PIN lock, export, and reset.

## Building and releasing

Node 20+ and pnpm. Stack: WXT, Svelte 5, TypeScript, plain CSS with variables. No UI component library, no i18n, the UI is Chinese only.

```bash
pnpm install
pnpm dev             # live-reload development (Chromium)
pnpm test            # unit tests
pnpm check           # svelte-check type checking
pnpm zip             # Chromium build and zip
pnpm zip:firefox     # Firefox build and zip
```

Releases are automated through GitHub Actions. Cut a version:

```bash
pnpm version patch  # bump version + commit + create v* tag in one step
# pnpm version minor | major  (or a literal version: pnpm version 0.2.0)
git push --follow-tags
```

`pnpm version` writes `package.json`, commits it, and creates an annotated `v*` tag, so the two can never get out of sync. The workflow then type-checks, runs the tests, builds and zips both browsers, and creates a draft release with the three zips attached and notes generated from the commit history. Open the draft, take a look, publish. Tags that do not match the version in `package.json` are rejected on purpose, because the zip filenames embed that version.

## Privacy

Everything runs on your machine: no telemetry, no reporting, and the only outbound traffic is the remote-source fetching you configured. Rule lists and source definitions sync between your devices; remote content and the PIN hash stay in local storage, and the PIN never syncs.