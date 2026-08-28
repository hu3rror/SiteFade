/**
 * 远程源刷新编排（票 07）与写入管线（票 02 深化）。
 * 依赖 storage 层；applySourceFetch 为「源内容更新」的唯一管线，添加与刷新共用：
 * 拉取 → 状态迁移 → 成功才更新本机缓存（fetchedAt=拉取成功时刻）。
 */

import { loadSources, saveSources, saveRemoteCache } from '../storage/store';
import type { RemoteSource } from '../types';
import { fetchSourceList, type FetchOutcome, type FetchFn } from './fetcher';
import { applyFetchOutcome } from './sources';

export interface AppliedFetch {
  source: RemoteSource;
  outcome: FetchOutcome;
  /** 本机缓存是否被更新（成功才更新，失败保留上次成功）。 */
  cacheUpdated: boolean;
}

/** 单管线：把某源对远程刷一遍并落缓存；源定义落库由调用方合并（追加或替换）。 */
export async function applySourceFetch(
  source: RemoteSource,
  opts: { isAuto: boolean },
  fetchFn: FetchFn = fetch,
): Promise<AppliedFetch> {
  const outcome = await fetchSourceList(source.url, fetchFn);
  const next = applyFetchOutcome(source, outcome, opts.isAuto);
  let cacheUpdated = false;
  if (outcome.ok && outcome.rules) {
    await saveRemoteCache(next.id, { fetchedAt: Date.now(), rules: outcome.rules });
    cacheUpdated = true;
  }
  return { source: next, outcome, cacheUpdated };
}

export interface RefreshResult {
  source: RemoteSource | null;
  outcome: FetchOutcome | null;
  /** 缓存是否被更新（成功才更新，失败保留上次成功）。 */
  cacheUpdated: boolean;
}

/** 按 id 刷新一个源并落库（源状态 + 定义）。isAuto 决定失败计数。 */
export async function refreshSource(
  sourceId: string,
  opts: { isAuto: boolean },
  fetchFn: FetchFn = fetch,
): Promise<RefreshResult> {
  const sources = await loadSources();
  const idx = sources.findIndex((s) => s.id === sourceId);
  if (idx < 0) return { source: null, outcome: null, cacheUpdated: false };
  const src = sources[idx]!;
  if (opts.isAuto && !src.enabled) return { source: src, outcome: null, cacheUpdated: false };

  const { source: next, outcome, cacheUpdated } = await applySourceFetch(src, opts, fetchFn);
  sources[idx] = next;
  await saveSources(sources);
  return { source: next, outcome, cacheUpdated };
}
