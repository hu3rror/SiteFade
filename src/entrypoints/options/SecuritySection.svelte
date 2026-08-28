<script lang="ts">
  // PIN 锁（票 09 交互修订）：固定 4 位，PinPad 填满自动提交。
  // 仅存 SHA-256 哈希，本机；修改与关闭需验证当前 PIN（错 5 次锁 30s）。
  import { onMount } from 'svelte';
  import { isValidPin, hashPin, createPinLock } from '../../lib/pin/pin';
  import { loadPinData, savePinData } from '../../lib/storage/store';
  import { MAX_PIN_ATTEMPTS, PIN_LOCK_MS } from '../../lib/constants';
  import PinPad from './PinPad.svelte';

  let {
    pinEnabled,
    onChanged,
    onToast,
  }: { pinEnabled: boolean; onChanged: () => void; onToast: (msg: string) => void } = $props();

  type Mode = 'idle' | 'set' | 'confirm' | 'verify' | 'change' | 'confirm-change';
  let mode = $state<Mode>('idle');
  let pendingPin = $state('');
  let pendingAction = $state<'change' | 'disable' | null>(null);
  let error = $state('');
  let lockRemaining = $state(0);
  let lock = $state<ReturnType<typeof createPinLock>>();

  let timer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    lock = createPinLock(MAX_PIN_ATTEMPTS, PIN_LOCK_MS);
    timer = setInterval(() => {
      if (lock) lockRemaining = lock.remainingMs();
    }, 500);
    return () => clearInterval(timer);
  });

  function reset() {
    mode = 'idle';
    pendingPin = '';
    pendingAction = null;
    error = '';
  }

  async function persist(hash: string | null, toast: string) {
    await savePinData({ hash });
    onToast(toast);
    reset();
    onChanged();
  }

  // 设置新 PIN：阶段 1（输入）→ 阶段 2（确认）
  function onSet(pin: string) {
    if (!isValidPin(pin)) {
      error = 'PIN 需为 4 位数字';
      return;
    }
    pendingPin = pin;
    error = '';
    mode = 'confirm';
  }
  async function onConfirm(pin: string) {
    if (pin !== pendingPin) {
      error = '两次输入不一致，请重新设置';
      mode = 'set';
      return;
    }
    await persist(await hashPin(pin), '已启用 PIN 锁');
  }

  // 验证当前 PIN（修改 / 关闭前置）
  async function onVerify(pin: string) {
    if (!lock) return;
    const d = await loadPinData();
    if (!d.hash) return;
    const res = await lock.tryUnlock(pin, d.hash);
    if (res === 'ok') {
      error = '';
      if (pendingAction === 'disable') {
        await persist(null, '已关闭 PIN 锁');
      } else {
        pendingPin = '';
        mode = 'change';
      }
      return;
    }
    if (res === 'locked') {
      error = `输错次数过多，请 ${Math.ceil(lock.remainingMs() / 1000)} 秒后再试`;
    } else {
      error = '当前 PIN 不正确';
    }
  }

  // 修改 PIN：阶段 1 → 阶段 2
  function onChange(pin: string) {
    if (!isValidPin(pin)) {
      error = '新 PIN 需为 4 位数字';
      return;
    }
    pendingPin = pin;
    error = '';
    mode = 'confirm-change';
  }
  async function onConfirmChange(pin: string) {
    if (pin !== pendingPin) {
      error = '两次输入不一致，请重新设置';
      mode = 'change';
      return;
    }
    await persist(await hashPin(pin), 'PIN 已修改');
  }

  function handlerFor(m: Mode) {
    switch (m) {
      case 'set': return onSet;
      case 'confirm': return onConfirm;
      case 'verify': return onVerify;
      case 'change': return onChange;
      case 'confirm-change': return onConfirmChange;
      default: return undefined;
    }
  }

  const padTitle = $derived(
    mode === 'verify' ? '验证当前 PIN'
    : mode === 'set' || mode === 'change' ? '设置新 PIN'
    : '确认 PIN',
  );
  const padHint = $derived(
    mode === 'verify' ? '修改或关闭前需要验证'
    : mode === 'set' || mode === 'change' ? '4 位数字'
    : '再次输入以确认',
  );
</script>

<div class="sec-title">设置锁</div>
<p class="muted" style="font-size:12px">
  可选 PIN 保护（4 位数字）。仅存本机 SHA-256 哈希，不存明文、不联网、不同步。
  只锁设置页，工具栏 popup 不受影响。
</p>

{#if mode === 'idle'}
  <div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">
    {#if pinEnabled}
      <span class="badge ok">PIN 锁已启用</span>
      <button class="btn small" onclick={() => { pendingAction = 'change'; error = ''; mode = 'verify'; }}>修改</button>
      <button class="btn small danger" onclick={() => { pendingAction = 'disable'; error = ''; mode = 'verify'; }}>关闭</button>
    {:else}
      <button class="btn" onclick={() => { pendingAction = null; error = ''; mode = 'set'; }}>设置 PIN 锁</button>
      <span class="muted" style="font-size:12px">当前未启用</span>
    {/if}
  </div>
{:else}
  <div style="margin-top:10px">
    <PinPad
      title={padTitle}
      hint={padHint}
      error={error}
      disabled={lockRemaining > 0}
      onComplete={handlerFor(mode) ?? (() => {})}
      onCancel={reset}
    />
    <div class="pin-note">忘记 PIN？从设置页底部的「重置设置」清除（将同时清空本机缓存与远程源）。</div>
  </div>
{/if}
