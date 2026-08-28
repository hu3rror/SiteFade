<script lang="ts">
  // PIN 输入面板（固定 4 位，票 09 交互修订）：4 个圆点 + 数字键盘，填满自动提交。
  // 内容永不显示明文：隐藏 password 框（键盘输入）+ 圆点渲染。
  import { onMount } from 'svelte';

  let {
    title,
    hint = '',
    error = '',
    disabled = false,
    onComplete,
    onCancel,
  }: {
    title: string;
    hint?: string;
    error?: string;
    disabled?: boolean;
    onComplete: (pin: string) => void;
    onCancel?: () => void;
  } = $props();

  const LEN = 4;

  let pin = $state('');
  let inputEl: HTMLInputElement | undefined = $state();

  const dots = $derived(Array.from({ length: LEN }, (_, i) => i < pin.length));

  onMount(() => {
    inputEl?.focus();
  });

  function submit() {
    if (disabled || pin.length !== LEN) return;
    const value = pin;
    pin = '';
    onComplete(value);
  }

  function press(d: string) {
    if (disabled || pin.length >= LEN) return;
    pin += d;
    inputEl?.focus();
    if (pin.length >= LEN) submit(); // 填满自动提交
  }
  function backspace() {
    if (disabled) return;
    pin = pin.slice(0, -1);
  }
  function clear() {
    if (disabled) return;
    pin = '';
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
</script>

<div class="pinpad">
  <div class="pinpad-head">
    <div class="pinpad-title">{title}</div>
    {#if hint}<div class="pinpad-hint">{hint}</div>{/if}
  </div>

  <div class="pinpad-dots" aria-hidden="true">
    {#each dots as filled, i (i)}
      <span class="pinpad-dot {filled ? 'on' : ''}"></span>
    {/each}
  </div>

  <!-- 隐藏密码框：支持键盘输入；圆点由 state 渲染，绝不显示明文 -->
  <input
    bind:this={inputEl}
    class="pinpad-input"
    type="password"
    inputmode="numeric"
    maxlength={LEN}
    value={pin}
    oninput={(e) => {
      const v = e.currentTarget.value;
      pin = v.replace(/\D/g, '').slice(0, LEN);
      if (pin.length >= LEN) submit();
    }}
    onkeydown={(e) => e.key === 'Enter' && submit()}
    disabled={disabled}
    autocomplete="off"
    aria-label="PIN 输入"
  />

  {#if error || disabled}
    <div class="pinpad-err">{error || (disabled ? '暂时不可输入' : '')}</div>
  {/if}

  <div class="pinpad-keypad">
    {#each keys as k (k)}
      <button class="pinpad-key" onclick={() => press(k)} disabled={disabled}>{k}</button>
    {/each}
    <button class="pinpad-key ghost" onclick={clear} disabled={disabled} title="清除">清除</button>
    <button class="pinpad-key" onclick={() => press('0')} disabled={disabled}>0</button>
    <button class="pinpad-key ghost" onclick={backspace} disabled={disabled} aria-label="退格">⌫</button>
  </div>

  <div class="pinpad-actions">
    <button class="btn" onclick={() => onCancel?.()} disabled={disabled}>取消</button>
    <span class="muted" style="font-size:12px;align-self:center">填满 4 位自动完成</span>
  </div>
</div>
