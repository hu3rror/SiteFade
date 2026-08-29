/**
 * 主题应用（票 11）：把主题偏好落到 documentElement 的 data-theme。
 * 「跟随系统」由 CSS `@media (prefers-color-scheme)` 原生承载（不设 data-theme，
 * OS 外观切换即时生效、免 JS 监听）；手动浅色/深色写 data-theme 强制覆盖系统外观。
 */
import type { ThemePref } from './types';

export function applyTheme(pref: ThemePref): void {
  const el = document.documentElement;
  if (pref === 'system') delete el.dataset.theme;
  else el.dataset.theme = pref;
}
