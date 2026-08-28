/**
 * 设置页初始加载的全量概览（票 06/09）。
 *
 * 票 03 深化：规则数据直接取自规则快照（单次收集），不再各自再收集一遍。
 */

import type { Overview } from './types';
import { loadSettings, loadPinData } from './storage/store';
import { buildSnapshot } from './snapshot';

export async function collectOverview(): Promise<Overview> {
  const snap = await buildSnapshot();
  const settings = await loadSettings();
  const pin = await loadPinData();

  const sourcesWithCounts = snap.sources.map((s) => ({
    ...s,
    ruleCount: snap.perSource.get(s.id) ?? 0,
  }));

  return {
    manualRules: snap.manualRules,
    sources: sourcesWithCounts,
    settings,
    pinEnabled: !!pin.hash,
    ruleRows: snap.entries.map((e) => ({ text: e.text, sourceRef: e.source })),
    allRuleTexts: snap.entries.map((e) => e.text),
    totalRules: snap.totalRules,
  };
}
