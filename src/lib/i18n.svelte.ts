/**
 * 界面语言运行时存储（Svelte 5 runes，模块级 $state）。
 * popup 与设置页共用；组件模板里直接调 t()，语言切换后自动重渲染。
 * 字典从 `_locales/<lang>/messages.json` 运行时拉取（同一 JSON 也喂 manifest __MSG_）。
 */
import { browser } from 'wxt/browser';
import {
  createT,
  resolveLang,
  extractCatalog,
  DEFAULT_LANG,
  type MessageCatalog,
  type TFunction,
  type TParams,
} from './i18n';
import type { UiLang } from './types';

let lang: UiLang = $state(DEFAULT_LANG);
let catalog: MessageCatalog = $state({});
/** 中文基线字典：界面语言缺词条时回退中文（票 02：中文为完整基线）。 */
let zhCatalog: MessageCatalog = $state({});

/** 当前界面语言。 */
export function currentLang(): UiLang {
  return lang;
}

/** 翻译当前语言下的词条（缺 key 回退中文基线；非 key 原样返回）。 */
export const t: TFunction = (key: string, params?: TParams): string => {
  return createT(catalog, zhCatalog)(key, params);
};

async function loadDict(next: UiLang): Promise<MessageCatalog> {
  try {
    const url = browser.runtime.getURL(`_locales/${next}/messages.json` as never);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`i18n load failed: ${res.status}`);
    const raw = (await res.json()) as Record<string, { message?: string }>;
    return extractCatalog(raw);
  } catch {
    return {};
  }
}

/**
 * 初始化/切换语言：界面语言偏好（settings.language）优先，否则跟随浏览器语言。
 * 中文基线始终加载（非中文界面缺词条时回退中文）；拉取失败保持空字典，不阻断界面。
 */
export async function initI18n(pref: string | null | undefined): Promise<void> {
  const browserLang =
    typeof browser.i18n?.getUILanguage === 'function' ? browser.i18n.getUILanguage() : '';
  const next: UiLang = pref === 'zh_CN' || pref === 'en' ? pref : resolveLang(browserLang);
  lang = next;
  const zh = await loadDict('zh_CN');
  zhCatalog = zh;
  catalog = next === 'zh_CN' ? zh : await loadDict(next);
}
