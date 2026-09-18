import { describe, expect, it } from 'vitest'
import { getTreeIndentLayout } from './tree-layout'

describe('tree indent layout', () => {
  it.each([
    { depth: 0, compact: false, rowIndent: 12, wireIndent: 12 },
    { depth: 1, compact: false, rowIndent: 44, wireIndent: 12 },
    { depth: 2, compact: false, rowIndent: 76, wireIndent: 44 },
    { depth: 4, compact: false, rowIndent: 140, wireIndent: 108 },
    { depth: 0, compact: true, rowIndent: 12, wireIndent: 12 },
    { depth: 1, compact: true, rowIndent: 44, wireIndent: 12 },
    { depth: 2, compact: true, rowIndent: 44, wireIndent: 12 },
    { depth: 4, compact: true, rowIndent: 44, wireIndent: 12 },
    { depth: 10, compact: true, rowIndent: 44, wireIndent: 12 },
  ])(
    'maps depth $depth with compact=$compact to stable row and wire indents',
    ({ depth, compact, rowIndent, wireIndent }) => {
      expect(getTreeIndentLayout(depth, compact)).toEqual({
        rowIndent,
        wireIndent,
        childIndent: rowIndent,
      })
    },
  )

  it.each([
    { depth: -1, compact: false },
    { depth: -1, compact: true },
    { depth: 0.5, compact: false },
    { depth: 0.5, compact: true },
  ])('normalizes non-renderable depth $depth with compact=$compact to root spacing', ({ depth, compact }) => {
    expect(getTreeIndentLayout(depth, compact)).toEqual({
      rowIndent: 12,
      wireIndent: 12,
      childIndent: 12,
    })
  })
})
