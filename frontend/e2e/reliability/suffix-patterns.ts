export const COMPLETION_SUFFIX_RE = /\[(?:✓|✗)[^\]]*\]/
export const COMMODITY_FULL_SUCCESS_SUFFIX_RE = (n: number): RegExp => new RegExp(`\\[↻ ${n}\\/${n}\\]`)
export const COMMODITY_OUTCOME_SUFFIX_RE = /\[↻ (\d+)\/(\d+)(?: ⚠)?\]/
export const VALIDATE_VERDICT_RE = /\[(?:✓|✗)\]/
export const VALIDATE_FAIL_RE = /\[✗\]/
export const ELECT_FALLBACK_SUFFIX_RE = /\[⚠ 0\/\d+\]/
