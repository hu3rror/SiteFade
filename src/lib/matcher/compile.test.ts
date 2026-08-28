/**
 * 匹配器测试（票 08 / CONTEXT.md 通配符与匹配语义）。
 * compile 直接消费规范文本（票 04：解析在编译处一次）。
 */
import { describe, it, expect } from 'vitest';
import { compile, type SourceRule } from './compile';
import type { SourceRef } from '../types';

function src(text: string, source: SourceRef = 'manual'): SourceRule {
  return { text, source };
}

function match(ruleTexts: string[], url: string, source: SourceRef = 'manual') {
  const m = compile(ruleTexts.map((t) => src(t, source)));
  return m.matchUrl(url);
}

describe('通配符语义', () => {
  const rules = ['*.bilibili.com', '+.baidu.com', '.tieba.com', '*'];

  it('`*.bilibili.com` 只匹配一级子域', () => {
    expect(match(rules, 'https://tieba.bilibili.com/x')).not.toBeNull();
    expect(match(rules, 'https://bilibili.com/')).toBeNull();
    expect(match(rules, 'https://a.b.bilibili.com/')).toBeNull();
  });

  it('`+.baidu.com` 含根多级', () => {
    expect(match(rules, 'https://baidu.com/')).not.toBeNull();
    expect(match(rules, 'https://tieba.baidu.com/')).not.toBeNull();
    expect(match(rules, 'https://a.b.baidu.com/')).not.toBeNull();
  });

  it('`.tieba.com` 不含根多级', () => {
    expect(match(rules, 'https://x.tieba.com/')).not.toBeNull();
    expect(match(rules, 'https://tieba.com/')).toBeNull();
  });

  it('裸 `*` 只匹配不含点的主机名', () => {
    expect(match(rules, 'http://localhost:3000/')).not.toBeNull();
    expect(match(rules, 'http://foo.com/')).toBeNull();
  });
});

describe('裸域名 = 含根多级', () => {
  it('匹配自身与全部子域', () => {
    const m = compile([src('baidu.com')]);
    expect(m.matchUrl('https://baidu.com/')).not.toBeNull();
    expect(m.matchUrl('https://www.baidu.com/')).not.toBeNull();
    expect(m.matchUrl('https://a.b.baidu.com/')).not.toBeNull();
    expect(m.matchUrl('https://other.com/')).toBeNull();
  });
});

describe('精确 URL 规则', () => {
  it('scheme+host+path 匹配，query/hash 忽略', () => {
    const m = compile([src('https://x.com/a')]);
    expect(m.matchUrl('https://x.com/a?t=1#frag')).toMatchObject({ ruleText: 'https://x.com/a' });
    expect(m.matchUrl('https://x.com/a/b')).toBeNull();
    expect(m.matchUrl('http://x.com/a')).toBeNull(); // 协议不同
  });

  it('匹配返回访问真实 URL 与来源', () => {
    const m = compile([src('https://x.com/a', 'remote:s1')]);
    const hit = m.matchUrl('https://x.com/a?q=2');
    expect(hit).toEqual({ ruleText: 'https://x.com/a', source: 'remote:s1' });
  });
});

describe('IP 字面量与端口', () => {
  it('IPv4 主机精确命中（忽略端口）', () => {
    const m = compile([src('127.0.0.1')]);
    expect(m.matchUrl('http://127.0.0.1/')).not.toBeNull();
    expect(m.matchUrl('http://127.0.0.1:8080/')).not.toBeNull();
    expect(m.matchUrl('http://127.0.0.2/')).toBeNull();
  });

  it('IPv6 方括号', () => {
    const m = compile([src('[::1]')]);
    expect(m.matchUrl('http://[::1]:8080/')).not.toBeNull();
    expect(m.matchUrl('http://[::2]/')).toBeNull();
  });

  it('带端口条目：仅精确命中该主机+端口', () => {
    const m = compile([src('example.com:8080')]);
    expect(m.matchUrl('http://example.com:8080/')).not.toBeNull();
    expect(m.matchUrl('http://example.com/')).toBeNull();
    expect(m.matchUrl('http://example.com:8081/')).toBeNull();
  });

  it('纯主机规则命中时忽略端口（全端口生效）', () => {
    const m = compile([src('baidu.com')]);
    expect(m.matchUrl('https://baidu.com:8443/x')).not.toBeNull();
  });

  it('精确 URL 中带端口按整串处理', () => {
    const m = compile([src('https://x.com:8443/a')]);
    expect(m.matchUrl('https://x.com:8443/a')).not.toBeNull();
    expect(m.matchUrl('https://x.com:443/a')).toBeNull();
  });
});

describe('来源与手动优先', () => {
  it('命中返回来源标记', () => {
    const m = compile([src('*.bilibili.com', 'remote:s1')]);
    expect(m.matchUrl('https://x.bilibili.com/')).toMatchObject({ source: 'remote:s1' });
  });

  it('手动优先于远程（同规则并存）', () => {
    const m = compile([src('*.bilibili.com', 'remote:s1'), src('*.bilibili.com', 'manual')]);
    expect(m.matchUrl('https://x.bilibili.com/')).toMatchObject({ source: 'manual' });
  });
});

describe('边界', () => {
  it('非法 URL 不命中也不抛错', () => {
    const m = compile([src('baidu.com')]);
    expect(m.matchUrl('not a url')).toBeNull();
  });

  it('内部页不命中（规则天然不含此类形态）', () => {
    const m = compile([src('baidu.com')]);
    expect(m.matchUrl('chrome://flags')).toBeNull();
    expect(m.matchUrl('about:blank')).toBeNull();
  });

  it('file:// 精确 URL', () => {
    const m = compile([src('file:///C:/tmp/private.html')]);
    expect(m.matchUrl('file:///C:/tmp/private.html')).toMatchObject({ ruleText: 'file:///C:/tmp/private.html' });
    expect(m.matchUrl('file:///C:/tmp/other.html')).toBeNull();
  });

  it('同规则远程多源：首个引入者记名（collect 去重，compile 幂等）', () => {
    const m = compile([src('*.a.com', 'remote:s1'), src('*.a.com', 'remote:s2')]);
    // compile 不覆盖已存在的 key（除 manual 优先），保留首个
    expect(m.matchUrl('https://x.a.com/')).toMatchObject({ source: 'remote:s1' });
  });
});
