import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // WxtVitest() 解析到的 vite 类型是 vitest 自带副本（vite@7），与项目顶层 vite@8 不一致，
  // 类型摩擦仅影响 IDE/check，运行时无碍——这里用 any 消除，避免动依赖版本。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [WxtVitest() as any],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
