<script lang="ts">
  // PIN 锁（票 09 交互修订）：固定 4 位，PinPad 填满自动提交。
  // 仅存 SHA-256 哈希，本机；修改与关闭需验证当前 PIN（错 5 次锁 30s）。
  import { onMount } from 'svelte';
  import { isValidPin, hashPin, createPinLock } from '../../lib/pin/pin';
  import { loadPinData, savePinData } from '../../lib/storage/store';
  import { MAX_PIN_ATTEMPTS, PIN_LOCK_MS } from '../../lib/constants';
  import { t } from '../../lib/i18n.svelte';
  import { showToast } from '../../lib/toast.svelte';
  import PinPad from './PinPad.svelte';

  let {
    pinEnabled,
    onChanged,
  }: { pinEnabled: boolean; onChanged: () => void } = $props();

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

  async function persist(hash: string | null, msg: string) {
    await savePinData({ hash });
    showToast(msg);
    reset();
    onChanged();
  }

  // 设置新 PIN：阶段 1（输入）→ 阶段 2（确认）
  function onSet(pin: string) {
    if (!isValidPin(pin)) {
      error = t('security_pinFormat');
      return;
    }
    pendingPin = pin;
    error = '';
    mode = 'confirm';
  }
  async function onConfirm(pin: string) {
    if (pin !== pendingPin) {
      error = t('security_mismatch');
      mode = 'set';
      return;
    }
    await persist(await hashPin(pin), t('security_toastEnabled'));
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
        await persist(null, t('security_toastDisabled'));
      } else {
        pendingPin = '';
        mode = 'change';
      }
      return;
    }
    if (res === 'locked') {
      error = t('security_tooManyTries', { seconds: Math.ceil(lock.remainingMs() / 1000) });
    } else {
      error = t('security_wrongPin');
    }
  }

  // 修改 PIN：阶段 1 → 阶段 2
  function onChange(pin: string) {
    if (!isValidPin(pin)) {
      error = t('security_newPinFormat');
      return;
    }
    pendingPin = pin;
    error = '';
    mode = 'confirm-change';
  }
  async function onConfirmChange(pin: string) {
    if (pin !== pendingPin) {
      error = t('security_mismatch');
      mode = 'change';
      return;
    }
    await persist(await hashPin(pin), t('security_toastChanged'));
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
    mode === 'verify' ? t('security_titleVerify')
    : mode === 'set' || mode === 'change' ? t('security_titleSet')
    : t('security_titleConfirm'),
  );
  const padHint = $derived(
    mode === 'verify' ? t('security_hintVerify')
    : mode === 'set' || mode === 'change' ? t('security_hintDigits')
    : t('security_hintConfirm'),
  );
</script>

<div class="sec-title">{t('security_title')}</div>
<p class="muted" style="font-size:12px">
  {t('security_hint')}
</p>

{#if mode === 'idle'}
  <div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">
    {#if pinEnabled}
      <span class="badge ok">{t('security_enabled')}</span>
      <button class="btn small" onclick={() => { pendingAction = 'change'; error = ''; mode = 'verify'; }}>{t('security_change')}</button>
      <button class="btn small danger" onclick={() => { pendingAction = 'disable'; error = ''; mode = 'verify'; }}>{t('security_disable')}</button>
    {:else}
      <button class="btn" onclick={() => { pendingAction = null; error = ''; mode = 'set'; }}>{t('security_enable')}</button>
      <span class="muted" style="font-size:12px">{t('security_notEnabled')}</span>
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
    <div class="pin-note">{t('security_forgotHint')}</div>
  </div>
{/if}
