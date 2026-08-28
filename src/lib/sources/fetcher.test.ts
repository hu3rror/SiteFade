/**
 * 远程源拉取测试（票 07）：依赖注入 fetch，验证失败分类与响应上限。
 */
import { describe, it, expect } from 'vitest';
import { fetchSourceList } from './fetcher';
import { MAX_RESPONSE_BYTES } from '../constants';

function resp(over: Partial<{ ok: boolean; status: number; text: string; contentLength: string | null }>) {
  const text = over.text ?? '';
  return {
    ok: over.ok ?? true,
    status: over.status ?? 200,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-length' ? (over.contentLength ?? null) : null) },
    text: async () => text,
  } as unknown as Response;
}

function makeFetch(outcome: () => Promise<Response> | Response) {
  return async () => outcome();
}

describe('fetchSourceList', () => {
  it('成功：返回规范化去重后的规则与摘要', async () => {
    const res = await fetchSourceList('https://example.com/l', makeFetch(() =>
      resp({ text: '# 注释\nbaidu.com\n*.bilibili.com\nbaidu.com\nchrome://x\n' }),
    ));
    expect(res.ok).toBe(true);
    expect(res.rules).toEqual(['baidu.com', '*.bilibili.com']);
    expect(res.summary).toMatchObject({ added: 2, duplicate: 1, invalid: 1 });
  });

  it('HTTP 非 2xx → kind http', async () => {
    const res = await fetchSourceList('https://example.com/l', makeFetch(() => resp({ ok: false, status: 404 })));
    expect(res.ok).toBe(false);
    expect(res.kind).toBe('http');
    expect(res.detail).toContain('404');
  });

  it('网络异常 → kind network', async () => {
    const res = await fetchSourceList('https://example.com/l', () => {
      throw new TypeError('Failed to fetch');
    });
    expect(res.ok).toBe(false);
    expect(res.kind).toBe('network');
  });

  it('响应超 2MB → kind parse', async () => {
    const big = 'a'.repeat(MAX_RESPONSE_BYTES + 1);
    const res = await fetchSourceList('https://example.com/l', makeFetch(() => resp({ text: big })));
    expect(res.ok).toBe(false);
    expect(res.kind).toBe('parse');
  });

  it('content-length 头超限 → kind parse', async () => {
    const res = await fetchSourceList('https://example.com/l', makeFetch(() =>
      resp({ text: 'baidu.com', contentLength: String(MAX_RESPONSE_BYTES + 10) }),
    ));
    expect(res.ok).toBe(false);
    expect(res.kind).toBe('parse');
  });

  it('响应体校验字节级（中文不被低估）', async () => {
    // 50 万个中文字 ≈ 150 万字节，超过 2MB 上限应判 parse
    const chinese = '中'.repeat(700_000);
    const res = await fetchSourceList('https://example.com/l', makeFetch(() => resp({ text: chinese })));
    expect(res.ok).toBe(false);
    expect(res.kind).toBe('parse');
  });
});
