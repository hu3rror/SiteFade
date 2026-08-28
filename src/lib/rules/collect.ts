/**
 * 规则收集与去重（票 06/07）：手动规则 + 各启用远程源缓存 → 全局去重。
 * 由规则快照（snapshot.ts）与设置页概览（overview.ts）共用，避免两份漂移的实现。
 *
 * 票 04 深化：entries 只携带规范文本 + 来源（文本即去重键，写路径已规范化）；
 * 「文本 → 解析结构」不再发生在此，只在编译处一次。
 */

import type { ManualRule, RemoteSource, SourceRef } from '../types';
import { loadManualRules, loadSources, loadRemoteCache } from '../storage/store';

/** 去重合并后的一条规则（规范文本 + 来源标记）。 */
export interface RuleEntry {
  text: string;
  source: SourceRef;
}

export interface CollectedRules {
  /** 原始手动规则（含 id，供 UI 展示/删除）。 */
  manualRules: ManualRule[];
  /** 原始远程源定义。 */
  sources: RemoteSource[];
  /** 全局去重后的规则（手动优先、首个引入源记名，票 07）。 */
  entries: RuleEntry[];
  /** 每来源贡献的全局唯一规则数（含 'manual'）。 */
  perSource: Map<string, number>;
}

/** 合并全部来源规则：手动在前，随后按源顺序引入远程；重复者只保留首个。 */
export async function collectRuleEntries(): Promise<CollectedRules> {
  const manualRules = await loadManualRules();
  const sources = await loadSources();
  const entries: RuleEntry[] = [];
  const seen = new Set<string>();
  const perSource = new Map<string, number>();
  let manualCount = 0;

  for (const r of manualRules) {
    if (!seen.has(r.text)) {
      seen.add(r.text);
      entries.push({ text: r.text, source: 'manual' });
      manualCount++;
    }
  }
  perSource.set('manual', manualCount);

  for (const s of sources) {
    let count = 0;
    if (s.enabled) {
      const cache = await loadRemoteCache(s.id);
      if (cache) {
        for (const t of cache.rules) {
          if (!seen.has(t)) {
            seen.add(t);
            entries.push({ text: t, source: `remote:${s.id}` });
            count++;
          }
        }
      }
    }
    perSource.set(s.id, count);
  }

  return { manualRules, sources, entries, perSource };
}
