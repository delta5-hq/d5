import { HISTORICAL_SUFFIX_RE, ENGINE_SUFFIX_RE } from './reliability/suffix-grammar'

export const stripReliabilitySuffix = (title: string): string =>
  title.replace(HISTORICAL_SUFFIX_RE, '').replace(ENGINE_SUFFIX_RE, '')

export const isTitleDerivedFromCommand = (title: string, command: string): boolean =>
  stripReliabilitySuffix(title) === command

export const deriveNodeTitle = (node: { title?: string; command?: string }, nextCommand: string): string => {
  const title = node.title ?? ''
  if (!title || isTitleDerivedFromCommand(title, node.command ?? '')) return nextCommand
  return stripReliabilitySuffix(title)
}

export const extractReliabilitySuffix = (title: string): { baseTitle: string; suffix: string | null } => {
  const baseTitle = stripReliabilitySuffix(title)
  if (baseTitle === title) return { baseTitle: title, suffix: null }
  const suffix = title.slice(baseTitle.length).trim()
  return { baseTitle: baseTitle.trimEnd(), suffix: suffix || null }
}

export const attachReliabilitySuffix = (title: string, suffix: string | null): string => {
  const baseTitle = title.trimEnd()
  if (!suffix) return baseTitle
  if (!baseTitle) return suffix
  return `${baseTitle} ${suffix}`
}
