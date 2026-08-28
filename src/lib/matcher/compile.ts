/**
 * 编译型匹配器（票 03/08）：主机后缀 Trie + 精确主机表 + 精确 URL 表。
 * 判定与删除分离：matchUrl 用归一化 URL 判命中；删除用访问真实 URL。
 * 纯 TS，无浏览器依赖，可单测。
 */

import type { ParsedRule, HostSemantics } from '../rules/parser';
import type { MatchResult, SourceRef } from '../types';

/** 带来源标记的规则（手动 / remote:<sourceId>）。 */
export type SourceRule = ParsedRule & { source: SourceRef };

interface TrieEntry {
  text: string;
  source: SourceRef;
  semantics: HostSemantics;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  entries: TrieEntry[];
}

export interface CompiledMatcher {
  /** 命中返回规则文本与来源；未命中返回 null。 */
  matchUrl(url: string): MatchResult | null;
}

export function compile(rules: SourceRule[]): CompiledMatcher {
  const root: TrieNode = { children: new Map(), entries: [] };
  const exactHosts = new Map<string, MatchResult>();
  const exactUrls = new Map<string, MatchResult>();

  for (const r of rules) {
    if (r.kind === 'host') {
      const entry: TrieEntry = { text: r.text, source: r.source, semantics: r.hostSemantics ?? 'plus' };
      if (r.host === '*') {
        // 裸 `*`：挂根节点，匹配不含点的主机名
        root.entries.push(entry);
        continue;
      }
      let node = root;
      const labels = r.host!.split('.').reverse();
      for (const label of labels) {
        let child = node.children.get(label);
        if (!child) {
          child = { children: new Map(), entries: [] };
          node.children.set(label, child);
        }
        node = child;
      }
      node.entries.push(entry);
    } else if (r.kind === 'exact-host') {
      setManualFirst(exactHosts, r.exactHost!, r);
    } else if (r.kind === 'exact-url') {
      setManualFirst(exactUrls, r.urlKey!, r);
    }
  }

  return { matchUrl: (url) => matchUrlImpl(url, root, exactHosts, exactUrls) };
}

function setManualFirst(map: Map<string, MatchResult>, key: string, r: SourceRule) {
  const res: MatchResult = { ruleText: r.text, source: r.source };
  const existing = map.get(key);
  if (!existing || res.source === 'manual') map.set(key, res);
}

function matchUrlImpl(
  url: string,
  root: TrieNode,
  exactHosts: Map<string, MatchResult>,
  exactUrls: Map<string, MatchResult>,
): MatchResult | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const scheme = u.protocol.slice(0, -1).toLowerCase();
  const host = u.hostname;
  const port = u.port;
  const candidates: MatchResult[] = [];

  if (scheme === 'file') {
    const hit = exactUrls.get(`file://${u.pathname}`);
    if (hit) candidates.push(hit);
    return pick(candidates);
  }

  // 精确 URL（scheme+host(:port)+path；query/hash 已由 URL 剥离）
  const urlKey = `${scheme}://${host}${port ? `:${port}` : ''}${u.pathname}`;
  const uh = exactUrls.get(urlKey);
  if (uh) candidates.push(uh);

  // 精确主机（IP 字面量 / 带端口条目）
  const eh = exactHosts.get(host);
  if (eh) candidates.push(eh);
  const ehp = port ? exactHosts.get(`${host}:${port}`) : undefined;
  if (ehp) candidates.push(ehp);

  // 后缀 Trie（方括号 IPv6 不参与子域匹配）
  if (!host.startsWith('[')) {
    const labels = host.split('.');
    let node: TrieNode | undefined = root;
    let remaining = labels.length;
    for (const entry of node.entries) collectIfMatch(candidates, entry, remaining);
    while (remaining > 0 && node) {
      node = node.children.get(labels[remaining - 1]!);
      if (!node) break;
      remaining--;
      for (const entry of node.entries) collectIfMatch(candidates, entry, remaining);
    }
  }

  return pick(candidates);
}

function collectIfMatch(candidates: MatchResult[], entry: TrieEntry, remaining: number) {
  const ok =
    entry.semantics === 'plus' ||
    (entry.semantics === 'dot' && remaining > 0) ||
    (entry.semantics === 'star' && remaining === 1);
  if (ok) candidates.push({ ruleText: entry.text, source: entry.source });
}

/** 手动优先（票 07：手动条目优先于远程展示）。 */
function pick(candidates: MatchResult[]): MatchResult | null {
  if (!candidates.length) return null;
  return candidates.find((c) => c.source === 'manual') ?? candidates[0] ?? null;
}
