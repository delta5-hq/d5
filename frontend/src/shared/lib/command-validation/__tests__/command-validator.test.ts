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

    it.each(['/elect :n=3', '/elect :n=3 :fallback', '/elect :limit=s :n=3', '/elect :n=3   '])(
      'accepts parameter-only elect grammar: %s',
      command => expect(validateCommandForExecution(command, false)).toMatchObject({ isValid: true, canExecute: true }),
    )

    it('rejects inert trailing elect criterion text with a specific reason', () => {
      expect(validateCommandForExecution('/elect :n=3 must cite sources', false)).toEqual({
        isValid: false,
        canExecute: false,
        reason: 'elect_criterion_must_be_validate',
      })
    })

    it('rejects legacy validate retry ownership with a specific reason', () => {
      expect(validateCommandForExecution('/validate :retry=2 criterion', false)).toEqual({
        isValid: false,
        canExecute: false,
        reason: 'validate_retry_must_be_refine',
      })
    })

    it('does not classify a longer malformed retry token as legacy retry ownership', () => {
      expect(validateCommandForExecution('/validate criterion :retry=2abc', false)).toMatchObject({
        isValid: true,
        canExecute: true,
      })
    })

    it('uses dynamic aliases when deciding whether a neighboring command is executable', () => {
      expect(
        validateCommandForExecution('/refinement :n=3', false, [{ alias: '/refinement', queryType: 'custom' }]),
      ).toMatchObject({ isValid: true, canExecute: true })
    })

    it.each(['/refine', '/refine :n=0', '/refine :n=3.5', '/refine :n=3 unexpected'])(
      'rejects malformed refine grammar: %s',
      command => expect(validateCommandForExecution(command, false).reason).toBe('invalid_refine_syntax'),
    )

    it.each(['/refine :n=1', '/refine :n=3'])('accepts bounded refine grammar: %s', command =>
      expect(validateCommandForExecution(command, false)).toMatchObject({ isValid: true, canExecute: true }),
    )
  })
})
