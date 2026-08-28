/**
 * PIN 锁（票 09 修订）：固定 4 位、仅存 SHA-256 哈希、不存明文、不同步。
 * 纯 TS，可单测。锁定逻辑（错 5 次锁 30s）为会话内纯内存状态。
 */

/** 计算 SHA-256 十六进制摘要。 */
export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  return sha256Hex(pin);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return (await sha256Hex(pin)) === hash.toLowerCase();
}

export interface PinLock {
  /** 当前是否处于锁定状态。 */
  locked(): boolean;
  /** 剩余锁定毫秒数（未锁为 0）。 */
  remainingMs(): number;
  /**
   * 尝试解锁：成功返回 'ok'；锁定中返回 'locked'；密码错返回 'wrong'。
   * 成功清零计数；连续错满 maxAttempts 触发锁定（计数随之清零）。
   */
  tryUnlock(pin: string, hash: string): Promise<'ok' | 'locked' | 'wrong'>;
  reset(): void;
}

export function createPinLock(maxAttempts = 5, lockMs = 30_000): PinLock {
  let attempts = 0;
  let lockedUntil = 0;

  return {
    locked(): boolean {
      return Date.now() < lockedUntil;
    },
    remainingMs(): number {
      return Math.max(0, lockedUntil - Date.now());
    },
    async tryUnlock(pin, hash): Promise<'ok' | 'locked' | 'wrong'> {
      if (Date.now() < lockedUntil) return 'locked';
      const ok = await verifyPin(pin, hash);
      if (ok) {
        attempts = 0;
        return 'ok';
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        attempts = 0;
        lockedUntil = Date.now() + lockMs;
        return 'locked';
      }
      return 'wrong';
    },
    reset(): void {
      attempts = 0;
      lockedUntil = 0;
    },
  };
}
