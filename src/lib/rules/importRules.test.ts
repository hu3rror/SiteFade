/**
 * 手动规则导入管线测试（票 05/06）：去重、上限拒绝、摘要。
 */
import { describe, it, expect } from 'vitest';
import { mergeManual } from './importRules';
import { MANUAL_LIMIT } from '../constants';

describe('mergeManual', () => {
  it('并入新规则，返回新增数', () => {
    const res = mergeManual([{ id: 'a', text: 'baidu.com' }], ['foo.com', 'bar.com']);
    expect(res.added).toBe(2);
    expect(res.rules.map((r) => r.text)).toEqual(['baidu.com', 'foo.com', 'bar.com']);
  });

  it('与现网重复 → duplicate 计数', () => {
    const res = mergeManual([{ id: 'a', text: 'baidu.com' }], ['baidu.com', 'foo.com']);
    expect(res.added).toBe(1);
    expect(res.duplicate).toBe(1);
  });

  it('候选内部重复 → duplicate 计数', () => {
    const res = mergeManual([], ['foo.com', 'foo.com']);
    expect(res.added).toBe(1);
    expect(res.duplicate).toBe(1);
  });

  it('超上限 → 整批拒绝 limitHit，不落库', () => {
    const existing = Array.from({ length: MANUAL_LIMIT }, (_, i) => ({ id: `r${i}`, text: `host${i}.com` }));
    const res = mergeManual(existing, ['new1.com', 'new2.com']);
    expect(res.limitHit).toBe(true);
    expect(res.added).toBe(0);
    expect(res.rules).toHaveLength(MANUAL_LIMIT);
  });

  it('临界：并入后恰好达到上限 → 允许', () => {
    const existing = Array.from({ length: MANUAL_LIMIT - 2 }, (_, i) => ({ id: `r${i}`, text: `host${i}.com` }));
    const res = mergeManual(existing, ['a.com', 'b.com']);
    expect(res.limitHit).toBe(false);
    expect(res.added).toBe(2);
    expect(res.rules).toHaveLength(MANUAL_LIMIT);
  });
});
