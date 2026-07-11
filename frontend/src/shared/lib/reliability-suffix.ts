// Purges legacy English suffixes ("best of N", "first-survivor", "refined",
// "refine failed") that may still exist in persisted node titles from the
// now-deleted reliability subsystem, so existing workflows render cleanly.
const LEGACY_SUFFIX_RE =
  /\s*\[[✓✗]\s+(\d+\/\d+\s+(best\s+of\s+\d+(\s+·\s+[\d.]+)?|first-survivor[^\]]*|passed)|refined|refine\s+failed)\]\s*$/i

// Deliberately tight — only exact known shapes are stripped so user-authored
// brackets containing ✓/✗/⚠ (e.g. "[✓ approved by manager]") are preserved.
const ENGINE_SUFFIX_RE =
  /\s*\[(?:✓(?:\s+(?:retry-\d+|\d+\/\d+))?|✗\s+(?:\d+\/\d+|\d+\s+attempts)|⚠\s+(?:no\s+judge\s+signal|fallback:\s+0\/\d+\s+passed;\s+chose\s+fork-\d+))\]\s*$/

export const stripReliabilitySuffix = (title: string): string =>
  title.replace(LEGACY_SUFFIX_RE, '').replace(ENGINE_SUFFIX_RE, '')

export const isTitleDerivedFromCommand = (title: string, command: string): boolean =>
  stripReliabilitySuffix(title) === command

export const deriveNodeTitle = (node: { title?: string; command?: string }, nextCommand: string): string => {
  const title = node.title ?? ''
  if (!title || isTitleDerivedFromCommand(title, node.command ?? '')) return nextCommand
  return stripReliabilitySuffix(title)
}
