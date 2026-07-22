// Suffix grammar is symbols-only (no translatable words) so titles stay locale-neutral.
// Rich breakdown lives in cell metadata; the frontend i18n layer renders prose labels.

// Purges legacy English suffixes left in persisted titles by the now-deleted reliability
// subsystem so existing workflows render cleanly on re-execution.
const LEGACY_SUFFIX_PATTERN =
  /\s*\[[✓✗⚠]\s+(\d+\/\d+\s+(best\s+of\s+\d+(\s+·\s+[\d.]+)?|first-survivor[^\]]*|passed)|refined|refine\s+failed)\]\s*$/i

// Longest/most-specific entries first to minimise backtracking on ✓-prefixed alternates.
const ENGINE_SUFFIX_SHAPES = [
  '✓ retry-\\d+',
  '✓ \\d+/\\d+',
  '✓',
  '✗ \\d+ attempts',
  '✗ \\d+/\\d+',
  '⚠ no judge signal',
  '⚠ fallback: 0/\\d+ passed; chose fork-\\d+',
]

const ENGINE_SUFFIX_PATTERN = new RegExp(`\\s*\\[(?:${ENGINE_SUFFIX_SHAPES.join('|')})\\]\\s*$`)

const MAX_TITLE_LEN = 80

const clamp = (title, suffix) => {
  const full = `${title.trim()} ${suffix}`.trim()
  if (full.length <= MAX_TITLE_LEN) return full
  const budget = MAX_TITLE_LEN - suffix.length - 1
  return `${title.trim().slice(0, Math.max(0, budget))} ${suffix}`.trim()
}

export const stripReliabilitySuffix = title => {
  if (!title) return ''
  return title.replace(LEGACY_SUFFIX_PATTERN, '').replace(ENGINE_SUFFIX_PATTERN, '')
}

export const appendValidateSuffix = (title, {passed, retryCount}) => {
  const base = stripReliabilitySuffix(title)
  const suffix = passed ? (retryCount > 0 ? `[✓ retry-${retryCount}]` : '[✓]') : `[✗ ${retryCount} attempts]`
  return clamp(base, suffix)
}

export const appendRefineSuffix = (
  title,
  {eligible, total, fallback = false, winnerForkIndex = null, noSignal = false},
) => {
  const base = stripReliabilitySuffix(title)
  let suffix
  if (noSignal) {
    suffix = '[⚠ no judge signal]'
  } else if (eligible === 0 && fallback && winnerForkIndex !== null) {
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
