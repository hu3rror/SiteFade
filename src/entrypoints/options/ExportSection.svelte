<script lang="ts">
  // 导出当前清单（票 09）：全部去重规则（手动优先）下载为 .txt。
  import { t } from '../../lib/i18n.svelte';

  let { allRuleTexts }: { allRuleTexts: string[] } = $props();

  function exportTxt() {
    const content = allRuleTexts.join('\n') + '\n';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitefade-rules-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="sec-title">{t('export_title')}</div>
<div style="display:flex;gap:10px;align-items:center">
  <button class="btn" onclick={exportTxt} disabled={allRuleTexts.length === 0}>{t('export_button')}</button>
  <span class="muted" style="font-size:12px">
    {t('export_hint', { count: allRuleTexts.length.toLocaleString() })}
  </span>
</div>
