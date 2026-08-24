import {isRefineCell, isValidRefineCell, readRawRefineN, readRefineN, readRefineTrailingText} from './refineParams'

describe('refineParams', () => {
  it.each(['/refine', '/refine :n=1', '/refine :n=3'])('recognizes exact /refine cells: %s', command => {
    expect(isRefineCell(command)).toBe(true)
  })

  it.each(['/refinery :n=3', '/validate criterion', undefined])('rejects non-refine cells: %p', command => {
    expect(isRefineCell(command)).toBe(false)
  })

  it.each([
    ['/refine :n=1', 1],
    ['/refine :n=4', 4],
    ['/refine :n=0', null],
    ['/refine :n=3.5', null],
    ['/refine :n=abc', null],
    ['/refine', null],
  ])('reads the bounded attempt cap from %s', (command, expected) => {
    expect(readRefineN(command)).toBe(expected)
  })

  it('preserves raw zero so the caller can render the boundary-specific error', () => {
    expect(readRawRefineN('/refine :n=0')).toBe(0)
  })

  it('does not parse a refine lookalike command', () => {
    expect(readRawRefineN('/refinery :n=3')).toBeNull()
    expect(readRefineN('/refinery :n=3')).toBeNull()
  })

  it.each([
    ['/refine :n=3', ''],
    ['/refine :n=3   ', ''],
    ['/refine :n=3 unexpected', 'unexpected'],
  ])('extracts unsupported trailing text from %s', (command, expected) => {
    expect(readRefineTrailingText(command)).toBe(expected)
  })

  it.each([
    ['/refine :n=1', true],
    ['/refine :n=3', true],
    ['/refine', false],
    ['/refine :n=0', false],
  ])('validity for %s is %s', (command, expected) => {
    expect(isValidRefineCell(command)).toBe(expected)
  })
})
