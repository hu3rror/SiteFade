/**
 * 操作提示（票 13 / 架构深化 C2）：设置页瞬时反馈 toast 的模块级状态存储。
 * Svelte 5 runes，模块级 $state——与 i18n.svelte.ts 同一模式：showToast() 写、
 * currentToast() 读，组件模板直接响应式订阅（消息变化自动重渲染）。
 *
 * 内容是调用方按「错误标识」契约翻译后的文本（toast 层不关心 key 还是原始串）；
 * 自动隐藏计时为模块私有，固定 3 秒（无调用方需要自定义时长）。
 * 副作用模块（DOM + timer），不写单测。
 */

let message = $state('');
let timer: ReturnType<typeof setTimeout> | undefined;

/** 当前展示的操作提示文本（空串 = 无提示）。 */
export function currentToast(): string {
  return message;
}

/** 展示一条操作提示；已有提示时重置计时（内容覆盖、3 秒后自动消失）。 */
export function showToast(text: string): void {
  message = text;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => (message = ''), 3000);
}
