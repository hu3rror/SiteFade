/**
 * 规则解析与规范化测试（票 05 / CONTEXT.md 通配符语义）。
 */
import { describe, it, expect } from 'vitest';
import { parseLine, parseRules, hostnameOfUrl } from './parser';

describe('parseLine 基本形态', () => {
  it('裸域名 = 含根多级 +', () => {
    const r = parseLine('baidu.com');
    expect(r).toMatchObject({ text: 'baidu.com', kind: 'host', host: 'baidu.com', hostSemantics: 'plus' });
  });

  it('单级通配符 *.a.com', () => {
    const r = parseLine('*.baidu.com');
    expect(r).toMatchObject({ text: '*.baidu.com', kind: 'host', host: 'baidu.com', hostSemantics: 'star' });
  });

  it('多级含根 +.a.com', () => {
    const r = parseLine('+.baidu.com');
    expect(r).toMatchObject({ text: '+.baidu.com', kind: 'host', host: 'baidu.com', hostSemantics: 'plus' });
  });

  it('多级不含根 .a.com', () => {
    const r = parseLine('.baidu.com');
    expect(r).toMatchObject({ text: '.baidu.com', kind: 'host', host: 'baidu.com', hostSemantics: 'dot' });
  });

  it('裸 `*`', () => {
    const r = parseLine('*');
    expect(r).toMatchObject({ text: '*', kind: 'host', host: '*', hostSemantics: 'star' });
  });

  it('www 不归一（裸域名已覆盖子域）', () => {
    const r = parseLine('www.baidu.com');
    expect(r).toMatchObject({ text: 'www.baidu.com', kind: 'host', hostSemantics: 'plus' });
  });

  it('大写归一、尾点无效（票 05：首尾点不过校验）', () => {
    expect(parseLine('BAIDU.COM')).toMatchObject({ text: 'baidu.com' });
    expect('error' in parseLine('baidu.com.')!).toBe(true);
    expect('error' in parseLine('.baidu.com')!).toBe(false); // 前缀 `.` 属通配符语义
  });
});

describe('parseLine IP 字面量 / 带端口条目', () => {
  it('IPv4 = 主机精确命中', () => {
    const r = parseLine('127.0.0.1');
    expect(r).toMatchObject({ text: '127.0.0.1', kind: 'exact-host', exactHost: '127.0.0.1' });
  });

  it('IPv6 方括号', () => {
    const r = parseLine('[::1]');
    expect(r).toMatchObject({ text: '[::1]', kind: 'exact-host', exactHost: '[::1]' });
  });

  it('IPv6 + 端口', () => {
    const r = parseLine('[::1]:8080');
    expect(r).toMatchObject({ text: '[::1]:8080', kind: 'exact-host', exactHost: '[::1]:8080' });
  });

  it('主机 + 端口', () => {
    const r = parseLine('example.com:8080');
    expect(r).toMatchObject({ text: 'example.com:8080', kind: 'exact-host', exactHost: 'example.com:8080' });
  });

  it('端口越界无效', () => {
    expect('error' in parseLine('example.com:99999')!).toBe(true);
    expect('error' in parseLine('example.com:0')!).toBe(true);
  });
});

describe('parseLine 精确 URL', () => {
  it('http(s) 精确 URL：query/hash 忽略', () => {
    const r = parseLine('https://x.com/a?q=1#frag');
    expect(r).toMatchObject({ text: 'https://x.com/a', kind: 'exact-url', urlKey: 'https://x.com/a' });
  });

  it('主机小写归一、路径大小写保留', () => {
    const r = parseLine('http://X.com/A');
    expect(r).toMatchObject({ text: 'http://x.com/A', urlKey: 'http://x.com/A' });
  });

  it('带端口精确 URL', () => {
    const r = parseLine('https://x.com:8443/a');
    expect(r).toMatchObject({ urlKey: 'https://x.com:8443/a' });
  });

  it('file:// 精确 URL 例外', () => {
    const r = parseLine('file:///C:/tmp/private.html');
    expect(r).toMatchObject({ kind: 'exact-url', urlKey: 'file:///C:/tmp/private.html' });
  });

  it('特殊 scheme 拒绝', () => {
    for (const bad of ['chrome://flags', 'brave://settings', 'edge://newtab', 'about:blank', 'data:text/html,hi', 'devtools://x']) {
      const res = parseLine(bad);
      expect(res && 'error' in res).toBe(true);
    }
  });
});

describe('parseLine 非法输入', () => {
  it('空行 / 注释 / 纯空白 → null', () => {
    expect(parseLine('')).toBeNull();
    expect(parseLine('   ')).toBeNull();
    expect(parseLine('# 注释')).toBeNull();
  });

  it('含空白 → 无效', () => {
    expect('error' in parseLine('foo bar.com')!).toBe(true);
  });

  it('超长 → 无效', () => {
    expect('error' in parseLine(`${'a'.repeat(2049)}.com`)!).toBe(true);
  });

  it('主机名语法非法 → 无效', () => {
    expect('error' in parseLine('bad_host..com')!).toBe(true);
    expect('error' in parseLine('-bad.com')!).toBe(true);
    expect('error' in parseLine('bad-.com')!).toBe(true);
    expect('error' in parseLine('a'.repeat(64) + '.com')!).toBe(true);
  });
});

describe('parseRules 批量 + 摘要', () => {
  it('空行/注释忽略、去重、无效计数', () => {
    const input = ['baidu.com', '  ', '# 注释', 'baidu.com', 'chrome://flags', 'foo bar.com'].join('\n');
    const res = parseRules(input);
    expect(res.added).toBe(1);
    expect(res.duplicate).toBe(1);
    expect(res.invalid).toBe(2);
    expect(res.invalidDetail).toHaveLength(2);
    expect(res.rules.map((r) => r.text)).toEqual(['baidu.com']);
  });

  it('CRLF 换行', () => {
    const res = parseRules('baidu.com\r\nfoo.com\r\n');
    expect(res.added).toBe(2);
  });
});

describe('hostnameOfUrl', () => {
  it('提取主机', () => {
    expect(hostnameOfUrl('https://www.x.com/a')).toBe('www.x.com');
  });
  it('非法 URL → null', () => {
    expect(hostnameOfUrl('not a url')).toBeNull();
  });
  it('IPv6 → null（不参与子域匹配）', () => {
    expect(hostnameOfUrl('http://[::1]:8080/')).toBeNull();
  });
});
