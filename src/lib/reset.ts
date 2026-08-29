/**
 * 重置设置（票 09）：清 PIN + 本机缓存 + 远程源定义；保留手动规则。
 * 在 background 的 'reset' 消息、PIN 锁定屏、设置页底部共用。
 *
 * 票 01 深化：清远程缓存改经存储模块接口（key 空间归存储模块所有）。
 */

import { savePinData, saveSettings, saveSources, clearRemoteCaches } from './storage/store';
import { DEFAULT_PAGE_SIZE } from './constants';

export async function resetSettings(): Promise<void> {
  await savePinData({ hash: null });
  await saveSettings({ pageSize: DEFAULT_PAGE_SIZE, theme: 'system', language: null });
  await saveSources([]);
  await clearRemoteCaches();
}
