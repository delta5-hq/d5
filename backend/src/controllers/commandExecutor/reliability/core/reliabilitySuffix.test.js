import {stripReliabilitySuffix, appendValidateSuffix, appendRefineSuffix} from './reliabilitySuffix'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

describe('stripReliabilitySuffix', () => {
  it('returns empty string for null/undefined', () => {
    expect(stripReliabilitySuffix(null)).toBe('')
    expect(stripReliabilitySuffix(undefined)).toBe('')
  })

  it('strips legacy English suffixes', () => {
    expect(stripReliabilitySuffix('Analyze competitors [✓ 3/3 best of 3]')).toBe('Analyze competitors')
    expect(stripReliabilitySuffix('Some task [✗ 0/2 passed]')).toBe('Some task')
    expect(stripReliabilitySuffix('Draft [✓ refined]')).toBe('Draft')
  })

  it('strips bare symbol suffixes', () => {
    expect(stripReliabilitySuffix('My task [✓]')).toBe('My task')
    expect(stripReliabilitySuffix('My task [✗]')).toBe('My task')
    expect(stripReliabilitySuffix('My task [⚠]')).toBe('My task')
  })

  it('strips new-format suffixes', () => {
    expect(stripReliabilitySuffix('Task [✓ retry-2]')).toBe('Task')
    expect(stripReliabilitySuffix('Task [✗ 3 attempts]')).toBe('Task')
    expect(stripReliabilitySuffix('Task [✓ 3/3]')).toBe('Task')
    expect(stripReliabilitySuffix('Task [✗ 0/3]')).toBe('Task')
  })

  it('leaves titles without reliability suffix unchanged', () => {
    expect(stripReliabilitySuffix('Normal task')).toBe('Normal task')
    expect(stripReliabilitySuffix('Task [with brackets]')).toBe('Task [with brackets]')
  })
})

describe('appendValidateSuffix', () => {
  it('[✓] for passed with no retries', () => {
    expect(appendValidateSuffix('My task', {passed: true, retryCount: 0})).toBe('My task [✓]')
  })

  it('[✓ retry-1] for passed after 1 retry', () => {
    expect(appendValidateSuffix('My task', {passed: true, retryCount: 1})).toBe('My task [✓ retry-1]')
  })

  it('[✓ retry-2] for passed after 2 retries', () => {
    expect(appendValidateSuffix('My task', {passed: true, retryCount: 2})).toBe('My task [✓ retry-2]')
  })

  it('[✗ 3 attempts] for failed after 3 attempts', () => {
    expect(appendValidateSuffix('My task', {passed: false, retryCount: 3})).toBe('My task [✗ 3 attempts]')
  })

  it('strips existing suffix before adding new one', () => {
    expect(appendValidateSuffix('My task [✓]', {passed: false, retryCount: 1})).toBe('My task [✗ 1 attempts]')
  })

  it('handles empty title', () => {
    expect(appendValidateSuffix('', {passed: true, retryCount: 0})).toBe('[✓]')
  })
})

describe('appendRefineSuffix', () => {
  it('[✓ 3/3] when all forks eligible', () => {
    expect(appendRefineSuffix('My task', {eligible: 3, total: 3})).toBe('My task [✓ 3/3]')
  })

  it('[✓ 2/3] when 2 of 3 eligible', () => {
    expect(appendRefineSuffix('My task', {eligible: 2, total: 3})).toBe('My task [✓ 2/3]')
  })

  it('[✗ 0/3] when 0 eligible strict mode', () => {
    expect(appendRefineSuffix('My task', {eligible: 0, total: 3})).toBe('My task [✗ 0/3]')
  })

  it('[⚠ fallback: 0/3 passed; chose fork-1] for fallback with winner', () => {
    expect(appendRefineSuffix('My task', {eligible: 0, total: 3, fallback: true, winnerForkIndex: 1})).toBe(
      'My task [⚠ fallback: 0/3 passed; chose fork-1]',
    )
  })

  it('[⚠ fallback: 0/2 passed; chose fork-0] for fallback N=2', () => {
    expect(appendRefineSuffix('Task', {eligible: 0, total: 2, fallback: true, winnerForkIndex: 0})).toBe(
      'Task [⚠ fallback: 0/2 passed; chose fork-0]',
    )
  })

  it('strips existing suffix before adding new one', () => {
    expect(appendRefineSuffix('My task [✗]', {eligible: 3, total: 3})).toBe('My task [✓ 3/3]')
  })

  it('clamps title to 80 chars max', () => {
    const longTitle = 'A'.repeat(75)
    const result = appendRefineSuffix(longTitle, {eligible: 3, total: 3})
    expect(result.length).toBeLessThanOrEqual(80)
    expect(result).toContain('[✓ 3/3]')
  })
})
