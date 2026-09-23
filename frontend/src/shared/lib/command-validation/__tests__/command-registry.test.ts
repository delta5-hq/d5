import { describe, it, expect } from 'vitest'
import { isValidCommand, getAllCommands, D5_COMMANDS } from '../command-registry'
import { COMMAND_TO_QUERYTYPE_MAP } from '../../command-querytype-mapper'
import { BUILTIN_COMMAND_ALIASES } from '../../builtin-command-aliases'

describe('isValidCommand', () => {
  it.each([...BUILTIN_COMMAND_ALIASES])('accepts registered command %s', cmd => {
    expect(isValidCommand(cmd)).toBe(true)
  })

  it.each([...BUILTIN_COMMAND_ALIASES])('rejects uppercase variant of %s', cmd => {
    expect(isValidCommand(cmd.toUpperCase())).toBe(false)
  })

  it('rejects an unregistered slash command', () => {
    expect(isValidCommand('/unknown')).toBe(false)
  })

  it('rejects a command missing the slash prefix', () => {
    expect(isValidCommand('chatgpt')).toBe(false)
  })

  it('rejects slash alone', () => {
    expect(isValidCommand('/')).toBe(false)
  })

  it('rejects command with appended prompt text', () => {
    expect(isValidCommand('/chat hello')).toBe(false)
  })

  it('rejects command with leading whitespace', () => {
    expect(isValidCommand(' /chat')).toBe(false)
  })

  it('rejects command with trailing whitespace', () => {
    expect(isValidCommand('/chat ')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidCommand('')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(isValidCommand('/CHATGPT')).toBe(false)
    expect(isValidCommand('/ChatGPT')).toBe(false)
  })
})

describe('getAllCommands', () => {
  it('returns every registered command', () => {
    const all = getAllCommands()
    for (const alias of BUILTIN_COMMAND_ALIASES) {
      expect(all).toContain(alias)
    }
  })

  it('returns exactly the registered command count', () => {
    expect(getAllCommands().length).toBe(BUILTIN_COMMAND_ALIASES.length)
  })

  it('returns aliases in BUILTIN_COMMAND_ALIASES insertion order', () => {
    expect([...getAllCommands()]).toEqual([...BUILTIN_COMMAND_ALIASES])
  })

  it('returns the same reference on repeated calls', () => {
    expect(getAllCommands()).toBe(getAllCommands())
  })

  it('contains no duplicate aliases', () => {
    const all = [...getAllCommands()]
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('registry synchronization with COMMAND_TO_QUERYTYPE_MAP', () => {
  it('D5_COMMANDS contains every key from COMMAND_TO_QUERYTYPE_MAP', () => {
    const mapKeys = Object.keys(COMMAND_TO_QUERYTYPE_MAP)
    mapKeys.forEach(key => {
      expect(D5_COMMANDS, `D5_COMMANDS should include ${key}`).toContain(key)
    })
  })

  it('length matches COMMAND_TO_QUERYTYPE_MAP key count', () => {
    expect(getAllCommands().length).toBe(Object.keys(COMMAND_TO_QUERYTYPE_MAP).length)
  })

  it('isValidCommand returns true for every key in COMMAND_TO_QUERYTYPE_MAP', () => {
    for (const cmd of Object.keys(COMMAND_TO_QUERYTYPE_MAP)) {
      expect(isValidCommand(cmd), `${cmd} should be valid`).toBe(true)
    }
  })

  it('exact match only — rejects command strings with trailing text', () => {
    expect(isValidCommand('/chatgpt hello')).toBe(false)
    expect(isValidCommand('/web search query')).toBe(false)
    expect(isValidCommand('/validate some criterion')).toBe(false)
  })

  it('rejects unknown commands', () => {
    expect(isValidCommand('/notregistered')).toBe(false)
    expect(isValidCommand('/CHATGPT')).toBe(false)
  })
})
