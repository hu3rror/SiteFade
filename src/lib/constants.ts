/** 全局常量（与各票决议对齐）。 */

/** 手动规则上限（票 06：1000 条）。 */
export const MANUAL_LIMIT = 1000;

/** 规则清单默认每页条数（票 09：默认 10，可调）。 */
export const DEFAULT_PAGE_SIZE = 10;
export const MIN_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 200;

/** 远程源连续失败自动停用阈值（票 07：3 次）。 */
export const MAX_SOURCE_FAILURES = 3;

/** 远程源响应体上限（票 07：2 MB）。 */
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/** 远程源拉取超时（ms）。 */
export const FETCH_TIMEOUT_MS = 30_000;

/** PIN 锁（票 09 修订）：固定 4 位数字、错 5 次锁 30s。 */
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MS = 30_000;

/** alarms 前缀：`refresh:<sourceId>`。 */
export const REFRESH_PREFIX = 'refresh:';

/** 单条规则最大长度（票 05：>2048 无效）。 */
export const MAX_RULE_LENGTH = 2048;
