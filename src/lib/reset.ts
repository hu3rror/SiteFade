/**
 * 重置设置（票 09）：清 PIN + 本机缓存 + 远程源定义；保留手动规则。
 * 在 background 的 'reset' 消息、PIN 锁定屏、设置页底部共用。
 */

import { browser } from 'wxt/browser';
import { savePinData, saveSettings, saveSources } from './storage/store';
import { DEFAULT_PAGE_SIZE } from './constants';

export async function resetSettings(): Promise<void> {
  await savePinData({ hash: null });
  await saveSettings({ pageSize: DEFAULT_PAGE_SIZE });
  await saveSources([]);
  try {
    const all = await browser.storage.local.get(null);
    for (const key of Object.keys(all)) {
      if (key.startsWith('remote.')) await browser.storage.local.remove(key);
    }
  } catch {
    /* 忽略 */
  }
}
