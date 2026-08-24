import { describe, expect, it } from 'vitest'
import { readRefineN, readRefineTrailingText } from '../refine-params'

describe('refine params', () => {
  it.each([
    ['/refine :n=1', 1],
    ['/refine :n=3', 3],
    ['/refine', null],
    ['/refine :n=0', null],
    ['/refine :n=3.5', null],
    ['/refinery :n=3', null],
  ] as const)('reads %s as %s', (command, expected) => {
    expect(readRefineN(command)).toBe(expected)
  })

  it.each([
    ['/refine :n=3', ''],
    ['/refine :n=3 unexpected', 'unexpected'],
  ] as const)('extracts trailing text from %s', (command, expected) => {
    expect(readRefineTrailingText(command)).toBe(expected)
  })
})
