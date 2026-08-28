/**
 * 设置页初始加载的全量概览（票 06/09）。
 */

import type { Overview, RemoteSource } from './types';
import { loadSettings, loadPinData } from './storage/store';
import { collectRuleEntries } from './rules/collect';

export async function collectOverview(): Promise<Overview> {
  const { manualRules, sources, entries, perSource } = await collectRuleEntries();
  const settings = await loadSettings();
  const pin = await loadPinData();

  const sourcesWithCounts: Array<RemoteSource & { ruleCount: number }> = sources.map((s) => ({
    ...s,
    ruleCount: perSource.get(s.id) ?? 0,
  }));

  return {
    manualRules,
    sources: sourcesWithCounts,
    settings,
    pinEnabled: !!pin.hash,
    ruleRows: entries.map((e) => ({ text: e.rule.text, sourceRef: e.source })),
    allRuleTexts: entries.map((e) => e.rule.text),
    totalRules: entries.length,
  };
}
