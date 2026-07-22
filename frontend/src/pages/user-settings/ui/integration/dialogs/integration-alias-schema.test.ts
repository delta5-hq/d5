import { describe, expect, it } from 'vitest'

import { COMMAND_TO_QUERYTYPE_MAP } from '@/shared/lib/command-querytype-mapper'

import {
  integrationAliasSchema,
  legacyReservedIntegrationAliases,
  reservedIntegrationAliases,
} from './integration-alias-schema'

describe('integrationAliasSchema', () => {
  it.each(['/tool', '/Tool', '/tool_1', '/tool-1', '/tool_1-alpha'])('accepts command-safe alias %s', alias => {
    expect(integrationAliasSchema.safeParse(alias).success).toBe(true)
  })

  it.each([
    '',
    '/',
    'tool',
    '/1tool',
    '/_tool',
    '/-tool',
    '/bad alias',
    '/test/nested',
    '/c++',
    '/query?',
    '/query=value',
    '/查询',
  ])('rejects command-unsafe alias %s', alias => {
    expect(integrationAliasSchema.safeParse(alias).success).toBe(false)
  })

  it('reserves every executable built-in command exposed by the command mapper', () => {
    for (const alias of Object.keys(COMMAND_TO_QUERYTYPE_MAP)) {
      expect(reservedIntegrationAliases.has(alias)).toBe(true)
      expect(integrationAliasSchema.safeParse(alias).success).toBe(false)
      expect(integrationAliasSchema.safeParse(alias.toUpperCase()).success).toBe(false)
    }
  })

  it('reserves legacy backend aliases that are intentionally not executable frontend commands', () => {
    for (const alias of legacyReservedIntegrationAliases) {
      expect(COMMAND_TO_QUERYTYPE_MAP[alias]).toBeUndefined()
      expect(reservedIntegrationAliases.has(alias)).toBe(true)
      expect(integrationAliasSchema.safeParse(alias).success).toBe(false)
      expect(integrationAliasSchema.safeParse(alias.toUpperCase()).success).toBe(false)
    }
  })

  it('keeps every reserved alias normalized to the public alias grammar', () => {
    for (const alias of reservedIntegrationAliases) {
      expect(alias).toBe(alias.toLowerCase())
      expect(/^\/[a-z][a-z0-9_-]*$/.test(alias)).toBe(true)
    }
  })
})
