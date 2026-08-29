<script lang="ts">
  // PIN 锁定屏（票 09 交互修订）：PinPad 解锁（错 5 次锁 30s）+ 底部「重置设置」。
  import { onMount } from 'svelte';
  import { loadPinData } from '../../lib/storage/store';
  import { createPinLock } from '../../lib/pin/pin';
  import { resetSettings } from '../../lib/reset';
  import { MAX_PIN_ATTEMPTS, PIN_LOCK_MS } from '../../lib/constants';
  import { t } from '../../lib/i18n.svelte';
  import PinPad from './PinPad.svelte';

  let { onUnlock }: { onUnlock: () => void } = $props();

  let error = $state('');
  let lockRemaining = $state(0);
  let lock = $state<ReturnType<typeof createPinLock>>();
  let hash = $state('');
  let resetting = $state(false);

  let timer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    lock = createPinLock(MAX_PIN_ATTEMPTS, PIN_LOCK_MS);
    void loadPinData().then((d) => {
      hash = d.hash ?? '';
    });
    timer = setInterval(() => {
      if (lock) lockRemaining = lock.remainingMs();
    }, 500);
    return () => clearInterval(timer);
  });

  async function tryPin(pin: string) {
    if (!lock || !hash) return;
    const res = await lock.tryUnlock(pin, hash);
    if (res === 'ok') {
      onUnlock();
      return;
    }
    if (res === 'locked') {
      error = t('security.tooManyTries', { seconds: Math.ceil(lock.remainingMs() / 1000) });
    } else {
      error = t('pingate.wrongPin');
    }
  }

  async function doReset() {
    if (resetting || !confirm(t('options.resetConfirm'))) return;
    resetting = true;
    try {
      await resetSettings();
      onUnlock(); // PIN 已清除，直接进入设置页
    } finally {
      resetting = false;
    }
  }
</script>

<div class="lock-screen">
  <div class="lock-box">
    <div class="lock-icon">🔒</div>
    <h2>{t('pingate.locked')}</h2>
    <PinPad
      title={t('pingate.enterPin')}
      hint={t('security.hintDigits')}
      error={error}
      disabled={lockRemaining > 0}
      onComplete={tryPin}
    />
    <button class="btn danger" onclick={doReset} disabled={resetting} style="margin-top:12px">
      {t('options.reset')}
    </button>
    <div class="muted" style="font-size:11px;margin-top:6px">
      {t('pingate.forgotHint')}
    </div>
  </div>
</div>
