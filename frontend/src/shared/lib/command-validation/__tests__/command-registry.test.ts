import { describe, it, expect } from 'vitest'
import { isValidCommand, getAllCommands, D5_COMMANDS } from '../command-registry'

describe('command-registry', () => {
  describe('isValidCommand', () => {
    it('validates known commands', () => {
      expect(isValidCommand('/chatgpt')).toBe(true)
      expect(isValidCommand('/instruct')).toBe(true)
      expect(isValidCommand('/steps')).toBe(true)
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
    it('returns all registered commands', () => {
      const commands = getAllCommands()
      expect(commands.length).toBeGreaterThan(0)
      expect(commands).toContain('/chatgpt')
      expect(commands).toContain('/instruct')
    })

    it('returns immutable array', () => {
      const commands = getAllCommands()
      expect(commands).toBe(D5_COMMANDS)
    })
  })
})
