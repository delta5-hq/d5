// Suffixes are emitted into node titles which are bilingual (RU/EN). To avoid
// per-locale forks, suffix grammar uses **symbols only** (no translatable words).
// The new reliability subsystem (TODO P0.10) will extend this with structured
// metadata on the cell — frontend renders/translates labels separately from
// the raw symbol marker stored in the title.
//
// Strip pattern is broad on purpose — purges legacy English suffixes
// ("best of N", "first-survivor", "refined", "refine failed") and bare symbol
// suffixes left in user-data titles by previously-deleted mechanisms so
// existing workflows render cleanly when re-executed.
const LEGACY_SUFFIX_PATTERN =
  /\s*\[[✓✗⚠]\s+(\d+\/\d+\s+(best\s+of\s+\d+(\s+·\s+[\d.]+)?|first-survivor[^\]]*|passed)|refined|refine\s+failed)\]\s*$/i

const SYMBOL_SUFFIX_PATTERN = /\s*\[[✓✗⚠]\]\s*$/

export const stripReliabilitySuffix = title => {
  if (!title) return ''
  return title.replace(LEGACY_SUFFIX_PATTERN, '').replace(SYMBOL_SUFFIX_PATTERN, '')
}
