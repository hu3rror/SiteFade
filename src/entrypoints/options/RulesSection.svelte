<script lang="ts">
  // 规则清单（票 09）：搜索 + 分页（默认 10/页可调）+ 手动规则删除/编辑 + 来源标记。
  // 添加入口在「添加规则」区块，此处只做查看与管理。
  import { parseLine } from '../../lib/rules/parser';
  import { loadManualRules, saveManualRules } from '../../lib/storage/store';
  import { genId } from '../../lib/id';
  import { MANUAL_LIMIT } from '../../lib/constants';
  import { t } from '../../lib/i18n.svelte';
  import { showToast } from '../../lib/toast.svelte';
  import type { RuleRow } from '../../lib/types';

  let {
    rows,
    pageSize,
    sourceNames,
    manualCount,
    onChanged,
    onPageSizeChange,
  }: {
    rows: RuleRow[];
    pageSize: number;
    sourceNames: Record<string, string>;
    manualCount: number;
    onChanged: () => void;
    onPageSizeChange: (n: number) => void;
  } = $props();

  let query = $state('');
  let page = $state(1);

  const filtered = $derived(
    query.trim() ? rows.filter((r) => r.text.includes(query.trim().toLowerCase())) : rows,
  );
  const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)));
  // 钳制当前页（筛选/改页大小后可能越界）
  const curPage = $derived(Math.min(page, totalPages));
  const pageRows = $derived(filtered.slice((curPage - 1) * pageSize, curPage * pageSize));

  function setPage(p: number) {
    page = Math.min(Math.max(1, p), totalPages);
  }

  function sourceLabel(row: RuleRow): string {
    if (row.sourceRef === 'manual') return t('common_manual');
    const id = row.sourceRef.slice('remote:'.length);
    return sourceNames[id] ? t('common_sourceRemote', { name: sourceNames[id] }) : t('common_remote');
  }

  async function removeManual(text: string) {
    const rules = await loadManualRules();
    await saveManualRules(rules.filter((r) => r.text !== text));
    onChanged();
  }

  async function saveEdit(oldText: string, newText: string) {
    editing = null;
    const candidate = newText.trim();
    if (!candidate || candidate === oldText) return;
    const p = parseLine(candidate);
    if (!p || 'error' in p) {
      showToast(t('rules_toastInvalid'));
      return;
    }
    const rules = await loadManualRules();
    const others = rules.filter((r) => r.text !== oldText);
    if (others.some((r) => r.text === p.text)) {
      showToast(t('rules_toastExists'));
      return;
    }
    if (others.length >= MANUAL_LIMIT) {
      showToast(t('rules_toastLimit', { limit: MANUAL_LIMIT }));
      return;
    }
    await saveManualRules([...others, { id: genId(), text: p.text }]);
    onChanged();
  }

  let editing = $state<string | null>(null);
  let editText = $state('');

  function startEdit(text: string) {
    editing = text;
    editText = text;
  }
</script>

<div class="sec-title">
  {t('rules_title')}
  <span class="muted" style="font-size:12px;font-weight:400">{t('rules_meta', { count: filtered.length.toLocaleString(), manual: manualCount, limit: MANUAL_LIMIT })}</span>
</div>

<div class="rules-toolbar">
  <input
    class="search"
    type="text"
    placeholder={t('rules_search')}
    value={query}
    oninput={(e) => { query = e.currentTarget.value; page = 1; }}
  />
  <select
    class="pagesize"
    aria-label={t('rules_perPageAria')}
    value={pageSize}
    onchange={(e) => onPageSizeChange(Number(e.currentTarget.value))}
  >
    {#each [10, 25, 50, 100, 200] as n}
      <option value={n} selected={pageSize === n}>{t('rules_perPage', { n })}</option>
    {/each}
  </select>
</div>

<table>
  <thead>
    <tr><th style="width:70px">{t('rules_colSource')}</th><th>{t('rules_colRule')}</th><th style="width:120px"></th></tr>
  </thead>
  <tbody>
    {#each pageRows as row, i (row.text)}
      <tr>
        <td><span class="badge {row.sourceRef === 'manual' ? 'manual' : 'remote'}">{row.sourceRef === 'manual' ? t('common_manual') : t('common_remote')}</span></td>
        <td>
          {#if editing === row.text && row.sourceRef === 'manual'}
            <div style="display:flex;gap:6px">
              <input
                value={editText}
                oninput={(e) => (editText = e.currentTarget.value)}
                onkeydown={(e) => e.key === 'Enter' && saveEdit(row.text, editText)}
              />
              <button class="btn small primary" onclick={() => saveEdit(row.text, editText)}>{t('common_save')}</button>
              <button class="btn small" onclick={() => (editing = null)}>{t('common_cancel')}</button>
            </div>
          {:else}
            <span class="rule-text">{row.text}</span>
          {/if}
        </td>
        <td>
          {#if row.sourceRef === 'manual'}
            <div class="row-actions">
              <button class="btn small" onclick={() => startEdit(row.text)}>{t('common_edit')}</button>
              <button class="btn small danger" onclick={() => removeManual(row.text)}>{t('common_delete')}</button>
            </div>
          {:else}
            <span class="muted" style="font-size:11px">{sourceLabel(row)}</span>
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>

{#if filtered.length === 0}
  <div class="muted" style="text-align:center;padding:14px">{t('rules_noMatch')}</div>
{/if}

<div class="pager">
  <button class="btn small" onclick={() => setPage(curPage - 1)} disabled={curPage <= 1}>{t('rules_prev')}</button>
  <span class="info">{t('rules_pageInfo', { cur: curPage, total: totalPages })}</span>
  <button class="btn small" onclick={() => setPage(curPage + 1)} disabled={curPage >= totalPages}>{t('rules_next')}</button>
</div>
