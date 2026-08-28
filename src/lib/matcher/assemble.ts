/**
 * 匹配器组装（票 06/07）：手动 + 各启用远程源缓存 → 全局去重 → 编译。
 */

import { compile, type SourceRule } from './compile';
import { collectRuleEntries } from '../rules/collect';
import type { CompiledMatcher } from './compile';

/** 编译当前规则集合（手动 + 各启用远程源）→ 匹配器。 */
export async function buildMatcher(): Promise<CompiledMatcher> {
  const { entries } = await collectRuleEntries();
  return compile(entries.map((e): SourceRule => ({ ...e.rule, source: e.source })));
}
