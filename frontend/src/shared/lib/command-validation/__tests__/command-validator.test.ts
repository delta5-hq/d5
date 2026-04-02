import { describe, it, expect } from 'vitest'
import { validateCommandForExecution } from '../command-validator'

describe('command-validator', () => {
  describe('validateCommandForExecution', () => {
    it('allows valid commands', () => {
      const result = validateCommandForExecution('/chatgpt hello', false)
      expect(result.isValid).toBe(true)
      expect(result.canExecute).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('allows valid commands with order prefix', () => {
      const result = validateCommandForExecution('#1 /chatgpt hello', false)
      expect(result.isValid).toBe(true)
      expect(result.canExecute).toBe(true)
    })

    it('rejects invalid command syntax', () => {
      const result = validateCommandForExecution('/unknown command', false)
      expect(result.isValid).toBe(false)
      expect(result.canExecute).toBe(false)
      expect(result.reason).toBe('invalid_command_syntax')
    })

    it('prevents execution when already executing', () => {
      const result = validateCommandForExecution('/chatgpt hello', true)
      expect(result.isValid).toBe(true)
      expect(result.canExecute).toBe(false)
      expect(result.reason).toBe('execution_in_progress')
    })

    it('prevents execution for empty command', () => {
      const result = validateCommandForExecution('', false)
      expect(result.isValid).toBe(true)
      expect(result.canExecute).toBe(false)
      expect(result.reason).toBe('empty_command')
    })

    it('prevents execution for whitespace-only command', () => {
      const result = validateCommandForExecution('   ', false)
      expect(result.isValid).toBe(true)
      expect(result.canExecute).toBe(false)
      expect(result.reason).toBe('empty_command')
    })

    it('prevents execution for undefined command', () => {
      const result = validateCommandForExecution(undefined, false)
      expect(result.isValid).toBe(true)
      expect(result.canExecute).toBe(false)
      expect(result.reason).toBe('empty_command')
    })

    it('handles text without command prefix', () => {
      const result = validateCommandForExecution('just text', false)
      expect(result.isValid).toBe(false)
      expect(result.canExecute).toBe(false)
      expect(result.reason).toBe('invalid_command_syntax')
    })
  })
})
