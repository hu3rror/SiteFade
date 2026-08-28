/**
 * 远程源刷新编排（票 07）——background 自动刷新与设置页手动刷新共用。
 * 依赖 storage 层；注意本模块在 entrypoint 上下文运行。
 */

import { loadSources, saveSources, saveRemoteCache } from '../storage/store';
import type { RemoteSource } from '../types';
import { fetchSourceList, type FetchOutcome } from './fetcher';
import { applyFetchOutcome } from './sources';

export interface RefreshResult {
  source: RemoteSource | null;
  outcome: FetchOutcome | null;
  /** 缓存是否被更新（成功才更新，失败保留上次成功）。 */
  cacheUpdated: boolean;
}

/** 按 id 刷新一个源并落库（源状态 + 缓存）。isAuto 决定失败计数。 */
export async function refreshSource(
  sourceId: string,
  opts: { isAuto: boolean },
): Promise<RefreshResult> {
  const sources = await loadSources();
  const idx = sources.findIndex((s) => s.id === sourceId);
  if (idx < 0) return { source: null, outcome: null, cacheUpdated: false };
  const src = sources[idx]!;
  if (!src) return { source: null, outcome: null, cacheUpdated: false };
  if (opts.isAuto && !src.enabled) return { source: src, outcome: null, cacheUpdated: false };

  const outcome = await fetchSourceList(src.url);
  const next = applyFetchOutcome(src, outcome, opts.isAuto);
  let cacheUpdated = false;
  if (outcome.ok && outcome.rules) {
    await saveRemoteCache(sourceId, { fetchedAt: Date.now(), rules: outcome.rules });
    cacheUpdated = true;
  }
  sources[idx] = next;
  await saveSources(sources);
  return { source: next, outcome, cacheUpdated };
}
