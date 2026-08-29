/**
 * 远程源拉取（票 07）：fetch + 响应上限 + 逐行同本地校验。
 * 纯数据解析，从不执行。纯 TS，可单测（依赖注入 fetch）。
 *
 * 票 02 深化：权限 pattern 推导已移入管理模块（授权 seam），拉取只管拉取。
 */

import { MAX_RESPONSE_BYTES, FETCH_TIMEOUT_MS } from '../constants';
import { parseRules } from '../rules/parser';

export type FetchKind = 'ok' | 'network' | 'http' | 'parse';

export interface FetchOutcome {
  ok: boolean;
  kind: FetchKind;
  detail?: string;
  /** 成功时：规范化去重后的规则文本。 */
  rules?: string[];
  summary?: { added: number; duplicate: number; invalid: number };
}

export type FetchFn = (url: string, init: { signal: AbortSignal; cache: RequestCache }) => Promise<Response>;

/** 拉取远程清单。默认用全局 fetch；测试可注入。 */
export async function fetchSourceList(url: string, fetchFn: FetchFn = fetch): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetchFn(url, { signal: controller.signal, cache: 'no-store' });
  } catch (e) {
    const msg = controller.signal.aborted ? 'error_timeout' : e instanceof Error ? e.message : 'error_network';
    return { ok: false, kind: 'network', detail: msg };
  } finally {
    clearTimeout(timer);
  }

  try {
    if (!resp.ok) return { ok: false, kind: 'http', detail: `HTTP ${resp.status}` };
    const contentLength = resp.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
      return { ok: false, kind: 'parse', detail: 'error_responseTooLarge' };
    }
    const text = await resp.text();
    // 字节级校验（UTF-8）；text.length 是 UTF-16 码元数，中文会低估。
    if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES) {
      return { ok: false, kind: 'parse', detail: 'error_responseTooLarge' };
    }
    const parsed = parseRules(text);
    return {
      ok: true,
      kind: 'ok',
      rules: parsed.rules.map((r) => r.text),
      summary: { added: parsed.added, duplicate: parsed.duplicate, invalid: parsed.invalid },
    };
  } catch (e) {
    return { ok: false, kind: 'network', detail: e instanceof Error ? e.message : 'error_readFailed' };
  }
}
