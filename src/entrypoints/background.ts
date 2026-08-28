/**
 * SiteFade 后台（票 01/08/07）：
 *  - history.onVisited（写后信号）→ 匹配 → deleteUrl(真实 URL)，幂等、失败静默；
 *  - storage 变更（sync 三 blob / local 远程缓存）→ 防抖重建匹配器；
 *  - alarms 驱动远程源自动刷新；
 *  - popup 消息：状态查询 / 设为主机规则 / 移除手动规则 / 重置设置。
 *
 * 匹配器状态挂在模块作用域（defineBackground 闭包外），供 handleMessage 使用。
 */

import { browser } from 'wxt/browser';
import { MANUAL_LIMIT, REFRESH_PREFIX } from '@/lib/constants';
import { buildMatcher } from '@/lib/matcher/assemble';
import type { CompiledMatcher } from '@/lib/matcher/compile';
import { parseLine, hostnameOfUrl } from '@/lib/rules/parser';
import { collectRuleEntries } from '@/lib/rules/collect';
import {
  loadManualRules,
  saveManualRules,
  loadSources,
} from '@/lib/storage/store';
import { refreshSource } from '@/lib/sources/refresh';
import { genId } from '@/lib/id';
import { resetSettings } from '@/lib/reset';
import type { PopupMessage, PopupResponse } from '@/lib/messaging';

const REBUILD_DEBOUNCE_MS = 200;

let matcher: CompiledMatcher | null = null;
let rebuildTimer: ReturnType<typeof setTimeout> | undefined;

async function ensureMatcher() {
  if (!matcher) matcher = await buildMatcher();
  return matcher;
}

/** 立即重建并替换缓存（popup 自身写操作后同步，保证 status 读到最新）。 */
async function rebuildNow() {
  matcher = await buildMatcher();
}

function scheduleRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    void rebuildNow();
  }, REBUILD_DEBOUNCE_MS);
}

export default defineBackground(() => {
  // ---- storage 变更 → 防抖重建（sync 与 local 都会触发） ----
  browser.storage.onChanged.addListener(() => {
    scheduleRebuild();
    void syncAlarms();
  });

  // ---- 删除机制：写后信号 → 匹配 → 删（幂等，静默失败） ----
  browser.history.onVisited.addListener((item) => {
    const url = item?.url;
    if (!url) return;
    void ensureMatcher().then((m) => {
      const hit = m.matchUrl(url);
      if (!hit) return;
      void browser.history.deleteUrl({ url }).catch(() => {
        /* 静默：失败不打断、不记日志（票 08） */
      });
    });
  });

  // ---- alarms：远程源自动刷新（启动不主动拉取，票 07） ----
  browser.alarms.onAlarm.addListener((alarm) => {
    if (!alarm.name.startsWith(REFRESH_PREFIX)) return;
    const sourceId = alarm.name.slice(REFRESH_PREFIX.length);
    void refreshSource(sourceId, { isAuto: true }).catch(() => {
      /* 忽略 */
    });
  });

  // ---- popup 消息 ----
  browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
    void handleMessage(msg)
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    return true; // 异步响应
  });

  // ---- 启动：不主动拉取远程源；惰性建匹配器 + 校准 alarms ----
  void syncAlarms();
  void ensureMatcher();
});

async function syncAlarms() {
  try {
    const sources = await loadSources();
    const wanted = new Set<string>();
    for (const s of sources) {
      if (s.enabled && s.refreshHours) wanted.add(`${REFRESH_PREFIX}${s.id}`);
    }
    const existing = await browser.alarms.getAll();
    for (const a of existing) {
      if (a.name.startsWith(REFRESH_PREFIX) && !wanted.has(a.name)) {
        await browser.alarms.clear(a.name);
      }
    }
    for (const name of wanted) {
      if (!existing.some((a) => a.name === name)) {
        const src = sources.find((s) => `${REFRESH_PREFIX}${s.id}` === name);
        if (src) {
          const periodMinutes = Math.max(1, src.refreshHours ?? 1) * 60;
          await browser.alarms.create(name, { periodInMinutes: periodMinutes });
        }
      }
    }
  } catch {
    /* 忽略 */
  }
}

async function handleMessage(msg: unknown): Promise<PopupResponse> {
  const m = msg as PopupMessage | null;
  if (!m || typeof m.type !== 'string') return { ok: false, error: '消息格式错误' };

  switch (m.type) {
    case 'status': {
      const matcher = await ensureMatcher();
      const url = typeof (m as { url?: unknown }).url === 'string' ? (m as { url: string }).url : '';
      const match = url ? matcher.matchUrl(url) : null;

      let historyPermOk = true;
      try {
        historyPermOk = await browser.permissions.contains({ permissions: ['history'] });
      } catch {
        historyPermOk = true;
      }

      const { sources, entries, perSource } = await collectRuleEntries();
      const manualCount = perSource.get('manual') ?? 0;
      const remoteCount = entries.length - manualCount;
      const matchLabel = match
        ? match.source === 'manual'
          ? '手动'
          : (() => {
              const id = match.source.slice('remote:'.length);
              const s = sources.find((x) => x.id === id);
              return s ? `远程「${s.name}」` : match.source;
            })()
        : undefined;
      return {
        ok: true,
        status: {
          matched: !!match,
          match,
          matchLabel,
          totalRules: entries.length,
          manualCount,
          remoteCount,
          historyPermOk,
        },
      };
    }

    case 'addHost': {
      const raw = (m as { host?: unknown }).host;
      const url = typeof raw === 'string' ? raw : '';
      const host = hostnameOfUrl(url);
      if (!host) return { ok: false, error: '无法解析当前站点主机名' };
      const p = parseLine(host);
      // 裸域名/通配符（host）与 IP 字面量（exact-host）都可作为手动规则（票 05）
      if (!p || 'error' in p || (p.kind !== 'host' && p.kind !== 'exact-host')) {
        return { ok: false, error: '无法解析当前站点主机名' };
      }
      const text = p.text;

      const rules = await loadManualRules();
      if (rules.some((r) => r.text === text)) return { ok: true, action: 'exists' };
      if (rules.length >= MANUAL_LIMIT) return { ok: true, action: 'limit', limit: MANUAL_LIMIT };

      const next = [...rules, { id: genId(), text }];
      const saved = await saveManualRules(next);
      if (!saved) return { ok: false, error: '保存失败（同步配额不足？）' };
      await rebuildNow(); // 同步更新，popup 立即刷新即可见（票 08 防抖缓存）
      return { ok: true, action: 'added' };
    }

    case 'removeManual': {
      const text = typeof (m as { text?: unknown }).text === 'string' ? (m as { text: string }).text : '';
      const rules = await loadManualRules();
      const next = rules.filter((r) => r.text !== text);
      if (next.length === rules.length) return { ok: true, action: 'not-found' };
      await saveManualRules(next);
      await rebuildNow();
      return { ok: true, action: 'removed' };
    }

    case 'reset': {
      // 清 PIN + 本机设置/缓存 + 远程源定义；保留手动规则（票 09）
      await resetSettings();
      await rebuildNow();
      return { ok: true };
    }

    default:
      return { ok: false, error: '未知消息' };
  }
}
