/**
 * 远程源写入管线（票 02 深化）：把某源对远程刷一遍的唯一管线——拉取 → 状态迁移 →
 * 成功才更新本机缓存。添加远程源与刷新共用，缓存写入策略只活这一处。
 * storage 用 wxt 假 storage，fetch 注入，可单测。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { browser } from 'wxt/browser';
import type { RemoteSource } from '../types';
import { applySourceFetch, refreshSource } from './refresh';
import { loadRemoteCache, saveRemoteCache, loadSources } from '../storage/store';
import type { FetchFn } from './fetcher';

function makeSource(over: Partial<RemoteSource> = {}): RemoteSource {
  return {
    id: 's1',
    name: '测试源',
    url: 'https://example.com/list.txt',
    enabled: true,
    refreshHours: null,
    failCount: 0,
    disabledByFailures: false,
    lastSuccessAt: null,
    lastError: null,
    ...over,
  };
}

function okResp(text: string): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => text,
  } as unknown as Response;
}

function httpFail(status: number): Response {
  return { ok: false, status, headers: { get: () => null }, text: async () => '' } as unknown as Response;
}

function failFetch(msg = 'Failed to fetch'): FetchFn {
  return async () => {
    throw new TypeError(msg);
  };
}

beforeEach(async () => {
  await browser.storage.sync.clear();
  await browser.storage.local.clear();
});

describe('applySourceFetch：单管线', () => {
  it('成功：状态清零、清错误、写缓存', async () => {
    const res = await applySourceFetch(
      makeSource({ failCount: 2, lastError: { kind: 'network', detail: 'x', at: 1 } }),
      { isAuto: true },
      async () => okResp('# 注释\nbaidu.com\nbaidu.com\n'),
    );
    expect(res.outcome.ok).toBe(true);
    expect(res.source.failCount).toBe(0);
    expect(res.source.lastError).toBeNull();
    expect(res.source.disabledByFailures).toBe(false);
    expect(res.source.lastSuccessAt).toBeGreaterThan(0);
    expect(res.cacheUpdated).toBe(true);
    expect(await loadRemoteCache('s1')).toEqual({
      fetchedAt: expect.any(Number),
      rules: ['baidu.com'],
    });
  });

  it('失败（自动）：累加失败计数、不写缓存、保留上次成功缓存', async () => {
    await saveRemoteCache('s1', { fetchedAt: 100, rules: ['old.com'] });
    const res = await applySourceFetch(makeSource(), { isAuto: true }, failFetch());
    expect(res.outcome.ok).toBe(false);
    expect(res.outcome.kind).toBe('network');
    expect(res.source.failCount).toBe(1);
    expect(res.source.lastError?.kind).toBe('network');
    expect(res.cacheUpdated).toBe(false);
    expect(await loadRemoteCache('s1')).toEqual({ fetchedAt: 100, rules: ['old.com'] });
  });

  it('失败（手动）：不累加失败计数', async () => {
    const res = await applySourceFetch(makeSource(), { isAuto: false }, async () => httpFail(500));
    expect(res.outcome.kind).toBe('http');
    expect(res.source.failCount).toBe(0);
    expect(res.source.lastError?.kind).toBe('http');
  });

  it('连续 3 次自动失败 → 自动停用传播给 next（落库由调用方负责）', async () => {
    let src = makeSource();
    for (let i = 0; i < 3; i++) {
      const res = await applySourceFetch(src, { isAuto: true }, failFetch());
      src = res.source;
    }
    expect(src.disabledByFailures).toBe(true);
    expect(src.enabled).toBe(false);
  });
});

describe('refreshSource：按 id 刷新并落库', () => {
  it('未知 id → 不动', async () => {
    const res = await refreshSource('nope', { isAuto: true });
    expect(res.source).toBeNull();
    expect(res.outcome).toBeNull();
  });

  it('自动刷新时已停用的源不拉取', async () => {
    await saveSourcesStub([makeSource({ enabled: false })]);
    const res = await refreshSource('s1', { isAuto: true });
    expect(res.outcome).toBeNull();
    expect(res.source?.enabled).toBe(false);
  });

  it('成功：源定义落库（lastSuccessAt 更新）', async () => {
    await saveSourcesStub([makeSource()]);
    const res = await refreshSource('s1', { isAuto: false }, async () => okResp('a.com'));
    expect(res.outcome?.ok).toBe(true);
    const stored = await loadSources();
    expect(stored[0]?.lastSuccessAt).toBeGreaterThan(0);
    expect(res.cacheUpdated).toBe(true);
  });

  it('失败：lastError 落库，失败计数按 isAuto 累计', async () => {
    await saveSourcesStub([makeSource()]);
    await refreshSource('s1', { isAuto: true }, failFetch());
    const stored = await loadSources();
    expect(stored[0]?.lastError?.kind).toBe('network');
    expect(stored[0]?.failCount).toBe(1);
    // 手动失败不累计
    await refreshSource('s1', { isAuto: false }, failFetch());
    const after = await loadSources();
    expect(after[0]?.failCount).toBe(1);
  });
});

async function saveSourcesStub(sources: RemoteSource[]) {
  await browser.storage.sync.set({ remoteSources: { version: 1, sources } });
}
