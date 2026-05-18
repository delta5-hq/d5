const SUFFIX_PATTERN =
  /\s*\[[✓✗]\s+(\d+\/\d+\s+(best\s+of\s+\d+(\s+·\s+[\d.]+)?|first-survivor[^\]]*|passed)|refined|refine\s+failed)\]\s*$/i

export const stripReliabilitySuffix = (title: string): string => title.replace(SUFFIX_PATTERN, '')

export const isTitleDerivedFromCommand = (title: string, command: string): boolean =>
  stripReliabilitySuffix(title) === command

export const deriveNodeTitle = (node: { title?: string; command?: string }, nextCommand: string): string => {
  const title = node.title ?? ''
  if (!title || isTitleDerivedFromCommand(title, node.command ?? '')) return nextCommand
  return stripReliabilitySuffix(title)
}
