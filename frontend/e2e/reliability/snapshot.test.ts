import { test, expect } from '@playwright/test'
import { validateTitlesOwnedByIterations } from './snapshot'
import type { WorkflowSnapshot } from './snapshot'

const MARKER = 'MOCK_VALIDATE_FAIL_IF_CONTENT_CONTAINS=Beta'

const FIXTURE: WorkflowSnapshot = {
  nodes: {
    'iter-alpha-validate': { title: `alpha /validate :retry=0 ${MARKER} [✓]`,    parent: 'iter-alpha' },
    'iter-beta-validate':  { title: `beta  /validate :retry=0 ${MARKER} [✗ 1×]`, parent: 'iter-beta' },
    'iter-gamma-validate': { title: `gamma /validate :retry=0 ${MARKER} [✓]`,    parent: 'iter-gamma' },
    'unrelated-validate':  { title: `other /validate :retry=0 ${MARKER} [✓]`,    parent: 'unrelated-parent' },
    'foreach-template':    { title: `/validate :retry=0 ${MARKER}`,               parent: 'foreach-id' },
    'wrong-marker':        { title: 'something else entirely [✓]',                parent: 'iter-alpha' },
  },
}

const ITERATION_IDS = ['iter-alpha', 'iter-beta', 'iter-gamma']

test.describe('validateTitlesOwnedByIterations', () => {
  test('returns one title per iteration when each has exactly one matching validate child', () => {
    const result = validateTitlesOwnedByIterations(FIXTURE, MARKER, ITERATION_IDS)
    expect(result).toHaveLength(3)
  })

  test('excludes nodes whose parent is not in the iteration set', () => {
    const result = validateTitlesOwnedByIterations(FIXTURE, MARKER, ITERATION_IDS)
    const hasUnrelated = result.some(t => t.includes('other /validate'))
    expect(hasUnrelated).toBe(false)
  })

  test('excludes nodes whose title does not include the criterion marker', () => {
    const result = validateTitlesOwnedByIterations(FIXTURE, MARKER, ITERATION_IDS)
    expect(result.every(t => t.includes(MARKER))).toBe(true)
  })

  test('excludes the template node under foreach — it has the marker but is not an iteration child', () => {
    const templateTitle = `/validate :retry=0 ${MARKER}`
    const result = validateTitlesOwnedByIterations(FIXTURE, MARKER, ITERATION_IDS)
    expect(result).not.toContain(templateTitle)
  })

  test('returns empty array when no iteration ids are provided', () => {
    const result = validateTitlesOwnedByIterations(FIXTURE, MARKER, [])
    expect(result).toHaveLength(0)
  })

  test('returns empty array when workflow has no nodes', () => {
    const result = validateTitlesOwnedByIterations({}, MARKER, ITERATION_IDS)
    expect(result).toHaveLength(0)
  })

  test('returns empty array when no nodes match the criterion marker', () => {
    const result = validateTitlesOwnedByIterations(FIXTURE, 'NO_SUCH_MARKER', ITERATION_IDS)
    expect(result).toHaveLength(0)
  })

  test('returns only the subset for a single iteration id', () => {
    const result = validateTitlesOwnedByIterations(FIXTURE, MARKER, ['iter-beta'])
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('✗')
  })

  test('titles include the verdict suffix appended by the engine', () => {
    const result = validateTitlesOwnedByIterations(FIXTURE, MARKER, ITERATION_IDS)
    const passTitles = result.filter(t => t.includes('[✓]'))
    const failTitles = result.filter(t => t.includes('[✗ 1×]'))
    expect(passTitles).toHaveLength(2)
    expect(failTitles).toHaveLength(1)
  })

  test('returns all matching children when an iteration has more than one validate node', () => {
    const multi: WorkflowSnapshot = {
      nodes: {
        'iter-a-v1': { title: `first ${MARKER} [✓]`,    parent: 'iter-a' },
        'iter-a-v2': { title: `second ${MARKER} [✗ 1×]`, parent: 'iter-a' },
      },
    }
    const result = validateTitlesOwnedByIterations(multi, MARKER, ['iter-a'])
    expect(result).toHaveLength(2)
  })

  test('excludes nodes with undefined title — String(undefined) does not contain any real criterion marker', () => {
    const withUndefinedTitle: WorkflowSnapshot = {
      nodes: {
        'no-title':   { title: undefined,           parent: 'iter-alpha' },
        'with-title': { title: `${MARKER} [✓]`, parent: 'iter-alpha' },
      },
    }
    const result = validateTitlesOwnedByIterations(withUndefinedTitle, MARKER, ['iter-alpha'])
    expect(result).toHaveLength(1)
  })

  test('excludes nodes with undefined parent — they cannot belong to any iteration', () => {
    const withUndefinedParent: WorkflowSnapshot = {
      nodes: {
        'no-parent': { title: `${MARKER} [✓]`, parent: undefined },
      },
    }
    const result = validateTitlesOwnedByIterations(withUndefinedParent, MARKER, ['iter-alpha'])
    expect(result).toHaveLength(0)
  })
})
