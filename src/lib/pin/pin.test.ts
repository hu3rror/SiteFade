/**
 * PIN 锁测试（票 09）：SHA-256 哈希、4–6 位校验、错 5 次锁 30s。
 */
import { describe, it, expect } from 'vitest';
import { sha256Hex, isValidPin, hashPin, verifyPin, createPinLock } from './pin';

describe('sha256Hex / hashPin / verifyPin', () => {
  it('SHA-256 已知向量', async () => {
    // "1234" 的 SHA-256
    expect(await sha256Hex('1234')).toBe('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');
  });

  it('hashPin → verifyPin 往返', async () => {
    const h = await hashPin('246810');
    expect(await verifyPin('246810', h)).toBe(true);
    expect(await verifyPin('246811', h)).toBe(false);
  });

  it('verifyPin 对哈希大小写不敏感', async () => {
    const h = (await hashPin('123456')).toUpperCase();
    expect(await verifyPin('123456', h)).toBe(true);
  });
});

describe('isValidPin', () => {
  it('恰好 4 位纯数字（固定 4 位）', () => {
    expect(isValidPin('1234')).toBe(true);
  });
  it('拒绝非 4 位与非数字', () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('123456')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });
});

describe('createPinLock', () => {
  it('正确 PIN 解锁并清零计数', async () => {
    const lock = createPinLock();
    expect(await lock.tryUnlock('0000', await hashPin('0000'))).toBe('ok');
    expect(lock.locked()).toBe(false);
  });

  it('错误 5 次触发 30s 锁定', async () => {
    const lock = createPinLock(5, 30_000);
    const h = await hashPin('0000');
    for (let i = 0; i < 4; i++) expect(await lock.tryUnlock('1111', h)).toBe('wrong');
    expect(lock.locked()).toBe(false);
    expect(await lock.tryUnlock('1111', h)).toBe('locked'); // 第 5 次触发
    expect(lock.locked()).toBe(true);
    expect(lock.remainingMs()).toBeGreaterThan(0);
    expect(lock.remainingMs()).toBeLessThanOrEqual(30_000);
    // 锁定期间即使输入正确也拒绝
    expect(await lock.tryUnlock('0000', h)).toBe('locked');
  });

  it('失败计数只在锁定后清零（reset 手动清除）', async () => {
    const lock = createPinLock(5, 30_000);
    const h = await hashPin('0000');
    await lock.tryUnlock('1111', h);
    expect(lock.locked()).toBe(false);
    lock.reset();
    expect(lock.locked()).toBe(false);
    expect(lock.remainingMs()).toBe(0);
  });
});
