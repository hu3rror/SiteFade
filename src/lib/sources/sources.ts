/**
 * 远程源状态机（票 07）：
 *  - 首拉失败也允许建源（标「从未成功」）；
 *  - 失败保留上次成功缓存，失败原因分三类透出；
 *  - 失败计数只记自动刷新；手动刷新成功即清零；连续 3 次自动停用。
 * 纯 TS，可单测。
 */

import { MAX_SOURCE_FAILURES } from '../constants';
import type { RemoteSource, SourceError, SourceErrorKind } from '../types';

export const FAILURE_LABEL: Record<SourceErrorKind, string> = {
  network: 'source.kind.network',
  http: 'source.kind.http',
  parse: 'source.kind.parse',
};

/** 应用一次拉取结果到源状态。isAuto 控制失败计数是否累加。 */
export function applyFetchOutcome(
  source: RemoteSource,
  outcome: { ok: boolean; kind: SourceErrorKind | 'ok'; detail?: string },
  isAuto: boolean,
): RemoteSource {
  const next: RemoteSource = { ...source };
  if (outcome.ok) {
    next.failCount = 0;
    // 票 07：连续失败被停用后，成功（含手动刷新成功）即重新启用；
    // 用户手动关闭的源不在此强开。
    if (next.disabledByFailures) {
      next.disabledByFailures = false;
      next.enabled = true;
    }
    next.lastSuccessAt = Date.now();
    next.lastError = null;
    return next;
  }
  const err: SourceError = { kind: outcome.kind as SourceErrorKind, detail: outcome.detail ?? '', at: Date.now() };
  next.lastError = err;
  if (isAuto) {
    next.failCount = (next.failCount ?? 0) + 1;
    if (next.failCount >= MAX_SOURCE_FAILURES) {
      next.disabledByFailures = true;
      next.enabled = false;
    }
  }
  return next;
}
