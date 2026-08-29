<script lang="ts">
  // 添加规则（票 05/07/09 交互修订）：手动添加（粘贴/文件）+ 远程源（URL 清单）合一，
  // 避免过多入口造成选择困难。远程 URL 入口即「添加远程源」。
  import { importManualRules } from '../../lib/rules/importRules';
  import type { ManualImportResult } from '../../lib/rules/importRules';
  import { addSource, updateSource, removeSource, defaultSourceName, grantOrigin } from '../../lib/sources/manage';
  import { refreshSource } from '../../lib/sources/refresh';
  import type { FetchOutcome } from '../../lib/sources/fetcher';
  import { FAILURE_LABEL } from '../../lib/sources/sources';
  import { t } from '../../lib/i18n.svelte';
  import type { RemoteSource } from '../../lib/types';

  let {
    sources,
    onChanged,
    onToast,
  }: {
    sources: Array<RemoteSource & { ruleCount: number }>;
    onChanged: () => void;
    onToast: (msg: string) => void;
  } = $props();

  // ---- 手动添加 ----
  let text = $state('');
  let busy = $state(false);
  let summary = $state<ManualImportResult | null>(null);
  let showDetail = $state(false);

  async function doImport() {
    if (!text.trim() || busy) return;
    busy = true;
    try {
      const res = await importManualRules(text);
      summary = res;
      if (res.limitHit) {
        onToast(t('import_toastLimit'));
      } else if (res.added > 0) {
        onToast(t('import_toastAdded', { count: res.added }));
      }
      text = '';
      onChanged();
    } finally {
      busy = false;
    }
  }

  async function pickFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.list,.conf,text/plain';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const content = await f.text();
      text = content;
      await doImport();
    };
    input.click();
  }

  // ---- 远程源 ----
  let showAdd = $state(false);
  let newName = $state('');
  let newUrl = $state('');
  let adding = $state(false);
  let refreshingId = $state<string | null>(null);

  function fmtTime(ms: number | null): string {
    if (!ms) return t('time_never');
    const diff = Date.now() - ms;
    const min = Math.floor(diff / 60_000);
    if (min < 1) return t('time_justNow');
    if (min < 60) return t('time_minutesAgo', { n: min });
    const h = Math.floor(min / 60);
    if (h < 24) return t('time_hoursAgo', { n: h });
    return t('time_daysAgo', { n: Math.floor(h / 24) });
  }

  function statusDot(s: RemoteSource): string {
    if (!s.enabled) return 'off';
    if (s.disabledByFailures) return 'danger';
    if (s.lastError) return 'warn';
    return 'ok';
  }

  /** 错误标签/明细均可能是错误 key 或原始串：t() 对 key 翻译、对原始串恒等透出。 */
  function failText(detail: string | undefined): string {
    return detail ? ` — ${t(detail)}` : '';
  }

  /** 刷新结果 → toast：成功 / 失败分类 + 明细（成功或失败均可能无 outcome）。 */
  function toastRefreshOutcome(outcome: FetchOutcome | null) {
    if (outcome?.ok) {
      onToast(t('import_toastRefreshOk'));
    } else if (outcome) {
      const label = FAILURE_LABEL[outcome.kind as keyof typeof FAILURE_LABEL];
      onToast(
        t('import_toastRefreshFail', {
          label: t(label),
          detail: t(outcome.detail ?? ''),
        }),
      );
    }
  }

  async function refresh(id: string) {
    if (refreshingId) return;
    refreshingId = id;
    try {
      const res = await refreshSource(id, { isAuto: false });
      toastRefreshOutcome(res.outcome);
      onChanged();
    } finally {
      refreshingId = null;
    }
  }

  // 授权并重试：在点击手势内同步发起授权（grantOrigin 先于任何 await 调 request），成功后再刷新。
  async function grantAndRefresh(s: RemoteSource & { ruleCount: number }) {
    if (refreshingId) return;
    const granted = await grantOrigin(s.url); // 必须是点击处理器里第一个异步调用
    if (!granted) {
      onToast(t('import_toastGrantDenied'));
      return;
    }
    onToast(t('import_toastGranted'));
    refreshingId = s.id;
    try {
      const res = await refreshSource(s.id, { isAuto: false });
      toastRefreshOutcome(res.outcome);
      onChanged();
    } finally {
      refreshingId = null;
    }
  }

  async function toggle(id: string, enabled: boolean) {
    await updateSource(id, { enabled });
    onChanged();
  }

  async function changeInterval(id: string, value: string) {
    const refreshHours = value ? Number(value) : null;
    await updateSource(id, { refreshHours });
    onChanged();
  }

  async function remove(id: string, name: string) {
    if (!confirm(t('common_confirmRemoveSource', { name }))) return;
    await removeSource(id);
    onChanged();
  }

  async function doAdd() {
    if (!newUrl.trim() || adding) return;
    adding = true;
    try {
      const res = await addSource(newUrl.trim(), newName.trim() || defaultSourceName(newUrl.trim()));
      if (!res.ok) {
        onToast(t(res.error ?? 'import_toastAddFail'));
      } else {
        onToast(res.outcome?.ok ? t('import_toastAddOk') : t('import_toastAddFirstFail', { detail: t(res.outcome?.detail ?? '') }));
        newName = '';
        newUrl = '';
        showAdd = false;
      }
      onChanged();
    } finally {
      adding = false;
    }
  }
</script>

<div class="sec-title">{t('import_title')}</div>

<p class="muted" style="font-size:12px">{t('import_hint')}</p>
<textarea
  rows="3"
  placeholder={t('import_pastePlaceholder')}
  value={text}
  oninput={(e) => (text = e.currentTarget.value)}
></textarea>
<div class="import-actions">
  <button class="btn primary" onclick={doImport} disabled={busy || !text.trim()}>{t('import_add')}</button>
  <button class="btn" onclick={pickFile} disabled={busy}>{t('import_localFile')}</button>
</div>

{#if summary}
  <div class="import-summary">
    {#if summary.limitHit}
      <span class="badge danger">{t('import_summaryLimit')}</span>
    {:else}
      <span class="badge ok">{t('import_added', { count: summary.added })}</span>
      <span class="badge">{t('import_duplicate', { count: summary.duplicate })}</span>
    {/if}
    {#if summary.invalid > 0}
      <span class="badge danger">
        {t('import_invalid', { count: summary.invalid })}
        <button class="btn-link" onclick={() => (showDetail = !showDetail)}>{showDetail ? t('import_collapse') : t('import_detail')}</button>
      </span>
    {/if}
    <span class="muted">{t('import_manualTotal', { total: summary.total })}</span>
  </div>
  {#if showDetail && summary.invalidDetail.length}
    <div class="invalid-detail">
      {#each summary.invalidDetail as d}
        <div class="row"><span class="reason">{t(d.reason)}</span><span class="line">{d.line}</span></div>
      {/each}
    </div>
  {/if}
{/if}

<div class="sec-title sub">
  {t('import_remoteTitle')}
  <span class="muted" style="font-size:12px;font-weight:400">{t('import_remoteHint')}</span>
</div>

{#each sources as s (s.id)}
  <div class="source-row">
    <span class="dot {statusDot(s)}" title={statusDot(s)}></span>
    <div class="source-main">
      <div class="source-name">
        {s.name}
        {#if !s.enabled}
          <span class="badge off">{t('import_disabled')}</span>
        {/if}
        {#if s.disabledByFailures}
          <span class="badge danger">{t('import_failedRepeatedly')}</span>
        {/if}
      </div>
      <div class="source-meta">
        {t('import_metaLine', { count: s.ruleCount, time: fmtTime(s.lastSuccessAt) })}
        {#if s.refreshHours}<span>{t('import_autoRefresh', { hours: s.refreshHours })}</span>{/if}
      </div>
      <div class="source-meta">{s.url}</div>
      {#if s.lastError}
        <div class="source-err">{t(FAILURE_LABEL[s.lastError.kind])}{failText(s.lastError.detail)}</div>
      {/if}
    </div>
    <div class="source-ops">
      <label class="muted" style="font-size:12px">
        <input type="checkbox" checked={s.enabled} onchange={(e) => toggle(s.id, e.currentTarget.checked)} />
        {t('common_enable')}
      </label>
      <select
        aria-label={t('import_intervalAria')}
        value={s.refreshHours ?? ''}
        onchange={(e) => changeInterval(s.id, e.currentTarget.value)}
      >
        <option value="">{t('common_manual')}</option>
        <option value="1">1h</option>
        <option value="6">6h</option>
        <option value="12">12h</option>
        <option value="24">24h</option>
      </select>
      {#if s.lastError?.kind === 'network'}
        <button class="btn small" onclick={() => grantAndRefresh(s)} disabled={refreshingId !== null}>
          {t('import_grantRetry')}
        </button>
      {/if}
      <button class="btn small" onclick={() => refresh(s.id)} disabled={refreshingId !== null}>
        {refreshingId === s.id ? t('import_refreshing') : t('common_refresh')}
      </button>
      <button class="btn small danger" onclick={() => remove(s.id, s.name)}>{t('common_delete')}</button>
    </div>
  </div>
{/each}

{#if sources.length === 0}
  <div class="muted" style="text-align:center;padding:12px">{t('import_noSources')}</div>
{/if}

{#if showAdd}
  <div class="add-source">
    <input type="text" placeholder={t('import_namePlaceholder')} value={newName} oninput={(e) => (newName = e.currentTarget.value)} />
    <input
      type="url"
      placeholder={t('import_urlPlaceholder')}
      value={newUrl}
      oninput={(e) => (newUrl = e.currentTarget.value)}
      onkeydown={(e) => e.key === 'Enter' && doAdd()}
    />
    <button class="btn primary" onclick={doAdd} disabled={adding || !newUrl.trim()}>{t('import_addAndFetch')}</button>
    <button class="btn" onclick={() => (showAdd = false)}>{t('common_cancel')}</button>
  </div>
{:else}
  <button class="btn" onclick={() => (showAdd = true)}>{t('import_addSource')}</button>
{/if}
