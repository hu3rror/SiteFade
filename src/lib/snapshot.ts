/**
 * 规则快照（票 03 深化）：「当前有效规则集」的唯一深模块——编译匹配器 + 分源统计 +
 * 来源名映射，一次建立、不可变。删除路径、popup status、设置页概览从同一快照读取，
 * 不再各自重新收集；storage 变化由一个「作废→重建」接口驱动。
 */

import { compile, type CompiledMatcher } from './matcher/compile';
import { collectRuleEntries, type RuleEntry } from './rules/collect';
import type { ManualRule, RemoteSource } from './types';

export interface RuleSnapshot {
  /** 编译匹配器：onVisited 删除与 popup status 共用。 */
  matcher: CompiledMatcher;
  /** 原始手动规则（含 id，供设置页展示/删除）。 */
  manualRules: ManualRule[];
  /** 原始远程源定义。 */
  sources: RemoteSource[];
  /** 全局去重后的规则（手动优先、首个引入源记名）。 */
  entries: RuleEntry[];
  /** 每来源贡献的全局唯一规则数（含 'manual'）。 */
  perSource: Map<string, number>;
  totalRules: number;
  manualCount: number;
  remoteCount: number;
  /** sourceId → 名称，popup 命中标签用。 */
  sourceNames: Record<string, string>;
}

/** 建立当前规则集快照：收集一次 → 编译一次（解析在编译处发生）。 */
export async function buildSnapshot(): Promise<RuleSnapshot> {
  const { manualRules, sources, entries, perSource } = await collectRuleEntries();
  const matcher = compile(entries);
  const manualCount = perSource.get('manual') ?? 0;
  const sourceNames: Record<string, string> = {};
  for (const s of sources) sourceNames[s.id] = s.name;
  return {
    matcher,
    manualRules,
    sources,
    entries,
    perSource,
    totalRules: entries.length,
    manualCount,
    remoteCount: entries.length - manualCount,
    sourceNames,
  };
}
