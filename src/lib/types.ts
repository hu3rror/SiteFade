/**
 * SiteFade 领域类型。词汇以仓库根 CONTEXT.md 为准。
 */

/** 规则来源标记：'manual'（手动）或 `remote:<sourceId>`（远程源）。 */
export type SourceRef = 'manual' | `remote:${string}`;

/**
 * 错误标识（CONTEXT.md「错误标识」）：业务层错误输出用的稳定字典 key 联合类型。
 * 只覆盖「纯 key 字段」实际用到的 key（parser / manage）；
 * 混合字段（key 或原始串，如 FetchOutcome.detail、PopupResponse.error）保持 string。
 */
export type ErrorKey =
  | 'error_badScheme'
  | 'error_hasWhitespace'
  | 'error_httpOnly'
  | 'error_invalidHost'
  | 'error_invalidIpv6'
  | 'error_invalidPort'
  | 'error_invalidPortEntry'
  | 'error_invalidUrl'
  | 'error_missingHost'
  | 'error_tooLong'
  | 'error_urlExists';

/** 手动规则条目（随账号同步）。 */
export interface ManualRule {
  id: string;
  /** 规范化后的规则文本（展示用）。 */
  text: string;
}

/** 远程源失败原因分类。 */
export type SourceErrorKind = 'network' | 'http' | 'parse';

export interface SourceError {
  kind: SourceErrorKind;
  detail: string;
  /** 失败时间（epoch ms）。 */
  at: number;
}

/** 远程源定义（随账号同步；内容仅存本机）。 */
export interface RemoteSource {
  id: string;
  name: string;
  url: string;
  /** 启用开关。被连续失败自动停用后也为 false。 */
  enabled: boolean;
  /** 自动刷新间隔（小时），null = 纯手动刷新。 */
  refreshHours: number | null;
  /** 连续失败次数（只计自动刷新）。 */
  failCount: number;
  /** 连续失败达到上限被自动停用。 */
  disabledByFailures: boolean;
  /** 上次成功拉取时间（epoch ms），从未成功为 null。 */
  lastSuccessAt: number | null;
  lastError: SourceError | null;
}

/** 主题偏好取值（随账号同步；跟随系统时以系统外观为信号源）。 */
export type ThemePref = 'system' | 'light' | 'dark';

/** 支持的界面语言（随账号同步；null = 跟随浏览器语言）。 */
export type UiLang = 'zh_CN' | 'en';

/** 设置（随账号同步；PIN 哈希单独存本机，不在此）。 */
export interface Settings {
  /** 规则清单每页条数。 */
  pageSize: number;
  /** 主题偏好。 */
  theme: ThemePref;
  /** 界面语言偏好，null = 跟随浏览器语言。 */
  language: UiLang | null;
}

/** 本机 PIN 锁数据（只存哈希，不存明文、不同步；固定 4 位）。 */
export interface PinData {
  hash: string | null;
}

/** 远程源内容缓存（storage.local，按源一个 key）。 */
export interface RemoteCache {
  fetchedAt: number;
  /** 规范化后去重的规则文本（与手动规则同规范）。 */
  rules: string[];
}

/** 匹配结果。 */
export interface MatchResult {
  /** 命中的规则文本。 */
  ruleText: string;
  /** 规则来源标记。 */
  source: SourceRef;
}

/** 常驻状态快照（popup 需要）。 */
export interface StatusSnapshot {
  /** 当前 URL 是否命中清单规则。 */
  matched: boolean;
  match: MatchResult | null;
  /** 命中远程源时其名称（供 UI 拼装来源标签；手动命中无此项）。 */
  sourceName?: string;
  /** 规则总条数（手动 + 各远程源去重后）。 */
  totalRules: number;
  manualCount: number;
  remoteCount: number;
  /** history 权限是否可用。 */
  historyPermOk: boolean;
}

/** 设置页初始加载用的全量概览。 */
export interface Overview {
  manualRules: ManualRule[];
  sources: Array<RemoteSource & { ruleCount: number }>;
  settings: Settings;
  pinEnabled: boolean;
  /** 带来源标记的规则行（手动优先、首个引入源记名），供规则表/导出。 */
  ruleRows: RuleRow[];
  /** 全部规则（去重、手动优先）文本，用于导出。 */
  allRuleTexts: string[];
  totalRules: number;
}

/** 规则表的一行：文本 + 来源标记。 */
export interface RuleRow {
  text: string;
  sourceRef: SourceRef;
}
