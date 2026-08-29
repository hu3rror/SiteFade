import { mount } from 'svelte';
import { loadSettings } from '../../lib/storage/store';
import { applyTheme } from '../../lib/theme';
import { initI18n, currentLang } from '../../lib/i18n.svelte';
import App from './App.svelte';
import '../../assets/base.css';
import './popup.css';

/** 启动前置：先应用主题偏好与界面语言，再挂载（避免首帧浅色/默认语言闪烁）。 */
async function boot() {
  const settings = await loadSettings();
  applyTheme(settings.theme);
  await initI18n(settings.language);
  document.documentElement.lang = currentLang() === 'zh_CN' ? 'zh-CN' : 'en';
  return mount(App, {
    target: document.getElementById('app')!,
  });
}

export default boot();
