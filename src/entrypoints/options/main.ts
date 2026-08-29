import { mount } from 'svelte';
import { initUi } from '../../lib/ui';
import { t } from '../../lib/i18n.svelte';
import App from './App.svelte';
import '../../assets/base.css';
import './options.css';

/** 启动前置：initUi 应用主题/界面语言偏好（避免首帧浅色/默认语言闪烁），再挂载。 */
async function boot() {
  await initUi();
  document.title = `SiteFade ${t('options_title')}`;
  return mount(App, {
    target: document.getElementById('app')!,
  });
}

export default boot();
