/**
 * 界面语言纯逻辑（i18n 基础设施，票 11）：语言归一 + 消息字典 + 占位符替换。
 * 纯 TS，无浏览器依赖，可单测。
 *
 * 运行时字典由 i18n.svelte.ts 从 `public/_locales/<lang>/messages.json` 加载（单一来源，
 * 同一份 JSON 也喂 manifest 的 __MSG_ 占位符）。本模块只做纯函数。
 */

import type { UiLang } from './types';

export const SUPPORTED_LANGS: UiLang[] = ['zh_CN', 'en'];
/** 中文为完整基线，缺失词条回退中文。 */
export const DEFAULT_LANG: UiLang = 'zh_CN';

/** 值是否为受支持语言。 */
export function isSupportedLang(v: unknown): v is UiLang {
  return v === 'zh_CN' || v === 'en';
}

/** 浏览器语言 → 受支持语言：zh 前缀 → 中文，en 前缀 → 英文，其余回退中文基线。 */
export function resolveLang(raw: string | null | undefined): UiLang {
  const s = (raw ?? '').trim().toLowerCase();
  if (s.startsWith('zh')) return 'zh_CN';
  if (s.startsWith('en')) return 'en';
  return DEFAULT_LANG;
}

export interface MessageCatalog {
  [key: string]: string;
}

export type TParams = Record<string, string | number>;
export type TFunction = (key: string, params?: TParams) => string;

/**
 * 构造翻译函数。占位符 `{name}` 按 params 替换；
 * 缺 key → 回退字典 → 仍缺则原样返回 key（开发期可见缺失）。
 * 非 key 的原始串（如 `HTTP 404`、网络错误文本）经本函数恒等返回，天然透出。
 */
export function createT(catalog: MessageCatalog, fallback: MessageCatalog = {}): TFunction {
  return (key: string, params?: TParams): string => {
    let text = catalog[key] ?? fallback[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}

/** 从 `_locales` 的 messages.json 原始结构提取纯字典（供运行时加载层使用）。 */
export function extractCatalog(raw: Record<string, { message?: string }>): MessageCatalog {
  const cat: MessageCatalog = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v.message === 'string') cat[k] = v.message;
  }
  return cat;
}
