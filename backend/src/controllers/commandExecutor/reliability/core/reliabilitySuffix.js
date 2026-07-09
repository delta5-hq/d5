import {HISTORICAL_SUFFIX_RE, ENGINE_SUFFIX_RE} from './suffixGrammar'

const MAX_TITLE_LEN = 80

const clamp = (base, suffix) => {
  const full = `${base.trim()} ${suffix}`.trim()
  if (full.length <= MAX_TITLE_LEN) return full
  const budget = MAX_TITLE_LEN - suffix.length - 1
  return `${base.trim().slice(0, Math.max(0, budget))} ${suffix}`.trim()
}

export const stripReliabilitySuffix = title => {
  if (!title) return ''
  return title.replace(HISTORICAL_SUFFIX_RE, '').replace(ENGINE_SUFFIX_RE, '')
}

export const appendValidateSuffix = (title, {passed, retryCount}) => {
  const base = stripReliabilitySuffix(title)
  const suffix = passed ? (retryCount > 0 ? `[✓ +${retryCount}]` : '[✓]') : `[✗ ${retryCount}×]`
  return clamp(base, suffix)
}

export const appendInvalidSuffix = title => clamp(stripReliabilitySuffix(title), '[✗ !]')

export const appendCommoditySuffix = (title, {successCount, total}) => {
  const base = stripReliabilitySuffix(title)
  const partial = successCount > 0 && successCount < total
  const suffix =
    successCount === 0 ? `[✗ 0/${total}]` : partial ? `[✓ ${successCount}/${total} ⚠]` : `[✓ ${successCount}/${total}]`
  return clamp(base, suffix)
}

// noSignal warns only in strict mode: fallback mode opts into degraded selection,
// making the eligible-fraction suffix the correct signal when primary forks passed.
// ⚠ trails ✓/✗ so pass/fail outcome and judge-quality signal remain orthogonal.
const selectRefineSuffix = ({eligible, total, fallback, winnerForkIndex, noSignal, degradedInput}) => {
  if (eligible === 0 && fallback && winnerForkIndex !== null) return `[⚠ 0/${total}]`
  if (noSignal && !fallback) return '[⚠ ∅]'
  if (eligible === 0) return `[✗ 0/${total}]`
  return `[✓ ${eligible}/${total}${degradedInput ? ' ⚠' : ''}]`
}

export const appendRefineSuffix = (
  title,
  {eligible, total, fallback = false, winnerForkIndex = null, noSignal = false, degradedInput = false},
) =>
  clamp(
    stripReliabilitySuffix(title),
    selectRefineSuffix({
      eligible,
      total,
      fallback,
      winnerForkIndex,
      noSignal,
      degradedInput,
    }),
  )
