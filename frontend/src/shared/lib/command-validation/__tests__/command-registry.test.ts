import { describe, it, expect } from 'vitest'
import { isValidCommand, getAllCommands, D5_COMMANDS } from '../command-registry'
import { COMMAND_TO_QUERYTYPE_MAP } from '../../command-querytype-mapper'

describe('command-registry', () => {
  describe('isValidCommand', () => {
    it('returns true for every command registered in COMMAND_TO_QUERYTYPE_MAP', () => {
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
      expect(isValidCommand('/unknown')).toBe(false)
      expect(isValidCommand('chatgpt')).toBe(false)
      expect(isValidCommand('')).toBe(false)
    })

    it('is case-sensitive', () => {
      expect(isValidCommand('/CHATGPT')).toBe(false)
      expect(isValidCommand('/ChatGPT')).toBe(false)
    })
  })

  describe('getAllCommands', () => {
    it('contains every command registered in COMMAND_TO_QUERYTYPE_MAP', () => {
      const commands = getAllCommands()
      for (const cmd of Object.keys(COMMAND_TO_QUERYTYPE_MAP)) {
        expect(commands, `${cmd} should be in getAllCommands()`).toContain(cmd)
      }
    })

    it('returns the same reference on repeated calls', () => {
      expect(getAllCommands()).toBe(getAllCommands())
    })

    it('length matches COMMAND_TO_QUERYTYPE_MAP key count', () => {
      expect(getAllCommands().length).toBe(Object.keys(COMMAND_TO_QUERYTYPE_MAP).length)
    })
  })

  describe('registry synchronization with COMMAND_TO_QUERYTYPE_MAP', () => {
    it('D5_COMMANDS contains every key from COMMAND_TO_QUERYTYPE_MAP', () => {
      const mapKeys = Object.keys(COMMAND_TO_QUERYTYPE_MAP)
      mapKeys.forEach(key => {
        expect(D5_COMMANDS, `D5_COMMANDS should include ${key}`).toContain(key)
      })
    })

    it('isValidCommand returns true for every key in COMMAND_TO_QUERYTYPE_MAP', () => {
      for (const cmd of Object.keys(COMMAND_TO_QUERYTYPE_MAP)) {
        expect(isValidCommand(cmd), `${cmd} should be valid`).toBe(true)
      }
    })

    it('isValidCommand returns false for commands not in the map', () => {
      expect(isValidCommand('/notregistered')).toBe(false)
      expect(isValidCommand('/CHATGPT')).toBe(false)
    })
  })
})
