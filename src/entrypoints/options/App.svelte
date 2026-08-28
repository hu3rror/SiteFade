<script lang="ts">
  // 设置页（票 09 单列流）：PIN 门 + 统计 + 添加规则（含远程源）/ 规则清单 / 设置锁 / 导出。
  import { onMount } from 'svelte';
  import { collectOverview } from '../../lib/overview';
  import { saveSettings } from '../../lib/storage/store';
  import { resetSettings } from '../../lib/reset';
  import type { Overview } from '../../lib/types';
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
    await saveSettings({ pageSize: n });
    await reload();
  }

  async function doReset() {
    if (resetting || !confirm('重置设置将清除 PIN、本机缓存与全部远程源（手动规则保留）。确定继续？')) return;
    resetting = true;
    try {
      await resetSettings();
      unlocked = true; // PIN 已清，若有锁定状态也解除
      await reload();
      notify('已重置');
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
  <div class="options" style="color:var(--muted);text-align:center">加载中…</div>
{:else if overview.pinEnabled && !unlocked}
  <div class="options">
    <PinGate onUnlock={() => (unlocked = true)} />
  </div>
{:else}
  <div class="options">
    <header class="ohead">
      <div class="logo">SF</div>
      <h1>SiteFade</h1>
      <span class="sub">设置</span>
    </header>

    <div class="stats">
      <div class="stat">
        <div class="label">总规则</div>
        <div class="value">{overview.totalRules.toLocaleString()}</div>
      </div>
      <div class="stat">
        <div class="label">手动（同步）</div>
        <div class="value">
          {overview.manualRules.length}
          <span class="sub">/1000</span>
        </div>
      </div>
      <div class="stat">
        <div class="label">远程源</div>
        <div class="value">{overview.sources.length}<span class="sub"> 台</span></div>
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

    <div class="reset-bar">
      <button class="btn danger" onclick={doReset} disabled={resetting}>重置设置</button>
      <span class="muted" style="font-size:12px">清除 PIN、本机缓存与全部远程源（手动规则保留）</span>
    </div>
  </div>
{/if}

{#if toast}
  <div class="toast">{toast}</div>
{/if}
