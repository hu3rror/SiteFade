<script lang="ts">
  // 规则清单（票 09）：搜索 + 分页（默认 10/页可调）+ 手动规则删除/编辑 + 来源标记。
  // 添加入口在「添加规则」区块，此处只做查看与管理。
  import { parseLine } from '../../lib/rules/parser';
  import { loadManualRules, saveManualRules } from '../../lib/storage/store';
  import { genId } from '../../lib/id';
  import { MANUAL_LIMIT } from '../../lib/constants';
  import type { RuleRow } from '../../lib/types';

  let {
    rows,
    pageSize,
    sourceNames,
    manualCount,
    onChanged,
    onToast,
    onPageSizeChange,
  }: {
    rows: RuleRow[];
    pageSize: number;
    sourceNames: Record<string, string>;
    manualCount: number;
    onChanged: () => void;
    onToast: (msg: string) => void;
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
    if (row.sourceRef === 'manual') return '手动';
    const id = row.sourceRef.slice('remote:'.length);
    return sourceNames[id] ? `远程「${sourceNames[id]}」` : '远程';
  }

  async function removeManual(text: string) {
    const rules = await loadManualRules();
    await saveManualRules(rules.filter((r) => r.text !== text));
    onChanged();
  }

  async function saveEdit(oldText: string, newText: string) {
    editing = null;
    const t = newText.trim();
    if (!t || t === oldText) return;
    const p = parseLine(t);
    if (!p || 'error' in p) {
      onToast('规则无效，未修改');
      return;
    }
    const rules = await loadManualRules();
    const others = rules.filter((r) => r.text !== oldText);
    if (others.some((r) => r.text === p.text)) {
      onToast('该规则已存在');
      return;
    }
    if (others.length >= MANUAL_LIMIT) {
      onToast(`手动规则已达上限 ${MANUAL_LIMIT}`);
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
  规则清单
  <span class="muted" style="font-size:12px;font-weight:400">共 {filtered.length.toLocaleString()} 条 · 手动 {manualCount}/{MANUAL_LIMIT}</span>
</div>

<div class="rules-toolbar">
  <input
    class="search"
    type="text"
    placeholder="搜索规则…"
    value={query}
    oninput={(e) => { query = e.currentTarget.value; page = 1; }}
  />
  <select
    class="pagesize"
    aria-label="每页条数"
    value={pageSize}
    onchange={(e) => onPageSizeChange(Number(e.currentTarget.value))}
  >
    {#each [10, 25, 50, 100, 200] as n}
      <option value={n} selected={pageSize === n}>{n} 条/页</option>
    {/each}
  </select>
</div>

<table>
  <thead>
    <tr><th style="width:70px">来源</th><th>规则</th><th style="width:120px"></th></tr>
  </thead>
  <tbody>
    {#each pageRows as row, i (row.text)}
      <tr>
        <td><span class="badge {row.sourceRef === 'manual' ? 'manual' : 'remote'}">{row.sourceRef === 'manual' ? '手动' : '远程'}</span></td>
        <td>
          {#if editing === row.text && row.sourceRef === 'manual'}
            <div style="display:flex;gap:6px">
              <input
                value={editText}
                oninput={(e) => (editText = e.currentTarget.value)}
                onkeydown={(e) => e.key === 'Enter' && saveEdit(row.text, editText)}
              />
              <button class="btn small primary" onclick={() => saveEdit(row.text, editText)}>保存</button>
              <button class="btn small" onclick={() => (editing = null)}>取消</button>
            </div>
          {:else}
            <span class="rule-text">{row.text}</span>
          {/if}
        </td>
        <td>
          {#if row.sourceRef === 'manual'}
            <div class="row-actions">
              <button class="btn small" onclick={() => startEdit(row.text)}>编辑</button>
              <button class="btn small danger" onclick={() => removeManual(row.text)}>删除</button>
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
  <div class="muted" style="text-align:center;padding:14px">没有匹配的规则</div>
{/if}

<div class="pager">
  <button class="btn small" onclick={() => setPage(curPage - 1)} disabled={curPage <= 1}>上一页</button>
  <span class="info">第 {curPage} / {totalPages} 页</span>
  <button class="btn small" onclick={() => setPage(curPage + 1)} disabled={curPage >= totalPages}>下一页</button>
</div>
