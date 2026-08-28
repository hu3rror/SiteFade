/**
 * 远程源管理测试（票 02 深化）：添加走统一管线、首拉失败也建源、权限 pattern 归位。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { browser } from 'wxt/browser';
import { addSource, defaultSourceName, originPermissionPattern } from './manage';
import { loadSources, loadRemoteCache } from '../storage/store';

function okResp(text: string): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => text,
  } as unknown as Response;
}

beforeEach(async () => {
  await browser.storage.sync.clear();
  await browser.storage.local.clear();
});

describe('addSource', () => {
  it('URL 无法解析 → 失败，不建源', async () => {
    const res = await addSource('not a url');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('URL');
    expect(await loadSources()).toEqual([]);
  });

  it('非 http/https → 失败', async () => {
    const res = await addSource('file:///tmp/list.txt');
    expect(res.ok).toBe(false);
    expect(await loadSources()).toEqual([]);
  });

  it('重复 URL → 失败', async () => {
    await addSource('https://example.com/list.txt', 'x');
    const res = await addSource('https://example.com/list.txt', 'y');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('已在源列表');
    expect(await loadSources()).toHaveLength(1);
  });

  it('成功：建源 + 立即拉取写缓存 + 默认名取主机名', async () => {
    const res = await addSource(
      'https://example.com/list.txt',
      undefined,
      async () => okResp('baidu.com\nbaidu.com\n# c\n'),
    );
    expect(res.ok).toBe(true);
    expect(res.outcome?.ok).toBe(true);
    const stored = await loadSources();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.name).toBe('example.com');
    expect(stored[0]?.enabled).toBe(true);
    expect(await loadRemoteCache(stored[0]!.id)).toEqual({
      fetchedAt: expect.any(Number),
      rules: ['baidu.com'],
    });
  });

  it('首拉失败也建源（票 07），不写缓存', async () => {
    const res = await addSource('https://example.com/list.txt', '我的源', async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(res.ok).toBe(true);
    expect(res.outcome?.ok).toBe(false);
    expect(res.outcome?.kind).toBe('network');
    const stored = await loadSources();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.name).toBe('我的源');
    expect(stored[0]?.lastError?.kind).toBe('network');
    expect(await loadRemoteCache(stored[0]!.id)).toBeNull();
  });
});

describe('originPermissionPattern（授权 seam，属管理模块）', () => {
  it('生成按源 host 权限 pattern', () => {
    expect(originPermissionPattern('https://raw.githubusercontent.com/x/list.txt')).toBe('https://raw.githubusercontent.com/*');
    expect(originPermissionPattern('http://127.0.0.1:8080/l')).toBe('http://127.0.0.1:8080/*');
  });
  it('非 http(s) 返回 null', () => {
    expect(originPermissionPattern('file:///tmp/l')).toBeNull();
    expect(originPermissionPattern('not a url')).toBeNull();
  });
});

describe('defaultSourceName', () => {
  it('URL 主机名 / 兜底', () => {
    expect(defaultSourceName('https://a.b.com/x')).toBe('a.b.com');
    expect(defaultSourceName('nope')).toBe('远程源');
  });
});
