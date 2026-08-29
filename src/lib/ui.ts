/**
 * UI 偏好引导（票 12 / 架构深化 C1）：入口挂载前读取设置并按序应用主题偏好、
 * 界面语言与文档语言，保证首帧即呈现正确外观与语言（避免浅色/默认语言闪烁）。
 *
 * 副作用模块（写 DOM），node 测试环境无 DOM，不写单测；纯逻辑（语言归一、
 * html lang 映射）在 i18n.ts / theme.ts 层。mount 与 title 由各入口自行处理
 * （options/popup 的 App 组件与 title 不同，不属于本模块职责）。
 */
import { loadSettings } from './storage/store';
import { applyTheme } from './theme';
import { initI18n, currentLang } from './i18n.svelte';
import { htmlLangFor } from './i18n';
import type { UiLang } from './types';

/** 把当前生效界面语言落到 `<html lang>`（BCP-47 标签）。 */
function applyDocumentLang(): void {
  document.documentElement.lang = htmlLangFor(currentLang());
}

/** 入口启动引导：读偏好 → 应用主题 → 初始化语言 → 设文档语言。 */
export async function initUi(): Promise<void> {
  const settings = await loadSettings();
  applyTheme(settings.theme);
  await initI18n(settings.language);
  applyDocumentLang();
}

/** 切换界面语言偏好：更新运行时语言并同步文档语言（用于设置页变更处理器）。 */
export async function applyUiLanguage(pref: UiLang | null): Promise<void> {
  await initI18n(pref);
  applyDocumentLang();
}
