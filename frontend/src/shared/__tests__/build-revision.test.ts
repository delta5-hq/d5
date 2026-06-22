import { describe, it, expect } from 'vitest'
import { buildRevision } from '../build-revision'

const FORBIDDEN_PLACEHOLDERS = ['0.0.0', '', 'undefined', 'null', '__BUILD_REVISION__']

const VALID_REVISION_FORMATS = [
  /^dev$/,
  /^[0-9a-f]{40}$/,
  /^[0-9a-f]{40}\+[0-9a-f]{40}$/,
  /^[0-9a-f]{40}\+[0-9a-f]{40}\[dirty\]$/,
]

describe('buildRevision — exported constant contract', () => {
  it('is a string', () => {
    expect(typeof buildRevision).toBe('string')
  })

  it('is non-empty', () => {
    expect(buildRevision.length).toBeGreaterThan(0)
  })

  it.each(FORBIDDEN_PLACEHOLDERS)('does not equal forbidden placeholder %j', placeholder => {
    expect(buildRevision).not.toBe(placeholder)
  })
})

describe('buildRevision — format validity (when derived from revision.sh)', () => {
  it('matches at least one valid revision format', () => {
    const matchesAnyFormat = VALID_REVISION_FORMATS.some(re => re.test(buildRevision))
    expect(matchesAnyFormat).toBe(true)
  })

  it('[dirty] suffix, if present, appears exactly once at the end', () => {
    if (buildRevision.includes('[dirty]')) {
      expect(buildRevision).toMatch(/\[dirty\]$/)
      expect(buildRevision.indexOf('[dirty]')).toBe(buildRevision.lastIndexOf('[dirty]'))
    }
  })
})
