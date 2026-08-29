/**
 * 存储层（票 06）：sync 三单 blob（manual / remoteSources / settings，带 version）
 * + 本地按源缓存 `remote.<sourceId>` + 本机 PIN（不同步）。
 * 单 blob 整体替换 → last-write-wins 天然成立。
 *
 * 深化（票 01）：全部 blob 经统一信封读写——version 只写一次、只读一处（版本闸门，
 * 未来的 v2 迁移在此落地）；schema 解码/字段过滤按声明集中；key 空间（含 `remote.`
 * 前缀）只属于本模块，重置经 clearRemoteCaches 走接口。
 */

import { browser } from 'wxt/browser';
import { DEFAULT_PAGE_SIZE, MIN_PAGE_SIZE, MAX_PAGE_SIZE, MAX_RULE_LENGTH } from '../constants';
import { isSupportedLang } from '../i18n';
import type { ManualRule, RemoteSource, Settings, PinData, RemoteCache, ThemePref, UiLang } from '../types';

const VERSION = 1;

export const SYNC_KEYS = {
  manual: 'manual',
  sources: 'remoteSources',
  settings: 'settings',
} as const;

export const LOCAL_KEYS = {
  pin: 'pin',
} as const;

const REMOTE_CACHE_PREFIX = 'remote.';
export const remoteCacheKey = (sourceId: string) => `${REMOTE_CACHE_PREFIX}${sourceId}`;

type Area = 'sync' | 'local';

async function getArea<T>(area: Area, key: string): Promise<T | undefined> {
  try {
    const store = area === 'sync' ? browser.storage.sync : browser.storage.local;
    return (await store.get(key))[key] as T | undefined;
  } catch {
    return undefined;
  }
}

async function setArea(area: Area, key: string, value: unknown): Promise<boolean> {
  try {
    const store = area === 'sync' ? browser.storage.sync : browser.storage.local;
    await store.set({ [key]: value });
    return true;
  } catch {
    return false;
  }
}

/* ---------- 统一信封 ---------- */

/** blob 原始形态（version + schema 自己的字段）。 */
interface Blob {
  version?: unknown;
  [k: string]: unknown;
}

/**
 * 读 blob：版本闸门 + schema 解码的唯一入口。
 * 版本不匹配（未来版本 / 损坏）→ undefined，调用方按默认值兜底；
 * 未来 v2：在此识别旧版本并升级。
 */
async function readBlob<T>(
  area: Area,
  key: string,
  decode: (blob: Blob) => T | undefined,
): Promise<T | undefined> {
  const blob = await getArea<Blob>(area, key);
  if (!blob || typeof blob !== 'object') return undefined;
  if (blob.version !== VERSION) return undefined;
  return decode(blob);
}

/** 写 blob：信封（version + 字段）只在这一处拼装。 */
function writeBlob(area: Area, key: string, fields: Record<string, unknown>): Promise<boolean> {
  return setArea(area, key, { version: VERSION, ...fields });
}

/* ---------- manual（sync） ---------- */

function decodeManualRules(blob: Blob): ManualRule[] | undefined {
  if (!Array.isArray(blob.rules)) return undefined;
  return blob.rules.filter(
    (r): r is ManualRule => !!r && typeof (r as ManualRule).text === 'string' && isPlausibleRuleText((r as ManualRule).text),
  );
}

/** 廉价规则文本校验（与解析器前两条拒绝对齐：空白/超长）。完整解析在编译处（票 04）。 */
function isPlausibleRuleText(text: string): boolean {
  return text.length > 0 && text.length <= MAX_RULE_LENGTH && !/\s/.test(text);
}

export async function loadManualRules(): Promise<ManualRule[]> {
  return (await readBlob('sync', SYNC_KEYS.manual, decodeManualRules)) ?? [];
}

export async function saveManualRules(rules: ManualRule[]): Promise<boolean> {
  return writeBlob('sync', SYNC_KEYS.manual, { rules });
}

/* ---------- remoteSources（sync） ---------- */

function decodeSources(blob: Blob): RemoteSource[] | undefined {
  if (!Array.isArray(blob.sources)) return undefined;
  return blob.sources.filter(
    (s): s is RemoteSource =>
      !!s && typeof (s as RemoteSource).id === 'string' && typeof (s as RemoteSource).url === 'string',
  );
}

export async function loadSources(): Promise<RemoteSource[]> {
  return (await readBlob('sync', SYNC_KEYS.sources, decodeSources)) ?? [];
}

export async function saveSources(sources: RemoteSource[]): Promise<boolean> {
  return writeBlob('sync', SYNC_KEYS.sources, { sources });
}

/* ---------- settings（sync） ---------- */

const THEME_PREFS: ThemePref[] = ['system', 'light', 'dark'];

/** 解码：theme/language 为可选字段（票 11，VERSION=1 保持 + 缺省兜底），非法值回退默认。 */
function decodeSettings(blob: Blob): Settings | undefined {
  const n = Number(blob.pageSize);
  if (!Number.isInteger(n) || n < MIN_PAGE_SIZE || n > MAX_PAGE_SIZE) return undefined;
  const theme: ThemePref = THEME_PREFS.includes(blob.theme as ThemePref) ? (blob.theme as ThemePref) : 'system';
  const language: UiLang | null = isSupportedLang(blob.language) ? blob.language : null;
  return { pageSize: n, theme, language };
}

export async function loadSettings(): Promise<Settings> {
  return (
    (await readBlob('sync', SYNC_KEYS.settings, decodeSettings)) ?? {
      pageSize: DEFAULT_PAGE_SIZE,
      theme: 'system',
      language: null,
    }
  );
}

export async function saveSettings(settings: Settings): Promise<boolean> {
  return writeBlob('sync', SYNC_KEYS.settings, {
    pageSize: settings.pageSize,
    theme: settings.theme,
    ...(settings.language ? { language: settings.language } : {}),
  });
}

/* ---------- pin（local，仅本机，只存哈希） ---------- */

function decodePinData(blob: Blob): PinData {
  return { hash: typeof blob.hash === 'string' ? blob.hash : null };
}

export async function loadPinData(): Promise<PinData> {
  return (await readBlob('local', LOCAL_KEYS.pin, decodePinData)) ?? { hash: null };
}

export async function savePinData(pin: PinData): Promise<boolean> {
  return writeBlob('local', LOCAL_KEYS.pin, { hash: pin.hash });
}

/* ---------- 远程源内容缓存（local，按源一个 key） ---------- */

function decodeRemoteCache(blob: Blob): RemoteCache | undefined {
  if (!Array.isArray(blob.rules)) return undefined;
  return {
    fetchedAt: typeof blob.fetchedAt === 'number' ? blob.fetchedAt : 0,
    rules: blob.rules.filter((r): r is string => typeof r === 'string'),
  };
}

export async function loadRemoteCache(sourceId: string): Promise<RemoteCache | null> {
  return (await readBlob('local', remoteCacheKey(sourceId), decodeRemoteCache)) ?? null;
}

export async function saveRemoteCache(sourceId: string, cache: RemoteCache): Promise<boolean> {
  return writeBlob('local', remoteCacheKey(sourceId), { ...cache });
}

export async function deleteRemoteCache(sourceId: string): Promise<void> {
  try {
    await browser.storage.local.remove(remoteCacheKey(sourceId));
  } catch {
    /* 忽略 */
  }
}

/* ---------- 清空全部远程源缓存（重置设置用） ---------- */

/** 清掉全部 `remote.*` 本机缓存；key 空间知识只在本模块。 */
export async function clearRemoteCaches(): Promise<void> {
  try {
    const all = await browser.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith(REMOTE_CACHE_PREFIX));
    if (keys.length) await browser.storage.local.remove(keys);
  } catch {
    /* 忽略 */
  }
}
