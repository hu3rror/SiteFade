/**
 * i18n 纯逻辑测试（票 11）：语言归一、消息字典、占位符替换、字典提取。
 * 纯 TS 无浏览器依赖；运行时加载层（fetch）不在本套件内。
 */
import { describe, it, expect } from 'vitest';
import { createT, resolveLang, isSupportedLang, extractCatalog, DEFAULT_LANG, type MessageCatalog } from './i18n';

const zh: MessageCatalog = { hello: '你好', greet: '你好，{name}！', count: '共 {n} 条', onlyZh: '只在中文' };
const en: MessageCatalog = { hello: 'Hello', greet: 'Hello, {name}!', count: '{n} total' };

describe('createT', () => {
  it('命中词条 + 占位符替换', () => {
    const t = createT(zh);
    expect(t('greet', { name: '世界' })).toBe('你好，世界！');
    expect(t('count', { n: 42 })).toBe('共 42 条');
  });

  it('缺 key → 回退字典 → 仍缺则原样返回 key', () => {
    const t = createT(en, zh);
    expect(t('hello')).toBe('Hello');
    expect(t('onlyZh')).toBe('只在中文'); // 英文缺词条 → 回退中文基线
    expect(t('missing')).toBe('missing'); // 两份都没有 → 返回 key 本身
  });

  it('非 key 原始串恒等返回（原生错误文本透出）', () => {
    const t = createT(zh);
    expect(t('HTTP 404')).toBe('HTTP 404');
    expect(t('Failed to fetch')).toBe('Failed to fetch');
  });

  it('数值占位符与字符串占位符同工', () => {
    const t = createT(en);
    expect(t('count', { n: 'many' })).toBe('many total');
  });

  it('无占位符词条带多余参数不受影响', () => {
    const t = createT(zh);
    expect(t('hello', { name: 'x' })).toBe('你好');
  });
});

describe('resolveLang', () => {
  it('zh 前缀 → zh_CN', () => {
    expect(resolveLang('zh-CN')).toBe('zh_CN');
    expect(resolveLang('zh')).toBe('zh_CN');
    expect(resolveLang('zh-TW')).toBe('zh_CN');
  });

  it('en 前缀 → en', () => {
    expect(resolveLang('en')).toBe('en');
    expect(resolveLang('en-US')).toBe('en');
    expect(resolveLang('EN')).toBe('en');
  });

  it('其余语言/空 → 回退中文基线', () => {
    expect(resolveLang('ja')).toBe('zh_CN');
    expect(resolveLang('fr-FR')).toBe('zh_CN');
    expect(resolveLang(null)).toBe('zh_CN');
    expect(resolveLang(undefined)).toBe('zh_CN');
    expect(resolveLang('')).toBe('zh_CN');
  });

  it('基线默认语言为中文', () => {
    expect(DEFAULT_LANG).toBe('zh_CN');
  });
});

describe('isSupportedLang', () => {
  it('仅接受 zh_CN / en', () => {
    expect(isSupportedLang('zh_CN')).toBe(true);
    expect(isSupportedLang('en')).toBe(true);
    expect(isSupportedLang('zh')).toBe(false);
    expect(isSupportedLang('ja')).toBe(false);
    expect(isSupportedLang(null)).toBe(false);
    expect(isSupportedLang(undefined)).toBe(false);
  });
});

describe('extractCatalog', () => {
  it('从 messages.json 原始结构提取纯字典', () => {
    const raw = { a: { message: '甲' }, b: { message: '乙' }, c: {} };
    expect(extractCatalog(raw as never)).toEqual({ a: '甲', b: '乙' });
  });
});
