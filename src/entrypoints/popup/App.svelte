<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import { sendPopupMessage } from '../../lib/messaging';
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
      toast = res.error ?? '查询失败';
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
        if (res.action === 'limit') toast = `手动规则已达上限 ${res.limit ?? 1000}`;
        else if (res.action === 'added') toast = '已设为不记入历史';
        else if (res.action === 'exists') toast = '已在清单中';
        else toast = res.error ?? '操作失败';
      } else if (status.match?.source === 'manual') {
        const res = await sendPopupMessage({ type: 'removeManual', text: status.match.ruleText });
        toast = res.action === 'removed' ? '已恢复记入历史' : res.error ?? '操作失败';
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
</script>

<div class="popup">
  {#if status && !status.historyPermOk}
    <div class="banner">
      历史记录权限已关闭，自动移除已停止。请到浏览器扩展权限设置中开启「历史记录」权限。
    </div>
  {/if}

  <div class="body">
    <div class="site-card">
      <div class="host">{currentHost || '（无法读取当前站点）'}</div>
      <div class="state">
        {#if status?.matched}
          <span class="state-ok">不记入历史</span>
        {:else}
          <span class="state-muted">会记入历史</span>
        {/if}
      </div>
      {#if status?.matched}
        <div class="match-line muted">
          命中规则 <code>{status.match!.ruleText}</code> · {status.matchLabel ?? status.match!.source}
        </div>
      {:else}
        <div class="match-line muted">未设为不记入历史 · 此站会正常留在浏览历史里</div>
      {/if}

      <div class="actions">
        {#if status?.matched && matchedRemote}
          <button class="btn" disabled title="该规则来自远程源，请在设置页管理">
            恢复记入历史
          </button>
          <div class="muted note-small">命中远程源规则，请在设置页管理</div>
        {:else}
          <button class="btn {notMatched ? 'primary' : ''}" style="min-width:176px" onclick={toggle} disabled={busy || !status}>
            {notMatched ? '设为不记入历史' : '恢复记入历史'}
          </button>
        {/if}
      </div>
    </div>

    {#if toast}
      <div class="toast">{toast}</div>
    {/if}

    <div class="counts muted">
      <span>规则共 {status?.totalRules?.toLocaleString() ?? '—'} 条</span>
      <span>手动 {status?.manualCount ?? '—'} · 远程 {status?.remoteCount ?? '—'}</span>
    </div>
  </div>

  <div class="foot">
    <span class="muted">SiteFade</span>
    <span class="foot-actions">
      <button class="btn small primary" onclick={openSettings}>打开设置</button>
    </span>
  </div>
</div>
