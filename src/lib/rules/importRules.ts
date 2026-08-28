/**
 * 手动规则导入（票 05/06）：粘贴 / 本地文件共用的导入管线。
 *  - 逐行解析 + 类型识别 + 规范化去重（parseRules）；
 *  - 与现网手动规则去重；
 *  - 超限行为 = 拒绝整批新增并提示（票 06：1000 上限）。
 * 依赖 storage 层，运行于扩展上下文；核心逻辑纯函数可单测。
 */

import { MANUAL_LIMIT } from '../constants';
import { parseRules } from './parser';
import { loadManualRules, saveManualRules } from '../storage/store';
import { genId } from '../id';

export interface ManualImportResult {
  added: number;
  duplicate: number;
  invalid: number;
  invalidDetail: { line: string; reason: string }[];
  /** 超出手动上限（整批被拒绝，added=0）。 */
  limitHit: boolean;
  /** 最终手动规则总数（含此前已有）。 */
  total: number;
}

/** 纯逻辑：把「待新增的规范化规则文本」并入现有手动规则，执行上限策略。 */
export function mergeManual(
  existing: { id: string; text: string }[],
  candidates: string[],
): { rules: { id: string; text: string }[]; added: number; duplicate: number; limitHit: boolean } {
  const seen = new Set(existing.map((r) => r.text));
  const addedList: { id: string; text: string }[] = [];
  let duplicate = 0;
  for (const text of candidates) {
    if (seen.has(text)) {
      duplicate++;
      continue;
    }
    addedList.push({ id: genId(), text });
    seen.add(text);
  }
  if (existing.length + addedList.length > MANUAL_LIMIT) {
    return { rules: existing.map((r) => ({ id: r.id, text: r.text })), added: 0, duplicate: 0, limitHit: true };
  }
  return {
    rules: [...existing.map((r) => ({ id: r.id, text: r.text })), ...addedList],
    added: addedList.length,
    duplicate,
    limitHit: false,
  };
}

/** 导入一条清单文本（每行一条规则）到手动规则，落库并返回摘要。 */
export async function importManualRules(input: string): Promise<ManualImportResult> {
  const parsed = parseRules(input);
  const existing = await loadManualRules();
  const merged = mergeManual(existing, parsed.rules.map((r) => r.text));
  const total = merged.rules.length;
  if (merged.limitHit) {
    return {
      added: 0,
      duplicate: 0,
      invalid: parsed.invalid,
      invalidDetail: parsed.invalidDetail,
      limitHit: true,
      total,
    };
  }
  if (merged.added > 0) await saveManualRules(merged.rules);
  return {
    added: merged.added,
    duplicate: parsed.duplicate + merged.duplicate,
    invalid: parsed.invalid,
    invalidDetail: parsed.invalidDetail,
    limitHit: false,
    total,
  };
}
