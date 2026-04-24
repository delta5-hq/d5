import {normalizeWorkflowId} from './normalizeWorkflowId'

describe('normalizeWorkflowId', () => {
  describe('normalizes falsy values to null', () => {
    it.each([
      [null, 'null'],
      [undefined, 'undefined'],
      ['', 'empty string'],
      [0, 'zero'],
      [false, 'false boolean'],
    ])('normalizes %p (%s) to null', value => {
      expect(normalizeWorkflowId(value)).toBeNull()
    })
  })

  describe('preserves truthy string values unchanged', () => {
    it.each([
      ['wf-123', 'standard workflow ID'],
      ['wf_underscored', 'ID with underscore'],
      ['wf-$pecial@2024', 'ID with special characters'],
      ['  wf-123  ', 'ID with surrounding whitespace'],
    ])('preserves %p (%s)', value => {
      expect(normalizeWorkflowId(value)).toBe(value)
    })
  })

  describe('idempotency', () => {
    it('double-normalizing null yields null', () => {
      expect(normalizeWorkflowId(normalizeWorkflowId(null))).toBeNull()
    })

    it('double-normalizing a string yields same string', () => {
      expect(normalizeWorkflowId(normalizeWorkflowId('wf-123'))).toBe('wf-123')
    })
  })
})
