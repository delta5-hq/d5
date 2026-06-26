import { describe, it, expect } from 'vitest'
import { buildVersion } from '../build-version'

const FORBIDDEN_PLACEHOLDERS = ['0.0.0', '', 'undefined', 'null', '__BUILD_VERSION__']

const VALID_VERSION_FORMATS = [
  /^dev$/,
  /^[0-9a-f]{40}$/,
  /^[0-9a-f]{40}\+[0-9a-f]{40}$/,
  /^[0-9a-f]{40}\+[0-9a-f]{40}\[dirty\]$/,
]

describe('buildVersion — exported constant contract', () => {
  it('is a string', () => {
    expect(typeof buildVersion).toBe('string')
  })

  it('is non-empty', () => {
    expect(buildVersion).not.toBe('')
  })

  it.each(FORBIDDEN_PLACEHOLDERS)('does not equal forbidden placeholder %j', placeholder => {
    expect(buildVersion).not.toBe(placeholder)
  })
})

describe('buildVersion — format validity (when derived from version.sh)', () => {
  it('matches at least one valid version format', () => {
    const matchesAnyFormat = VALID_VERSION_FORMATS.some(re => re.test(buildVersion))
    expect(matchesAnyFormat).toBe(true)
  })

  it('[dirty] suffix, if present, appears exactly once at the end', () => {
    if (buildVersion.includes('[dirty]')) {
      expect(buildVersion).toMatch(/\[dirty\]$/)
      expect(buildVersion.indexOf('[dirty]')).toBe(buildVersion.lastIndexOf('[dirty]'))
    }
  })
})
