/**
 * 存储层测试（票 01 深化）：统一信封的版本闸门、schema 解码容错、key 空间归属。
 * 用 wxt/browser 在 vitest 下的假 storage，不 mock。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { browser } from 'wxt/browser';
import {
  loadManualRules,
  saveManualRules,
  loadSources,
  saveSources,
  loadSettings,
  saveSettings,
  loadPinData,
  savePinData,
  loadRemoteCache,
  saveRemoteCache,
  deleteRemoteCache,
  clearRemoteCaches,
  remoteCacheKey,
} from './store';

beforeEach(async () => {
  await browser.storage.sync.clear();
  await browser.storage.local.clear();
});

describe('manual（sync）', () => {
  it('save → load 往返一致', async () => {
    const rules = [{ id: 'a', text: 'baidu.com' }];
    await saveManualRules(rules);
    expect(await loadManualRules()).toEqual(rules);
  });

  it('无 blob / rules 非数组 → 空清单', async () => {
    expect(await loadManualRules()).toEqual([]);
    await browser.storage.sync.set({ manual: { version: 1, rules: 'oops' } });
    expect(await loadManualRules()).toEqual([]);
  });

  it('损坏条目（text 非字符串）被过滤', async () => {
    await browser.storage.sync.set({
      manual: { version: 1, rules: [{ id: 'ok', text: 'x.com' }, { id: 'bad', text: 42 }, null] },
    });
    expect(await loadManualRules()).toEqual([{ id: 'ok', text: 'x.com' }]);
  });

  it('版本不匹配（未来版本）→ 按空清单容错', async () => {
    await browser.storage.sync.set({ manual: { version: 99, rules: [{ id: 'a', text: 'x.com' }] } });
    expect(await loadManualRules()).toEqual([]);
  });
});

describe('sources（sync）', () => {
  const src = {
    id: 's1',
    name: '源',
    url: 'https://example.com/list.txt',
    enabled: true,
    refreshHours: null,
    failCount: 0,
    disabledByFailures: false,
    lastSuccessAt: null,
    lastError: null,
  };

  it('save → load 往返一致', async () => {
    await saveSources([src]);
    expect(await loadSources()).toEqual([src]);
  });

  it('损坏条目（缺 id/url）被过滤', async () => {
    await browser.storage.sync.set({
      remoteSources: { version: 1, sources: [src, { id: 'x' }, null] },
    });
    expect(await loadSources()).toEqual([src]);
  });
});

describe('settings（sync）', () => {
  it('合法 pageSize 往返一致', async () => {
    await saveSettings({ pageSize: 50 });
    expect(await loadSettings()).toEqual({ pageSize: 50 });
  });

  it('非法 / 缺省 pageSize → 默认值', async () => {
    await browser.storage.sync.set({ settings: { version: 1, pageSize: 5000 } });
    expect(await loadSettings()).toEqual({ pageSize: 10 });
    await browser.storage.sync.clear();
    expect(await loadSettings()).toEqual({ pageSize: 10 });
  });
});

describe('pin（local）', () => {
  it('save → load 往返；空哈希兜底', async () => {
    await savePinData({ hash: 'abc' });
    expect(await loadPinData()).toEqual({ hash: 'abc' });
    await browser.storage.local.clear();
    expect(await loadPinData()).toEqual({ hash: null });
  });
});

describe('远程缓存（local）', () => {
  it('save → load 往返一致', async () => {
    const cache = { fetchedAt: 123, rules: ['a.com', 'b.com'] };
    await saveRemoteCache('s1', cache);
    expect(await loadRemoteCache('s1')).toEqual(cache);
  });

  it('blob 损坏 → null；非字符串条目被过滤', async () => {
    expect(await loadRemoteCache('s1')).toBeNull();
    await browser.storage.local.set({ [remoteCacheKey('s1')]: { version: 1, rules: ['a.com', 42] } });
    expect(await loadRemoteCache('s1')).toEqual({ fetchedAt: 0, rules: ['a.com'] });
  });

  it('deleteRemoteCache 只删对应 key', async () => {
    await saveRemoteCache('s1', { fetchedAt: 1, rules: ['a.com'] });
    await saveRemoteCache('s2', { fetchedAt: 1, rules: ['b.com'] });
    await deleteRemoteCache('s1');
    expect(await loadRemoteCache('s1')).toBeNull();
    expect(await loadRemoteCache('s2')).toEqual({ fetchedAt: 1, rules: ['b.com'] });
  });

  it('clearRemoteCaches 只清 remote.* 键，保留其他本地键', async () => {
    await saveRemoteCache('s1', { fetchedAt: 1, rules: ['a.com'] });
    await saveRemoteCache('s2', { fetchedAt: 1, rules: ['b.com'] });
    await savePinData({ hash: 'abc' });
    await browser.storage.local.set({ other: 1 });
    await clearRemoteCaches();
    const all = await browser.storage.local.get(null);
    expect(all[remoteCacheKey('s1')]).toBeUndefined();
    expect(all[remoteCacheKey('s2')]).toBeUndefined();
    expect(all.pin).toEqual({ version: 1, hash: 'abc' });
    expect(all.other).toBe(1);
  });
});
