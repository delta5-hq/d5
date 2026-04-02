import { escapeRegexString } from './escape-regex-string'
import { HASHREF_PREFIX, REF_DEF_PREFIX } from './reference-constants'

function createReferencePattern(prefix: string): string {
  return `${escapeRegexString(prefix)}[\\w-]+`
}

function createWordBoundary(prefix: string): string {
  const WORD_BOUNDARY_CHARS = '\\s,.!?;:\'"(){}<>\\[\\]\\\\/@#$%^&*+=|~`\\-'
  const filtered = Array.from(WORD_BOUNDARY_CHARS).filter(ch => !prefix.includes(ch))
  return `[${filtered.join('')}]`
}

export const referencePatterns = {
  get ref() {
    return new RegExp(createReferencePattern(REF_DEF_PREFIX), 'g')
  },

  get refWholeWord() {
    const pattern = createReferencePattern(REF_DEF_PREFIX)
    const boundary = createWordBoundary(REF_DEF_PREFIX)
    return new RegExp(`(?:^|${boundary})(${pattern})(?:$|${boundary})`)
  },

  get anyWholeWord() {
    const pattern = createReferencePattern(REF_DEF_PREFIX)
    const boundary = createWordBoundary(REF_DEF_PREFIX)
    return new RegExp(`(?:^|${boundary})(${pattern})(?:$|${boundary})`)
  },

  get hashrefs() {
    return new RegExp(createReferencePattern('#_'), 'g')
  },

  get hashrefsWholeWord() {
    const pattern = createReferencePattern('#_')
    const boundary = createWordBoundary('#_')
    return new RegExp(`(?:^|${boundary})(${pattern})(?:$|${boundary})`)
  },

  get wildcardHashref() {
    return new RegExp(`${HASHREF_PREFIX}(\\w*)\\*`)
  },

  get hashrefFirst() {
    return new RegExp(`${HASHREF_PREFIX}(\\w+)${this.firstPostfix}(?![\\w-])`)
  },

  get hashrefLast() {
    return new RegExp(`${HASHREF_PREFIX}(\\w+)${this.lastPostfix}(?![\\w-])`)
  },

  get firstPostfix() {
    return ':first'
  },

  get lastPostfix() {
    return ':last'
  },

  get postfixes(): string[] {
    return [this.firstPostfix, this.lastPostfix]
  },

  withPrefix(prefix: string): RegExp {
    return new RegExp(createReferencePattern(prefix), 'g')
  },

  wholeWordWithPrefix(prefix: string): RegExp {
    const pattern = createReferencePattern(prefix)
    const boundary = createWordBoundary(prefix)
    return new RegExp(`(?:^|${boundary})(${pattern})(?:$|${boundary})`)
  },

  specific(name: string, prefix = REF_DEF_PREFIX): RegExp {
    return new RegExp(`${escapeRegexString(prefix)}${name}`)
  },

  specificWholeWord(name: string, prefix = REF_DEF_PREFIX): RegExp {
    const pattern = `${escapeRegexString(prefix)}${name}`
    const boundary = createWordBoundary(prefix)
    return new RegExp(`(?:^|${boundary})(${pattern})(?:$|${boundary})`)
  },

  withAssignmentPrefix(prefix = REF_DEF_PREFIX, flags = ''): RegExp {
    const firstChar = prefix.charAt(0)
    const patternPrefix = `(?:${escapeRegexString(prefix)}|${escapeRegexString(firstChar)}${escapeRegexString(prefix)})`
    const postfixPattern = `(?::(?:${this.firstPostfix.slice(1)}|${this.lastPostfix.slice(1)})?)?`
    return new RegExp(`${patternPrefix}([\\w\\d_-]+)${postfixPattern}`, flags)
  },

  withPrefixAndPostfixs(prefix: string, postfixes: string | string[] = ''): RegExp {
    const pattern = createReferencePattern(prefix)
    const postfixesExist = Array.isArray(postfixes) ? postfixes.length > 0 : !!postfixes
    const escapedPostfixes = postfixesExist
      ? (Array.isArray(postfixes) ? postfixes : [postfixes])
          .map(p => escapeRegexString(p.startsWith(':') ? p : `:${p}`))
          .filter(Boolean)
          .join('|')
      : ''
    const postfixPattern = escapedPostfixes ? `(?:${escapedPostfixes})?` : ''
    return new RegExp(`${pattern}${postfixPattern}`, 'g')
  },
}
