/**
 * 远程源状态机测试（票 07）：失败计数只计自动刷新、连续 3 次自动停用。
 */
import { describe, it, expect } from 'vitest';
import { applyFetchOutcome } from './sources';
import type { RemoteSource } from '../types';

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

describe('applyFetchOutcome', () => {
  it('成功：清零失败、记录成功时间、清错误', () => {
    const src = makeSource({ failCount: 2, lastError: { kind: 'network', detail: 'x', at: 1 } });
    const next = applyFetchOutcome(src, { ok: true, kind: 'ok' }, true);
    expect(next.failCount).toBe(0);
    expect(next.disabledByFailures).toBe(false);
    expect(next.enabled).toBe(true);
    expect(next.lastError).toBeNull();
    expect(next.lastSuccessAt).toBeGreaterThan(0);
  });

  it('手动刷新失败：不累加失败计数', () => {
    const src = makeSource();
    const next = applyFetchOutcome(src, { ok: false, kind: 'http', detail: 'HTTP 500' }, false);
    expect(next.failCount).toBe(0);
    expect(next.enabled).toBe(true);
    expect(next.lastError).toMatchObject({ kind: 'http', detail: 'HTTP 500' });
  });

  it('自动刷新失败：累加计数', () => {
    const src = makeSource();
    const next = applyFetchOutcome(src, { ok: false, kind: 'network', detail: 'x' }, true);
    expect(next.failCount).toBe(1);
  });

  it('连续 3 次自动失败 → 自动停用', () => {
    let src = makeSource();
    for (let i = 0; i < 3; i++) {
      src = applyFetchOutcome(src, { ok: false, kind: 'network', detail: 'x' }, true);
    }
    expect(src.failCount).toBe(3);
    expect(src.disabledByFailures).toBe(true);
    expect(src.enabled).toBe(false);
  });

  it('停用后手动刷新成功 → 重新启用', () => {
    const src = makeSource({ failCount: 3, disabledByFailures: true, enabled: false });
    const next = applyFetchOutcome(src, { ok: true, kind: 'ok' }, false);
    expect(next.enabled).toBe(true);
    expect(next.disabledByFailures).toBe(false);
    expect(next.failCount).toBe(0);
  });

  it('用户手动关闭的源：成功不强制重开', () => {
    const src = makeSource({ enabled: false, disabledByFailures: false });
    const next = applyFetchOutcome(src, { ok: true, kind: 'ok' }, false);
    expect(next.enabled).toBe(false);
    expect(next.failCount).toBe(0);
  });

  it('保留上次成功缓存语义：失败不改 lastSuccessAt', () => {
    const src = makeSource({ lastSuccessAt: 1000 });
    const next = applyFetchOutcome(src, { ok: false, kind: 'parse', detail: '超大' }, true);
    expect(next.lastSuccessAt).toBe(1000);
  });
});
