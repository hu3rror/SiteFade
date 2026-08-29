<script lang="ts">
  // 设置页（票 09 单列流）：PIN 门 + 统计 + 添加规则（含远程源）/ 规则清单 / 设置锁 / 导出 / 外观。
  import { onMount } from 'svelte';
  import { collectOverview } from '../../lib/overview';
  import { saveSettings } from '../../lib/storage/store';
  import { applyTheme } from '../../lib/theme';
  import { t, initI18n } from '../../lib/i18n.svelte';
  import { resetSettings } from '../../lib/reset';
  import type { Overview, ThemePref, UiLang } from '../../lib/types';
  import PinGate from './PinGate.svelte';
  import ImportSection from './ImportSection.svelte';
  import RulesSection from './RulesSection.svelte';
  import SecuritySection from './SecuritySection.svelte';
  import ExportSection from './ExportSection.svelte';

  let overview = $state<Overview | null>(null);
  let unlocked = $state(false);
  let toast = $state('');
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let resetting = $state(false);

  async function reload() {
    overview = await collectOverview();
  }

  function notify(msg: string) {
    toast = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ''), 3000);
  }

  async function onPageSizeChange(n: number) {
    if (!overview) return;
    await saveSettings({ ...overview.settings, pageSize: n });
    await reload();
  }

  async function onThemeChange(theme: ThemePref) {
    if (!overview) return;
    applyTheme(theme); // 即时生效（跟随系统回到 media query 承载）
    await saveSettings({ ...overview.settings, theme });
    await reload();
  }

  async function onLanguageChange(lang: string | null) {
    if (!overview) return;
    const next: UiLang | null = lang === 'zh_CN' || lang === 'en' ? lang : null;
    await saveSettings({ ...overview.settings, language: next });
    await initI18n(next); // 模块级 $state 更新 → 全树按新语言重渲染
    await reload();
  }

  async function doReset() {
    if (resetting || !confirm(t('options.resetConfirm'))) return;
    resetting = true;
    try {
      await resetSettings();
      unlocked = true; // PIN 已清，若有锁定状态也解除
      await reload();
      notify(t('options.resetDone'));
    } finally {
      resetting = false;
    }
  }

  const sourceNames = $derived(
    Object.fromEntries((overview?.sources ?? []).map((s) => [s.id, s.name])),
  );

  onMount(() => {
    void reload();
  });
</script>

{#if !overview}
  <div class="options" style="color:var(--muted);text-align:center">{t('options.loading')}</div>
{:else if overview.pinEnabled && !unlocked}
  <div class="options">
    <PinGate onUnlock={() => (unlocked = true)} />
  </div>
{:else}
  <div class="options">
    <header class="ohead">
      <div class="logo">SF</div>
      <h1>SiteFade</h1>
      <span class="sub">{t('options.title')}</span>
    </header>

    <div class="stats">
      <div class="stat">
        <div class="label">{t('options.totalRules')}</div>
        <div class="value">{overview.totalRules.toLocaleString()}</div>
      </div>
      <div class="stat">
        <div class="label">{t('options.manualSync')}</div>
        <div class="value">
          {overview.manualRules.length}
          <span class="sub">/1000</span>
        </div>
      </div>
      <div class="stat">
        <div class="label">{t('options.remoteSources')}</div>
        <div class="value">{overview.sources.length}<span class="sub">{t('options.remoteCountSuffix')}</span></div>
      </div>
    </div>

    <section class="card">
      <ImportSection sources={overview.sources} onChanged={reload} onToast={notify} />
    </section>

    <section class="card">
      <RulesSection
        rows={overview.ruleRows}
        pageSize={overview.settings.pageSize}
        sourceNames={sourceNames}
        manualCount={overview.manualRules.length}
        onChanged={reload}
        onToast={notify}
        onPageSizeChange={onPageSizeChange}
      />
    </section>

    <section class="card">
      <SecuritySection pinEnabled={overview.pinEnabled} onChanged={reload} onToast={notify} />
    </section>

    <section class="card">
      <ExportSection allRuleTexts={overview.allRuleTexts} />
    </section>

    <section class="card">
      <div class="sec-title">{t('appearance.title')}</div>
      <div class="appearance-row">
        <span class="appearance-label">{t('appearance.theme')}</span>
        <div class="theme-switch">
          <button
            class="btn small {overview.settings.theme === 'system' ? 'active' : ''}"
            onclick={() => onThemeChange('system')}
          >{t('appearance.themeSystem')}</button>
          <button
            class="btn small {overview.settings.theme === 'light' ? 'active' : ''}"
            onclick={() => onThemeChange('light')}
          >{t('appearance.themeLight')}</button>
          <button
            class="btn small {overview.settings.theme === 'dark' ? 'active' : ''}"
            onclick={() => onThemeChange('dark')}
          >{t('appearance.themeDark')}</button>
        </div>
      </div>
      <div class="appearance-row" style="margin-top:10px">
        <span class="appearance-label">{t('appearance.language')}</span>
        <select
          class="lang-select"
          value={overview.settings.language ?? ''}
          onchange={(e) => onLanguageChange(e.currentTarget.value || null)}
        >
          <option value="">{t('appearance.langFollow')}</option>
          <option value="zh_CN">{t('appearance.langZh')}</option>
          <option value="en">{t('appearance.langEn')}</option>
        </select>
      </div>
      <div class="muted" style="font-size:12px;margin-top:10px">{t('appearance.syncHint')}</div>
    </section>

    <div class="reset-bar">
      <button class="btn danger" onclick={doReset} disabled={resetting}>{t('options.reset')}</button>
      <span class="muted" style="font-size:12px">{t('options.resetHint')}</span>
    </div>
  </div>
{/if}

{#if toast}
  <div class="toast">{toast}</div>
{/if}
