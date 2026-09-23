import {clearStepsPrefix} from './steps'

describe('clearStepsPrefix — strips a leading step-order marker only', () => {
  it.each([
    ['#10 /chat draft', '/chat draft'],
    ['#0 /chat', '/chat'],
    ['#-2 /chat back-reference', '/chat back-reference'],
    ['#999 anything at all', 'anything at all'],
  ])('removes a leading order prefix: %s', (input, expected) => {
    expect(clearStepsPrefix(input)).toBe(expected)
  })

  it.each([['  #10 /chat y'], ['\t#3 /web q']])(
    'trims surrounding whitespace before stripping the leading prefix: %j',
    input => {
      expect(clearStepsPrefix(input).startsWith('#')).toBe(false)
    },
  )

  it('strips only the first leading marker, leaving a second one in place', () => {
    expect(clearStepsPrefix('#10 #20 /chat x')).toBe('#20 /chat x')
  })
})

describe('clearStepsPrefix — preserves a #N that is not a leading order marker', () => {
  it.each([
    ['/chat see issue #360 and #372', '/chat see issue #360 and #372'],
    ['/chat draft top #5 ideas', '/chat draft top #5 ideas'],
    ['#10 /chat about issue #360', '/chat about issue #360'],
  ])('keeps an in-text #N intact: %s', (input, expected) => {
    expect(clearStepsPrefix(input)).toBe(expected)
  })

  it('leaves a #N that has no following separator untouched, as it is not an order marker', () => {
    expect(clearStepsPrefix('#10')).toBe('#10')
  })

  it('returns an empty string for whitespace-only input', () => {
    expect(clearStepsPrefix('   ')).toBe('')
  })
})
