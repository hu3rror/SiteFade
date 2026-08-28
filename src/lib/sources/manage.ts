/**
 * 远程源管理（票 04/07）：添加即拉、首拉失败也允许建源、按源运行时授权。
 * 运行于扩展上下文（设置页），依赖 storage 层与 fetcher。
 *
 * 授权注意（查证：permissions.request 必须在用户手势内同步调用）：
 *  - 本模块不自动申请授权（fetch 之后手势已失效）；
 *  - 由 UI 的「授权并重试」按钮在点击手势中先同步调用 grantOrigin，再刷新。
 */

import { browser } from 'wxt/browser';
import { loadSources, saveSources, saveRemoteCache, deleteRemoteCache } from '../storage/store';
import { genId } from '../id';
import type { RemoteSource } from '../types';
import { fetchSourceList, originPermissionPattern, type FetchOutcome } from './fetcher';
import { applyFetchOutcome } from './sources';

export interface AddSourceResult {
  ok: boolean;
  source: RemoteSource | null;
  outcome: FetchOutcome | null;
  error?: string;
}

/** 默认名称 = 源 URL 主机名。 */
export function defaultSourceName(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '远程源';
  }
}

/**
 * 按源申请 host 权限（manifest 已声明 optional_host_permissions 覆盖）。
 * 必须由调用方在用户手势内同步调用本函数（内部对 permissions.request 先于任何 await）。
 */
export async function grantOrigin(url: string): Promise<boolean> {
  const pattern = originPermissionPattern(url);
  if (!pattern) return false;
  try {
    // request 在已授权时静默返回 true，未授权时弹出提示——两种情形都不需要先查 contains。
    // 必须由调用方在用户手势内同步调用本函数：内部先于任何 await 发起 request。
    return await browser.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}

/** 添加远程源：校验 URL、查重、立即拉取；失败也建源（票 07：首拉失败允许建源）。 */
export async function addSource(url: string, name?: string): Promise<AddSourceResult> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, source: null, outcome: null, error: 'URL 无法解析' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, source: null, outcome: null, error: '仅支持 http/https 远程源' };
  }
  const existing = await loadSources();
  if (existing.some((s) => s.url === url)) {
    return { ok: false, source: null, outcome: null, error: '该 URL 已在源列表中' };
  }

  const outcome = await fetchSourceList(url);
  const src: RemoteSource = {
    id: genId(),
    name: (name ?? '').trim() || defaultSourceName(url),
    url,
    enabled: true,
    refreshHours: null,
    failCount: 0,
    disabledByFailures: false,
    lastSuccessAt: null,
    lastError: null,
  };
  const next = applyFetchOutcome(src, outcome, false);
  if (outcome.ok && outcome.rules) {
    await saveRemoteCache(next.id, { fetchedAt: Date.now(), rules: outcome.rules });
  }
  await saveSources([...existing, next]);
  return { ok: true, source: next, outcome };
}

/** 更新源定义（启用开关 / 自动刷新间隔 / 名称）。 */
export async function updateSource(
  sourceId: string,
  patch: Partial<Pick<RemoteSource, 'enabled' | 'refreshHours' | 'name'>>,
): Promise<RemoteSource | null> {
  const sources = await loadSources();
  const idx = sources.findIndex((s) => s.id === sourceId);
  if (idx < 0) return null;
  const next: RemoteSource = { ...sources[idx]! };
  if (patch.enabled !== undefined) next.enabled = patch.enabled;
  if (patch.refreshHours !== undefined) next.refreshHours = patch.refreshHours;
  if (patch.name !== undefined) next.name = patch.name;
  sources[idx] = next;
  await saveSources(sources);
  return next;
}

/** 删除远程源及其本机缓存。 */
export async function removeSource(sourceId: string): Promise<void> {
  const sources = await loadSources();
  await saveSources(sources.filter((s) => s.id !== sourceId));
  await deleteRemoteCache(sourceId);
}
