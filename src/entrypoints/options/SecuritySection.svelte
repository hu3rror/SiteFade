<script lang="ts">
  // PIN 锁（票 09 交互修订）：固定 4 位，PinPad 填满自动提交。
  // 仅存 SHA-256 哈希，本机；修改与关闭需验证当前 PIN（错 5 次锁 30s）。
  import { onMount } from 'svelte';
  import { isValidPin, hashPin, createPinLock } from '../../lib/pin/pin';
  import { loadPinData, savePinData } from '../../lib/storage/store';
  import { MAX_PIN_ATTEMPTS, PIN_LOCK_MS } from '../../lib/constants';
  import { t } from '../../lib/i18n.svelte';
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
      error = t('security.pinFormat');
      return;
    }
    pendingPin = pin;
    error = '';
    mode = 'confirm';
  }
  async function onConfirm(pin: string) {
    if (pin !== pendingPin) {
      error = t('security.mismatch');
      mode = 'set';
      return;
    }
    await persist(await hashPin(pin), t('security.toastEnabled'));
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
        await persist(null, t('security.toastDisabled'));
      } else {
        pendingPin = '';
        mode = 'change';
      }
      return;
    }
    if (res === 'locked') {
      error = t('security.tooManyTries', { seconds: Math.ceil(lock.remainingMs() / 1000) });
    } else {
      error = t('security.wrongPin');
    }
  }

  // 修改 PIN：阶段 1 → 阶段 2
  function onChange(pin: string) {
    if (!isValidPin(pin)) {
      error = t('security.newPinFormat');
      return;
    }
    pendingPin = pin;
    error = '';
    mode = 'confirm-change';
  }
  async function onConfirmChange(pin: string) {
    if (pin !== pendingPin) {
      error = t('security.mismatch');
      mode = 'change';
      return;
    }
    await persist(await hashPin(pin), t('security.toastChanged'));
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
    mode === 'verify' ? t('security.titleVerify')
    : mode === 'set' || mode === 'change' ? t('security.titleSet')
    : t('security.titleConfirm'),
  );
  const padHint = $derived(
    mode === 'verify' ? t('security.hintVerify')
    : mode === 'set' || mode === 'change' ? t('security.hintDigits')
    : t('security.hintConfirm'),
  );
</script>

<div class="sec-title">{t('security.title')}</div>
<p class="muted" style="font-size:12px">
  {t('security.hint')}
</p>

{#if mode === 'idle'}
  <div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">
    {#if pinEnabled}
      <span class="badge ok">{t('security.enabled')}</span>
      <button class="btn small" onclick={() => { pendingAction = 'change'; error = ''; mode = 'verify'; }}>{t('security.change')}</button>
      <button class="btn small danger" onclick={() => { pendingAction = 'disable'; error = ''; mode = 'verify'; }}>{t('security.disable')}</button>
    {:else}
      <button class="btn" onclick={() => { pendingAction = null; error = ''; mode = 'set'; }}>{t('security.enable')}</button>
      <span class="muted" style="font-size:12px">{t('security.notEnabled')}</span>
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
    <div class="pin-note">{t('security.forgotHint')}</div>
  </div>
{/if}
