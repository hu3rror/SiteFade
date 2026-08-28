<script lang="ts">
  // 导出当前清单（票 09）：全部去重规则（手动优先）下载为 .txt。
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

<div class="sec-title">导出</div>
<div style="display:flex;gap:10px;align-items:center">
  <button class="btn" onclick={exportTxt} disabled={allRuleTexts.length === 0}>导出当前清单 .txt</button>
  <span class="muted" style="font-size:12px">
    共 {allRuleTexts.length.toLocaleString()} 条（去重、手动优先）。数据仅存本机；设置页可加 PIN 锁。
  </span>
</div>
