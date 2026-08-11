import { describe, expect, it } from 'vitest'
import type { NodeData } from '@shared/base-types'
import { applyCheckedSelection } from '../workflow-checked-selection'

describe('applyCheckedSelection', () => {
  it('is the single projection from runtime selection to persisted checked state', () => {
    const nodes: Record<string, NodeData> = {
      root: { id: 'root', title: 'Root', children: ['a', 'b'] },
      a: { id: 'a', title: 'A', parent: 'root', children: [], checked: true },
      b: { id: 'b', title: 'B', parent: 'root', children: [] },
    }

    const result = applyCheckedSelection(nodes, new Set(['b']))

    expect(result.nodes.a.checked).toBe(false)
    expect(result.nodes.b.checked).toBe(true)
    expect(result.changedIds).toEqual(['a', 'b'])
    expect(nodes.a.checked).toBe(true)
    expect(nodes.b.checked).toBeUndefined()
  })

  it('preserves node-map identity when selection already matches checked state', () => {
    const nodes: Record<string, NodeData> = {
      root: { id: 'root', title: 'Root', children: ['a'] },
      a: { id: 'a', title: 'A', parent: 'root', children: [], checked: true },
    }

    const result = applyCheckedSelection(nodes, new Set(['a']))

    expect(result.nodes).toBe(nodes)
    expect(result.changedIds).toEqual([])
  })
})
