<script lang="ts">
  // 添加规则（票 05/07/09 交互修订）：手动添加（粘贴/文件）+ 远程源（URL 清单）合一，
  // 避免过多入口造成选择困难。远程 URL 入口即「添加远程源」。
  import { importManualRules } from '../../lib/rules/importRules';
  import type { ManualImportResult } from '../../lib/rules/importRules';
  import { addSource, updateSource, removeSource, defaultSourceName, grantOrigin } from '../../lib/sources/manage';
  import { refreshSource } from '../../lib/sources/refresh';
  import { FAILURE_LABEL } from '../../lib/sources/sources';
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
        onToast('手动规则已达上限 1000，请清理或改用远程源');
      } else if (res.added > 0) {
        onToast(`新增 ${res.added} 条`);
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
    if (!ms) return '从未成功';
    const diff = Date.now() - ms;
    const min = Math.floor(diff / 60_000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min} 分钟前`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} 小时前`;
    return `${Math.floor(h / 24)} 天前`;
  }

  function statusDot(s: RemoteSource): string {
    if (!s.enabled) return 'off';
    if (s.disabledByFailures) return 'danger';
    if (s.lastError) return 'warn';
    return 'ok';
  }

  async function refresh(id: string) {
    if (refreshingId) return;
    refreshingId = id;
    try {
      const res = await refreshSource(id, { isAuto: false });
      if (res.outcome?.ok) {
        onToast('刷新成功');
      } else if (res.outcome) {
        const label = FAILURE_LABEL[res.outcome.kind as keyof typeof FAILURE_LABEL];
        onToast(`刷新失败（${label}${res.outcome.detail ? `：${res.outcome.detail}` : ''}）`);
      }
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
      onToast('授权被拒绝，无法访问该来源');
      return;
    }
    onToast('已授权，正在重试…');
    refreshingId = s.id;
    try {
      const res = await refreshSource(s.id, { isAuto: false });
      if (res.outcome?.ok) onToast('刷新成功');
      else if (res.outcome) {
        const label = FAILURE_LABEL[res.outcome.kind as keyof typeof FAILURE_LABEL];
        onToast(`刷新失败（${label}${res.outcome.detail ? `：${res.outcome.detail}` : ''}）`);
      }
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
    if (!confirm(`删除远程源「${name}」？其本地缓存的规则也会一并移除。`)) return;
    await removeSource(id);
    onChanged();
  }

  async function doAdd() {
    if (!newUrl.trim() || adding) return;
    adding = true;
    try {
      const res = await addSource(newUrl.trim(), newName.trim() || defaultSourceName(newUrl.trim()));
      if (!res.ok) {
        onToast(res.error ?? '添加失败');
      } else {
        onToast(res.outcome?.ok ? '已添加并拉取成功' : `已添加（首拉失败：${res.outcome?.detail ?? ''}）`);
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

<div class="sec-title">添加规则</div>

<p class="muted" style="font-size:12px">手动输入或从文件批量添加；或从远程 URL 拉取清单</p>
<textarea
  rows="3"
  placeholder="粘贴：每行一条规则（支持注释 #、通配符 *. +. .、IP、端口、精确 URL）"
  value={text}
  oninput={(e) => (text = e.currentTarget.value)}
></textarea>
<div class="import-actions">
  <button class="btn primary" onclick={doImport} disabled={busy || !text.trim()}>添加</button>
  <button class="btn" onclick={pickFile} disabled={busy}>本地文件</button>
</div>

{#if summary}
  <div class="import-summary">
    {#if summary.limitHit}
      <span class="badge danger">超出手动上限，未新增</span>
    {:else}
      <span class="badge ok">新增 {summary.added}</span>
      <span class="badge">重复 {summary.duplicate}</span>
    {/if}
    {#if summary.invalid > 0}
      <span class="badge danger">
        无效 {summary.invalid}
        <button class="btn-link" onclick={() => (showDetail = !showDetail)}>{showDetail ? '收起' : '明细'}</button>
      </span>
    {/if}
    <span class="muted">手动规则 {summary.total}/1000</span>
  </div>
  {#if showDetail && summary.invalidDetail.length}
    <div class="invalid-detail">
      {#each summary.invalidDetail as d}
        <div class="row"><span class="reason">{d.reason}</span><span class="line">{d.line}</span></div>
      {/each}
    </div>
  {/if}
{/if}

<div class="sec-title sub">
  远程源
  <span class="muted" style="font-size:12px;font-weight:400">内容仅存本机，不随账号同步；手动刷新或按间隔自动刷新</span>
</div>

{#each sources as s (s.id)}
  <div class="source-row">
    <span class="dot {statusDot(s)}" title={statusDot(s)}></span>
    <div class="source-main">
      <div class="source-name">
        {s.name}
        {#if !s.enabled}
          <span class="badge off">已停用</span>
        {/if}
        {#if s.disabledByFailures}
          <span class="badge danger">连续失败</span>
        {/if}
      </div>
      <div class="source-meta">
        {s.ruleCount} 条 · 上次成功 {fmtTime(s.lastSuccessAt)}
        {#if s.refreshHours}<span>· 每 {s.refreshHours}h 自动刷新</span>{/if}
      </div>
      <div class="source-meta">{s.url}</div>
      {#if s.lastError}
        <div class="source-err">{FAILURE_LABEL[s.lastError.kind]}{s.lastError.detail ? `：${s.lastError.detail}` : ''}</div>
      {/if}
    </div>
    <div class="source-ops">
      <label class="muted" style="font-size:12px">
        <input type="checkbox" checked={s.enabled} onchange={(e) => toggle(s.id, e.currentTarget.checked)} />
        启用
      </label>
      <select
        aria-label="自动刷新间隔"
        value={s.refreshHours ?? ''}
        onchange={(e) => changeInterval(s.id, e.currentTarget.value)}
      >
        <option value="">手动</option>
        <option value="1">1h</option>
        <option value="6">6h</option>
        <option value="12">12h</option>
        <option value="24">24h</option>
      </select>
      {#if s.lastError?.kind === 'network'}
        <button class="btn small" onclick={() => grantAndRefresh(s)} disabled={refreshingId !== null}>
          授权并重试
        </button>
      {/if}
      <button class="btn small" onclick={() => refresh(s.id)} disabled={refreshingId !== null}>
        {refreshingId === s.id ? '刷新中…' : '刷新'}
      </button>
      <button class="btn small danger" onclick={() => remove(s.id, s.name)}>删除</button>
    </div>
  </div>
{/each}

{#if sources.length === 0}
  <div class="muted" style="text-align:center;padding:12px">尚未添加远程源</div>
{/if}

{#if showAdd}
  <div class="add-source">
    <input type="text" placeholder="名称（默认取主机名）" value={newName} oninput={(e) => (newName = e.currentTarget.value)} />
    <input
      type="url"
      placeholder="https://…（每行一条的纯文本清单）"
      value={newUrl}
      oninput={(e) => (newUrl = e.currentTarget.value)}
      onkeydown={(e) => e.key === 'Enter' && doAdd()}
    />
    <button class="btn primary" onclick={doAdd} disabled={adding || !newUrl.trim()}>添加并拉取</button>
    <button class="btn" onclick={() => (showAdd = false)}>取消</button>
  </div>
{:else}
  <button class="btn" onclick={() => (showAdd = true)}>+ 添加远程源</button>
{/if}
