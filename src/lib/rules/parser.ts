/**
 * 规则解析与规范化（票 05 / CONTEXT.md 通配符语义）。
 * 纯 TS，无浏览器依赖，可单测。
 *
 * 合法形态：
 *  - 裸域名（baidu.com，语义 = 含根多级 `+`）
 *  - 通配符（*.a.com / +.a.com / .a.com / 裸 `*`）
 *  - IP 字面量（127.0.0.1 / [::1]，主机精确命中）
 *  - 带端口条目（example.com:8080 / 127.0.0.1:8080 / [::1]:8080）
 *  - 精确 URL（http(s)://… 或 file://…；query/hash 忽略）
 *
 * 其余一律无效（chrome://、about:、data: 等）。
 */

import { MAX_RULE_LENGTH } from '../constants';

export type RuleKind = 'host' | 'exact-host' | 'exact-url';
export type HostSemantics = 'plus' | 'dot' | 'star';

/** 规范化后的单条规则。 */
export interface ParsedRule {
  /** 规范化展示文本（也是去重 key）。 */
  text: string;
  kind: RuleKind;
  /** kind=host：域名部分（不含前缀符号）；host='*' 表示裸 `*`。 */
  host?: string;
  hostSemantics?: HostSemantics;
  /** kind=exact-host：host 或 host:port（已小写规范化）。 */
  exactHost?: string;
  /** kind=exact-url：scheme://host(:port)/path 归一键。 */
  urlKey?: string;
}

export interface ParseIssue {
  line: string;
  reason: string;
}

export interface ParseResult {
  rules: ParsedRule[];
  added: number;
  duplicate: number;
  invalid: number;
  invalidDetail: ParseIssue[];
}

/** 单行解析：返回规则 / 错误 / null（空行或注释）。 */
export function parseLine(line: string): ParsedRule | { error: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  if (trimmed.length > MAX_RULE_LENGTH) return { error: '超过 2048 字符' };
  if (/\s/.test(trimmed)) return { error: '包含空白字符' };

  // 精确 URL（http/https/file）
  if (/^[a-z]+:\/\//i.test(trimmed)) return parseExactUrl(trimmed);

  // 裸 `*`：只匹配不含点的主机名
  if (trimmed === '*') return { text: '*', kind: 'host', host: '*', hostSemantics: 'star' };

  // 通配符前缀（一个前缀字符 + 域名）
  if (trimmed.startsWith('*.')) {
    const host = normalizeHostname(trimmed.slice(2));
    if (!host) return { error: '主机名非法' };
    return { text: `*.${host}`, kind: 'host', host, hostSemantics: 'star' };
  }
  if (trimmed.startsWith('+.')) {
    const host = normalizeHostname(trimmed.slice(2));
    if (!host) return { error: '主机名非法' };
    return { text: `+.${host}`, kind: 'host', host, hostSemantics: 'plus' };
  }
  if (trimmed.startsWith('.')) {
    const host = normalizeHostname(trimmed.slice(1));
    if (!host) return { error: '主机名非法' };
    return { text: `.${host}`, kind: 'host', host, hostSemantics: 'dot' };
  }

  // 方括号 IPv6 字面量（[::1] 或 [::1]:port）
  if (trimmed.startsWith('[')) {
    const m = trimmed.match(/^(\[[0-9a-fA-F:.]+\])(?::(\d{1,5}))?$/);
    if (!m) return { error: 'IPv6 字面量格式非法' };
    const host = m[1]!.toLowerCase();
    const port = m[2]!;
    if (port && !isValidPort(port)) return { error: '端口范围非法' };
    const exactHost = port ? `${host}:${port}` : host;
    return { text: exactHost, kind: 'exact-host', exactHost };
  }

  // 带冒号 → 带端口条目 host:port
  if (trimmed.includes(':')) {
    const m = trimmed.match(/^([^:]+):(\d{1,5})$/);
    if (!m) return { error: '带端口条目格式非法' };
    const host = normalizeHostname(m[1]!);
    if (!host) return { error: '主机名非法' };
    if (!isValidPort(m[2]!)) return { error: '端口范围非法' };
    const exactHost = `${host}:${m[2]!}`;
    return { text: exactHost, kind: 'exact-host', exactHost };
  }

  // 裸域名或 IPv4 字面量
  const host = normalizeHostname(trimmed);
  if (!host) return { error: '主机名非法' };
  if (isIpv4Literal(host)) return { text: host, kind: 'exact-host', exactHost: host };
  return { text: host, kind: 'host', host, hostSemantics: 'plus' };
}

/** 批量解析：空行/注释忽略、逐行失败不中断、去重、给摘要。 */
export function parseRules(text: string): ParseResult {
  const seen = new Set<string>();
  const rules: ParsedRule[] = [];
  const invalidDetail: ParseIssue[] = [];
  let added = 0;
  let duplicate = 0;
  let invalid = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const res = parseLine(line);
    if (res === null) continue;
    if ('error' in res) {
      invalid++;
      invalidDetail.push({ line, reason: res.error });
      continue;
    }
    if (seen.has(res.text)) {
      duplicate++;
      continue;
    }
    seen.add(res.text);
    rules.push(res);
    added++;
  }
  return { rules, added, duplicate, invalid, invalidDetail };
}

/** 从 URL 提取并匹配的规范化文本（popup「设为不记入历史」用）。 */
export function hostnameOfUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!host || host.startsWith('[')) return null;
    return normalizeHostname(host);
  } catch {
    return null;
  }
}

function parseExactUrl(line: string): ParsedRule | { error: string } {
  let u: URL;
  try {
    u = new URL(line);
  } catch {
    return { error: 'URL 无法解析' };
  }
  const scheme = u.protocol.slice(0, -1).toLowerCase();
  if (scheme === 'file') {
    const urlKey = `file://${u.pathname}`;
    return { text: urlKey, kind: 'exact-url', urlKey };
  }
  if (scheme !== 'http' && scheme !== 'https') return { error: '特殊 scheme 拒绝' };
  if (!u.hostname) return { error: '缺少主机名' };

  const host = u.hostname; // URL 已小写化并 IDN→punycode
  if (!validHostSyntax(host)) return { error: '主机名非法' };

  const port = u.port ? `:${u.port}` : '';
  const urlKey = `${scheme}://${host}${port}${u.pathname}`;
  return { text: urlKey, kind: 'exact-url', urlKey };
}

/** 校验/规范化主机名：小写、IDN→punycode、标签/长度/字符检查。失败返回 null。 */
function normalizeHostname(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s || s.length > 253 || /[/\s]/.test(s) || s.includes('..')) return null;
  let host: string;
  try {
    host = new URL(`http://${s}/`).hostname;
  } catch {
    return null;
  }
  if (!host || host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null;
  if (!validHostSyntax(host)) return null;
  return host;
}

function validHostSyntax(host: string): boolean {
  // 方括号 IPv6 整体放行（不在此做标签校验）
  if (host.startsWith('[') && host.endsWith(']')) return true;
  if (host.length > 253) return false;
  const labels = host.split('.');
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) return false;
  }
  return true;
}

function isIpv4Literal(host: string): boolean {
  return /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(host);
}

function isValidPort(p: string): boolean {
  const n = Number(p);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}
