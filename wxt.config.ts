import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  outDir: 'dist',
  manifest: ({ browser: target }) => {
    const base = {
      name: 'SiteFade',
      description: '访问清单内站点后立即从浏览历史中删除其访问记录。',
      permissions: ['history', 'storage', 'alarms', 'activeTab'],
      // 远程源按源运行时授权（票 04）：声明覆盖 pattern，运行时只请求具体 origin。
      // 不产生安装警告；Firefox 128+ 亦支持 optional_host_permissions。
      optional_host_permissions: ['https://*/*', 'http://*/*'],
    };
    if (target === 'firefox') {
      // Firefox MV3 强制要求 add-on ID 与 data_collection_permissions（web-ext lint）。
      return {
        ...base,
        browser_specific_settings: {
          gecko: {
            id: 'sitefade@sitefade.dev',
            data_collection_permissions: { required: ['none'] },
          },
        },
      };
    }
    return base;
  },
});
