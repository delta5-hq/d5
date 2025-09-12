import {HASHREF_PREFIX, REF_DEF_PREFIX} from '../referenceConstants'
import escapeRegexString from '../../../../utils/escapeRegexString'

const escapePattern = escapeRegexString

/**
 * @deprecated Use referencePatterns.withPrefix instead
 * Creates a reference pattern string
 * @param {string} prefix - The prefix to use (defaults to '@')
 * @returns {string} A regex pattern string
 */
export function createReferencePattern(prefix = REF_DEF_PREFIX) {
  const escapedPrefix = escapePattern(prefix)
  return `${escapedPrefix}[\\w-]+`
}

/**
 * Creates a word boundary pattern that excludes specific prefix characters
 * @param {string} prefix - The prefix characters to exclude from word boundaries
 * @returns {string} A regex pattern string for word boundaries
 */
function createWordBoundary(prefix) {
  const WORD_BOUNDARY = '\\s,.!?;:\'"(){}<>\\[\\]\\\\/@#$%^&*+=|~`\\-'
  const filteredBoundaries = Array.from(WORD_BOUNDARY).filter(x => !prefix.includes(x))
  return `[${filteredBoundaries.join('')}]`
}

/**
 * Regular expression patterns for reference handling in the application.
 *
 * This object contains getter methods that return RegExp objects for matching
 * different types of references in text content, plus factory methods for
 * creating custom reference patterns.
 */
export const referencePatterns = {
  /**
   * Matches any reference with the default prefix (@)
   * @returns {RegExp} RegExp that matches any reference
   * @example '@reference' -> matches, '@reference123' -> matches, 'text@reference' -> doesn't match
   */
  get ref() {
    return new RegExp(createReferencePattern(REF_DEF_PREFIX), 'g')
  },

  /**
   * Matches any reference with the default prefix (@) as a whole word
   * @returns {RegExp} RegExp that matches any reference as a whole word
   * @example '@reference' -> matches, '@reference123' -> doesn't match, 'text@reference' -> doesn't match
   */
  get refWholeWord() {
    const pattern = createReferencePattern(REF_DEF_PREFIX)
    const boundary = createWordBoundary(REF_DEF_PREFIX)
    return new RegExp(`(?:^|${boundary})(${pattern})(?:$|${boundary})`)
  },

  /**
   * Matches any reference with the default prefix (@) as a whole word
   * @returns {RegExp} RegExp that matches any reference as a whole word
   * @example '@reference' -> matches, '@reference123' -> doesn't match, 'text@reference' -> doesn't match
   */
  get anyWholeWord() {
    const pattern = createReferencePattern(REF_DEF_PREFIX)
    const boundary = createWordBoundary(REF_DEF_PREFIX)
    return new RegExp(`(?:^|${boundary})(${pattern})(?:$|${boundary})`)
  },

  /**
   * Matches any reference with a hashref prefix (#_)
   * @returns {RegExp} RegExp that matches any hashref reference
   * @example '#_reference' -> matches, '#_tag' -> matches
   */
  get hashrefs() {
    return new RegExp(createReferencePattern('#_'), 'g')
  },

  /**
   * Matches any reference with a hashref prefix (#_) as a whole word
   * @returns {RegExp} RegExp that matches any hashref reference as a whole word
   * @example '#_reference' -> matches, '#_reference123' -> doesn't match
   */
  get hashrefsWholeWord() {
    const pattern = createReferencePattern('#_')
    const boundary = createWordBoundary('#_')
    return new RegExp(`(?:^|${boundary})(${pattern})(?:$|${boundary})`)
  },

  /**
   * Matches any reference with a hashref prefix (#_) followed by a word and ending with an asterisk (*).
   * The reference must be a whole word.
   *
   * @returns {RegExp} A regular expression that matches a hashref reference with the pattern `##_<word>_*`.
   * @example '#_reference_*' -> matches
   * @example '#_reference' -> doesn't match
   */
  get wildcardHashref() {
    const pattern = `${HASHREF_PREFIX}(\\w*)\\*`

    return new RegExp(pattern)
  },

  /**
   * Factory method: Creates a regex for extracting references with a custom prefix
   * @param {string} prefix - The reference prefix character
   * @returns {RegExp} A regex for finding all references with the given prefix
   */
  withPrefix(prefix) {
    return new RegExp(createReferencePattern(prefix), 'g')
  },

  /**
   * Factory method: Creates a regex for extracting references with a custom prefix as whole words
   * @param {string} prefix - The reference prefix character
   * @returns {RegExp} A regex for finding all references with the given prefix as whole words
   */
  wholeWordWithPrefix(prefix) {
    const pattern = createReferencePattern(prefix)
    const boundary = createWordBoundary(prefix)
    return new RegExp(`(?:^|${boundary})(${pattern})(?:$|${boundary})`)
  },

  /**
   * Factory method: Creates a regex for finding a specific reference
   * @param {string} name - The reference name (without prefix)
   * @param {string} prefix - The reference prefix character
   * @returns {RegExp} A regex for finding a specific reference
   */
  specific(name, prefix = REF_DEF_PREFIX) {
    const escapedPrefix = escapePattern(prefix)
    const pattern = `${escapedPrefix}${name}`
    return new RegExp(pattern)
  },

  /**
   * Factory method: Creates a regex for finding a specific reference as a whole word
   * @param {string} name - The reference name (without prefix)
   * @param {string} prefix - The reference prefix character
   * @returns {RegExp} A regex for finding a specific reference as a whole word
   */
  specificWholeWord(name, prefix = REF_DEF_PREFIX) {
    const escapedPrefix = escapePattern(prefix)
    const pattern = `${escapedPrefix}${name}`
    const boundary = createWordBoundary(prefix)
    return new RegExp(`(?:^|${boundary})(${pattern})(?:$|${boundary})`)
  },

  /**
   * Factory method: Creates a regex for matching reference assignments with a customizable prefix
   * @param {string} prefix - The prefix to use (default: '@')
   * @param {string} flags
   * @returns {RegExp} A RegExp for finding reference assignments
   * @example '@reference' -> matches, '@@reference123' -> matches, 'text@reference' -> doesn't match
   */
  withAssignmentPrefix(prefix = REF_DEF_PREFIX, flags = '') {
    const firstChar = prefix.charAt(0)
    const patternPrefix = `(?:${escapePattern(prefix)}|${escapePattern(firstChar)}${escapePattern(prefix)})`
    const postfixPattern = `(?::(?:${this.firstPostfix.slice(1)}|${this.lastPostfix.slice(1)})?)?`
    return new RegExp(`${patternPrefix}([\\w\\d_-]+)${postfixPattern}`, flags)
  },

  get firstPostfix() {
    return ':first'
  },

  get lastPostfix() {
    return ':last'
  },

  get postfixes() {
    return [this.firstPostfix, this.lastPostfix]
  },

  /**
   * Matches any reference with a hashref prefix (#_) ending in `:first`
   *
   * @returns {RegExp} A regex that matches a hashref with a `:first` suffix
   * @example '#_reference:first' -> matches
   */
  get hashrefFirst() {
    const pattern = `${HASHREF_PREFIX}(\\w+)${this.firstPostfix}(?![\\w-])`
    return new RegExp(pattern)
  },

  /**
   * Matches any reference with a hashref prefix (#_) ending in `:last`
   *
   * @returns {RegExp} A regex that matches a hashref with a `:last` suffix
   * @example '#_reference:last' -> matches
   */
  get hashrefLast() {
    const pattern = `${HASHREF_PREFIX}(\\w+)${this.lastPostfix}(?![\\w-])`
    return new RegExp(pattern)
  },

  /**
   * Factory method: Creates a regex for extracting references with a custom prefix and one or more postfixes
   * @param {string} prefix - The reference prefix character
   * @param {string | string[]} postfixs - One or more postfix strings (e.g. ':first', ':last')
   * @returns A RegExp for finding references with the given prefix and one of the postfixes
   * @example withPrefixAndPostfixs('#_', [':first', ':last'])
   */
  withPrefixAndPostfixs(prefix, postfixs = '') {
    const pattern = createReferencePattern(prefix)

    const postfixsExists = !!postfixs || (Array.isArray(postfixs) && postfixs.length)
    const escapedPostfixes = postfixsExists
      ? (Array.isArray(postfixs) ? postfixs : [postfixs])
          .map(p => escapePattern(p.startsWith(':') ? p : `:${p}`))
          .filter(Boolean)
          .join('|')
      : ''

    const postfixPattern = escapedPostfixes ? `(?:${escapedPostfixes})?` : ''

    return new RegExp(`${pattern}${postfixPattern}`, 'g')
  },
}
