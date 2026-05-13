// Suffixes are emitted into node titles which are bilingual (RU/EN). To avoid
// per-locale forks, suffix grammar uses **symbols only** (no translatable words).
// Rich breakdown lives in structured cell metadata; the frontend i18n layer
// renders prose labels separately.
//
// Strip pattern is broad on purpose — purges legacy English suffixes
// ("best of N", "first-survivor", "refined", "refine failed") and bare symbol
// suffixes left in user-data titles by previously-deleted mechanisms so
// existing workflows render cleanly when re-executed.
const LEGACY_SUFFIX_PATTERN =
  /\s*\[[✓✗⚠]\s+(\d+\/\d+\s+(best\s+of\s+\d+(\s+·\s+[\d.]+)?|first-survivor[^\]]*|passed)|refined|refine\s+failed)\]\s*$/i

const SYMBOL_SUFFIX_PATTERN = /\s*\[[✓✗⚠][^\]]*\]\s*$/

const MAX_TITLE_LEN = 80

const clamp = (title, suffix) => {
  const full = `${title.trim()} ${suffix}`.trim()
  if (full.length <= MAX_TITLE_LEN) return full
  const budget = MAX_TITLE_LEN - suffix.length - 1
  return `${title.trim().slice(0, Math.max(0, budget))} ${suffix}`.trim()
}

export const stripReliabilitySuffix = title => {
  if (!title) return ''
  return title.replace(LEGACY_SUFFIX_PATTERN, '').replace(SYMBOL_SUFFIX_PATTERN, '')
}

/**
 * Append a validate-result suffix to a node title.
 * @param {string} title
 * @param {{passed: boolean, retryCount: number}} opts
 */
export const appendValidateSuffix = (title, {passed, retryCount}) => {
  const base = stripReliabilitySuffix(title)
  const suffix = passed ? (retryCount > 0 ? `[✓ retry-${retryCount}]` : '[✓]') : `[✗ ${retryCount} attempts]`
  return clamp(base, suffix)
}

/**
 * Append a refine-result suffix to a node title.
 * @param {string} title
 * @param {{eligible: number, total: number, fallback?: boolean, winnerForkIndex?: number|null}} opts
 */
export const appendRefineSuffix = (title, {eligible, total, fallback = false, winnerForkIndex = null}) => {
  const base = stripReliabilitySuffix(title)
  let suffix
  if (eligible === 0 && fallback && winnerForkIndex !== null) {
    suffix = `[⚠ fallback: 0/${total} passed; chose fork-${winnerForkIndex}]`
  } else if (eligible === 0) {
    suffix = `[✗ 0/${total}]`
  } else if (eligible < total) {
    suffix = `[✓ ${eligible}/${total}]`
  } else {
    suffix = `[✓ ${total}/${total}]`
  }
  return clamp(base, suffix)
}
