/**
 * 存储层（票 06）：sync 三单 blob（manual / remoteSources / settings，带 version）
 * + 本地按源缓存 `remote.<sourceId>` + 本机 PIN（不同步）。
 * 单 blob 整体替换 → last-write-wins 天然成立。
 */

import { browser } from 'wxt/browser';
import { DEFAULT_PAGE_SIZE, MIN_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';
import type { ManualRule, RemoteSource, Settings, PinData, RemoteCache } from '../types';

const VERSION = 1;

export const SYNC_KEYS = {
  manual: 'manual',
  sources: 'remoteSources',
  settings: 'settings',
} as const;

export const LOCAL_KEYS = {
  pin: 'pin',
} as const;

export const remoteCacheKey = (sourceId: string) => `remote.${sourceId}`;

async function getArea<T>(area: 'sync' | 'local', key: string): Promise<T | undefined> {
  try {
    const store = area === 'sync' ? browser.storage.sync : browser.storage.local;
    return (await store.get(key))[key] as T | undefined;
  } catch {
    return undefined;
  }
}

async function setArea(area: 'sync' | 'local', key: string, value: unknown): Promise<boolean> {
  try {
    const store = area === 'sync' ? browser.storage.sync : browser.storage.local;
    await store.set({ [key]: value });
    return true;
  } catch {
    return false;
  }
}

/* ---------- manual（sync） ---------- */

export async function loadManualRules(): Promise<ManualRule[]> {
  const blob = await getArea<{ version?: number; rules?: unknown }>('sync', SYNC_KEYS.manual);
  if (!blob || !Array.isArray(blob.rules)) return [];
  return blob.rules.filter((r): r is ManualRule => !!r && typeof (r as ManualRule).text === 'string');
}

export async function saveManualRules(rules: ManualRule[]): Promise<boolean> {
  return setArea('sync', SYNC_KEYS.manual, { version: VERSION, rules });
}

/* ---------- remoteSources（sync） ---------- */

export async function loadSources(): Promise<RemoteSource[]> {
  const blob = await getArea<{ version?: number; sources?: unknown }>('sync', SYNC_KEYS.sources);
  if (!blob || !Array.isArray(blob.sources)) return [];
  return blob.sources.filter(
    (s): s is RemoteSource =>
      !!s && typeof (s as RemoteSource).id === 'string' && typeof (s as RemoteSource).url === 'string',
  );
}

export async function saveSources(sources: RemoteSource[]): Promise<boolean> {
  return setArea('sync', SYNC_KEYS.sources, { version: VERSION, sources });
}

/* ---------- settings（sync） ---------- */

export async function loadSettings(): Promise<Settings> {
  const blob = await getArea<{ version?: number; pageSize?: unknown }>('sync', SYNC_KEYS.settings);
  const n = Number(blob?.pageSize);
  return {
    pageSize: Number.isInteger(n) && n >= MIN_PAGE_SIZE && n <= MAX_PAGE_SIZE ? n : DEFAULT_PAGE_SIZE,
  };
}

export async function saveSettings(settings: Settings): Promise<boolean> {
  return setArea('sync', SYNC_KEYS.settings, { version: VERSION, pageSize: settings.pageSize });
}

/* ---------- pin（local，仅本机，只存哈希） ---------- */

export async function loadPinData(): Promise<PinData> {
  const blob = await getArea<{ version?: number; hash?: unknown }>('local', LOCAL_KEYS.pin);
  return { hash: typeof blob?.hash === 'string' ? blob.hash : null };
}

export async function savePinData(pin: PinData): Promise<boolean> {
  return setArea('local', LOCAL_KEYS.pin, { version: VERSION, hash: pin.hash });
}

/* ---------- 远程源内容缓存（local，按源一个 key） ---------- */

export async function loadRemoteCache(sourceId: string): Promise<RemoteCache | null> {
  const blob = await getArea<{ version?: number; fetchedAt?: unknown; rules?: unknown }>(
    'local',
    remoteCacheKey(sourceId),
  );
  if (!blob || !Array.isArray(blob.rules)) return null;
  return {
    fetchedAt: typeof blob.fetchedAt === 'number' ? blob.fetchedAt : 0,
    rules: blob.rules as string[],
  };
}

export async function saveRemoteCache(sourceId: string, cache: RemoteCache): Promise<boolean> {
  return setArea('local', remoteCacheKey(sourceId), { version: VERSION, ...cache });
}

export async function deleteRemoteCache(sourceId: string): Promise<void> {
  try {
    await browser.storage.local.remove(remoteCacheKey(sourceId));
  } catch {
    /* 忽略 */
  }
}
