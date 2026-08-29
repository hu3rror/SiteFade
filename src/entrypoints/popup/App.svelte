<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import { sendPopupMessage } from '../../lib/messaging';
  import { t } from '../../lib/i18n.svelte';
  import type { StatusSnapshot } from '../../lib/types';

  let status = $state<StatusSnapshot | null>(null);
  let currentUrl = $state('');
  let currentHost = $state('');
  let busy = $state(false);
  let toast = $state('');

  onMount(async () => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      currentUrl = tab?.url ?? '';
      try {
        currentHost = new URL(currentUrl).hostname;
      } catch {
        currentHost = '';
      }
    } catch {
      currentUrl = '';
    }
    await refresh();
  });

  async function refresh() {
    const res = await sendPopupMessage({ type: 'status', url: currentUrl });
    if (!res.ok) {
      status = null;
      toast = t('popup.queryFailed');
      return;
    }
    status = res.status ?? null;
  }

  async function toggle() {
    if (!status || busy) return;
    busy = true;
    toast = '';
    try {
      if (!status.matched) {
        const res = await sendPopupMessage({ type: 'addHost', host: currentUrl });
        if (res.action === 'limit') toast = t('popup.limitReached', { limit: res.limit ?? 1000 });
        else if (res.action === 'added') toast = t('popup.added');
        else if (res.action === 'exists') toast = t('popup.exists');
        else toast = t(res.error ?? 'popup.failed');
      } else if (status.match?.source === 'manual') {
        const res = await sendPopupMessage({ type: 'removeManual', text: status.match.ruleText });
        toast = res.action === 'removed' ? t('popup.removed') : t(res.error ?? 'popup.failed');
      }
      await refresh();
    } finally {
      busy = false;
    }
  }

  async function openSettings() {
    try {
      await browser.runtime.openOptionsPage();
    } catch {
      window.close();
    }
  }

  const notMatched = $derived(status ? !status.matched : false);
  const matchedRemote = $derived(status ? !!status.match && status.match.source !== 'manual' : false);
  // 来源标签在 UI 层拼装（背景只给结构化 source + sourceName，票 11）
  const sourceLabel = $derived(
    status?.match
      ? status.match.source === 'manual'
        ? t('common.manual')
        : t('common.sourceRemote', { name: status.sourceName ?? status.match.source })
      : '',
  );
</script>

<div class="popup">
  {#if status && !status.historyPermOk}
    <div class="banner">
      {t('popup.permissionBanner')}
    </div>
  {/if}

  <div class="body">
    <div class="site-card">
      <div class="host">{currentHost || t('popup.noHost')}</div>
      <div class="state">
        {#if status?.matched}
          <span class="state-ok">{t('popup.matched')}</span>
        {:else}
          <span class="state-muted">{t('popup.unmatched')}</span>
        {/if}
      </div>
      {#if status?.matched}
        <div class="match-line muted">
          {t('popup.matchedLine', { rule: status.match!.ruleText, source: sourceLabel })}
        </div>
      {:else}
        <div class="match-line muted">{t('popup.unmatchedLine')}</div>
      {/if}

      <div class="actions">
        {#if status?.matched && matchedRemote}
          <button class="btn" disabled title={t('popup.remoteRuleTitle')}>
            {t('popup.restoreRecord')}
          </button>
          <div class="muted note-small">{t('popup.remoteNote')}</div>
        {:else}
          <button class="btn {notMatched ? 'primary' : ''}" style="min-width:176px" onclick={toggle} disabled={busy || !status}>
            {notMatched ? t('popup.skipRecord') : t('popup.restoreRecord')}
          </button>
        {/if}
      </div>
    </div>

    {#if toast}
      <div class="toast">{toast}</div>
    {/if}

    <div class="counts muted">
      <span>{t('popup.totalRules', { count: status?.totalRules?.toLocaleString() ?? '—' })}</span>
      <span>{t('popup.manualRemote', { m: status?.manualCount ?? '—', r: status?.remoteCount ?? '—' })}</span>
    </div>
  </div>

  <div class="foot">
    <span class="muted">SiteFade</span>
    <span class="foot-actions">
      <button class="btn small primary" onclick={openSettings}>{t('common.openSettings')}</button>
    </span>
  </div>
</div>
