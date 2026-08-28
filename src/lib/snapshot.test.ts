/**
 * 规则快照测试（票 03）：一次收集、一次编译；匹配与统计同源。
 * storage 用 wxt 假 storage 播种，验证快照的全局去重/手动优先与分源统计。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { browser } from 'wxt/browser';
import { buildSnapshot } from './snapshot';
import { saveManualRules, saveSources, saveRemoteCache } from './storage/store';
import type { RemoteSource } from './types';

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

beforeEach(async () => {
  await browser.storage.sync.clear();
  await browser.storage.local.clear();
});

describe('buildSnapshot', () => {
  it('全局去重：手动优先，重复文本只留手动条目', async () => {
    await saveManualRules([{ id: 'a', text: 'baidu.com' }]);
    await saveSources([makeSource()]);
    await saveRemoteCache('s1', { fetchedAt: 1, rules: ['baidu.com', 'bilibili.com'] });

    const snap = await buildSnapshot();
    expect(snap.totalRules).toBe(2);
    expect(snap.manualCount).toBe(1);
    expect(snap.remoteCount).toBe(1);
    expect(snap.entries.map((e) => [e.text, e.source])).toEqual([
      ['baidu.com', 'manual'],
      ['bilibili.com', 'remote:s1'],
    ]);
    expect(snap.perSource.get('manual')).toBe(1);
    expect(snap.perSource.get('s1')).toBe(1);
  });

  it('匹配与统计同源：手动命中/远程命中标签可寻源', async () => {
    await saveManualRules([{ id: 'a', text: 'baidu.com' }]);
    await saveSources([makeSource({ id: 's9', name: '番剧列表' })]);
    await saveRemoteCache('s9', { fetchedAt: 1, rules: ['bilibili.com'] });

    const snap = await buildSnapshot();
    const m1 = snap.matcher.matchUrl('https://tieba.baidu.com/x');
    expect(m1).toMatchObject({ ruleText: 'baidu.com', source: 'manual' });
    const m2 = snap.matcher.matchUrl('https://www.bilibili.com/');
    expect(m2).toMatchObject({ ruleText: 'bilibili.com', source: 'remote:s9' });
    // 命中标签寻源
    expect(snap.sourceNames.s9).toBe('番剧列表');
    expect(m2 && m2.source !== 'manual').toBe(true);
  });

  it('停用的源不贡献规则与统计', async () => {
    await saveSources([makeSource({ enabled: false })]);
    await saveRemoteCache('s1', { fetchedAt: 1, rules: ['bilibili.com'] });
    const snap = await buildSnapshot();
    expect(snap.totalRules).toBe(0);
    expect(snap.remoteCount).toBe(0);
    expect(snap.perSource.get('s1')).toBe(0);
  });

  it('空清单：快照可用，匹配皆空', async () => {
    const snap = await buildSnapshot();
    expect(snap.totalRules).toBe(0);
    expect(snap.matcher.matchUrl('https://example.com/')).toBeNull();
  });
});
