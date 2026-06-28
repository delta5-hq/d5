import { describe, it, expect } from 'vitest'
import { isValidCommand, getAllCommands } from '../command-registry'
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

  it('rejects mixed-case (title-case) variant of a registered command', () => {
    const titleCased = BUILTIN_COMMAND_ALIASES.map(cmd => cmd[0] + cmd[1].toUpperCase() + cmd.slice(2))
    for (const variant of titleCased) {
      expect(isValidCommand(variant), `${variant} should be rejected`).toBe(false)
    }
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

  it('returns the same content on repeated calls', () => {
    expect([...getAllCommands()]).toEqual([...getAllCommands()])
  })

  it('contains no duplicate aliases', () => {
    const all = [...getAllCommands()]
    expect(new Set(all).size).toBe(all.length)
  })
})
