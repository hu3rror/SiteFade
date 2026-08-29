/**
 * popup ↔ background 消息协议（popup 用消息查询/变更，background 持有匹配器）。
 */

import { browser } from 'wxt/browser';
import type { StatusSnapshot } from './types';

export type PopupMessage =
  | { type: 'status'; url: string }
  | { type: 'addHost'; host: string }
  | { type: 'removeManual'; text: string }
  | { type: 'reset' };

export type PopupAction = 'added' | 'exists' | 'limit' | 'removed' | 'not-found';

export interface PopupResponse {
  ok: boolean;
  error?: string;
  status?: StatusSnapshot;
  action?: PopupAction;
  limit?: number;
}

export async function sendPopupMessage(msg: PopupMessage): Promise<PopupResponse> {
  try {
    const res = (await browser.runtime.sendMessage(msg)) as PopupResponse | undefined;
    return res ?? { ok: false, error: 'error_noBackground' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
