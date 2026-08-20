// Historical patterns cover every suffix shape the engine ever emitted before the current
// locale-neutral symbol grammar. Matched case-insensitively so legacy English words are
// stripped regardless of capitalisation. Longest/most-specific alternates precede shorter
// prefix-sharing ones so the regex engine commits to the right branch without backtracking.
export const HISTORICAL_SUFFIX_SHAPES: readonly string[] = Object.freeze([
  '[✓✗⚠]\\s+(\\d+\\/\\d+\\s+(best\\s+of\\s+\\d+(\\s+·\\s+[\\d.]+)?|first-survivor[^\\]]*|passed)|refined|refine\\s+failed)',
  '✓\\s+retry-\\d+',
  '✗\\s+\\d+\\s+attempts',
  '✗\\s+invalid',
  '⚠\\s+no\\s+judge\\s+signal',
  '⚠\\s+fallback:\\s+0\\/\\d+\\s+passed;\\s+chose\\s+fork-\\d+',
])

// Every shape the suffix-appender functions emit must appear here so re-execution strips the prior suffix.
export const ENGINE_SUFFIX_SHAPES: readonly string[] = Object.freeze([
  '✓ \\d+/\\d+ ⚠',
  '✓ \\d+/\\d+',
  '✓ \\+\\d+',
  '✓',
  '✗ 0/\\d+',
  '✗ \\d+×',
  '✗ ⊘',
  '✗ !',
  '⚠ ∅',
  '⚠ 0/\\d+',
])

export const HISTORICAL_SUFFIX_RE: RegExp = new RegExp(
  `\\s*\\[(?:${HISTORICAL_SUFFIX_SHAPES.map(s => `(?:${s})`).join('|')})\\]\\s*$`,
  'i',
)

export const ENGINE_SUFFIX_RE: RegExp = new RegExp(`\\s*\\[(?:${ENGINE_SUFFIX_SHAPES.join('|')})\\]\\s*$`)
