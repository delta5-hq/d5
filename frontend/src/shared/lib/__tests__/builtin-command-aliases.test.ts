import { describe, expect, it } from 'vitest'
import { BUILTIN_COMMAND_ALIASES, BUILTIN_COMMANDS } from '../builtin-command-aliases'

const ALIAS_FORMAT = /^\/[a-z][a-z0-9_-]*$/
const QUERY_TYPE_FORMAT = /^[a-z][a-z0-9_-]*$/

describe('BUILTIN_COMMANDS — per-entry structural invariants', () => {
  it.each(BUILTIN_COMMANDS)('$alias has valid slash-lowercase format', ({ alias }) => {
    expect(ALIAS_FORMAT.test(alias)).toBe(true)
  })

  it.each(BUILTIN_COMMANDS)('$alias queryType matches token format', ({ queryType }) => {
    expect(QUERY_TYPE_FORMAT.test(queryType)).toBe(true)
  })

  it.each(BUILTIN_COMMANDS)('$alias has non-blank description', ({ description }) => {
    expect(description.trim().length).toBeGreaterThan(0)
  })

  it.each(BUILTIN_COMMANDS)('$alias description has no leading or trailing whitespace', ({ description }) => {
    expect(description).toBe(description.trim())
  })
})

describe('BUILTIN_COMMANDS — global structural invariants', () => {
  it('contains at least one command', () => {
    expect(BUILTIN_COMMANDS.length).toBeGreaterThan(0)
  })

  it('all aliases are unique', () => {
    const seen = new Set<string>()
    for (const { alias } of BUILTIN_COMMANDS) {
      expect(seen, `duplicate alias: ${alias}`).not.toContain(alias)
      seen.add(alias)
    }
  })

  it('all descriptions are unique', () => {
    const seen = new Map<string, string>()
    for (const { alias, description } of BUILTIN_COMMANDS) {
      const firstAlias = seen.get(description)
      expect(firstAlias, `"${description}" is shared by "${firstAlias}" and "${alias}"`).toBeUndefined()
      seen.set(description, alias)
    }
  })
})

describe('BUILTIN_COMMAND_ALIASES — derived export correctness', () => {
  it('mirrors BUILTIN_COMMANDS aliases in insertion order', () => {
    expect([...BUILTIN_COMMAND_ALIASES]).toEqual(BUILTIN_COMMANDS.map(c => c.alias))
  })
})
