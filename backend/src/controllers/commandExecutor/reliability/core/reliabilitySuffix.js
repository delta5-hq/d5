// Suffixes are emitted into node titles which are bilingual (RU/EN). To avoid
// per-locale forks, suffix grammar uses **symbols only** (no translatable words).
// The new reliability subsystem (TODO P0.4) will extend this with structured
// metadata on the cell — frontend renders/translates labels separately from
// the raw symbol marker stored in the title.
//
// Strip pattern is broad on purpose — purges legacy English suffixes
// ("best of N", "first-survivor", "refined", "refine failed") emitted by the
// deleted reliability subsystem so existing workflows render cleanly.
const LEGACY_SUFFIX_PATTERN =
  /\s*\[[✓✗⚠]\s+(\d+\/\d+\s+(best\s+of\s+\d+(\s+·\s+[\d.]+)?|first-survivor[^\]]*|passed)|refined|refine\s+failed)\]\s*$/i

const SYMBOL_SUFFIX_PATTERN = /\s*\[[✓✗⚠]\]\s*$/

export const stripReliabilitySuffix = title => {
  if (!title) return ''
  return title.replace(LEGACY_SUFFIX_PATTERN, '').replace(SYMBOL_SUFFIX_PATTERN, '')
}

// Locale-neutral. Context (parent command type) carries the meaning.
export const REFINED_SUFFIX = '[✓]'
export const REFINE_FAILURE_SUFFIX = '[✗]'
