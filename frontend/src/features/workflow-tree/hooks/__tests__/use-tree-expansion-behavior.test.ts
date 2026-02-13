import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTreeExpansion } from '../use-tree-expansion'

describe('useTreeExpansion - React Integration', () => {
  describe('callback stability', () => {
    it('callback references remain stable across renders', () => {
      const { result, rerender } = renderHook(() => useTreeExpansion(new Set()))

      const firstToggle = result.current.toggleNode
      const firstExpand = result.current.expandNode
      const firstCollapse = result.current.collapseNode

      act(() => {
        result.current.toggleNode('a')
      })
      rerender()

      expect(result.current.toggleNode).toBe(firstToggle)
      expect(result.current.expandNode).toBe(firstExpand)
      expect(result.current.collapseNode).toBe(firstCollapse)
    })
  })

  describe('dispatch wiring', () => {
    it('all callbacks dispatch correct actions', () => {
      const { result } = renderHook(() => useTreeExpansion(new Set()))

      act(() => {
        result.current.expandNode('a')
        result.current.toggleNode('b')
        result.current.expandAll(['c', 'd'])
        result.current.collapseNode('a')
        result.current.expandNode('e')
      })
      expect([...result.current.expandedIds].sort()).toEqual(['b', 'c', 'd', 'e'])

      act(() => {
        result.current.collapseAll()
      })
      expect(result.current.expandedIds.size).toBe(0)

      act(() => {
        result.current.setExpandedIds(new Set(['x', 'y']))
      })
      expect([...result.current.expandedIds].sort()).toEqual(['x', 'y'])
    })

    it('rapid sequential toggles resolve correctly', () => {
      const { result } = renderHook(() => useTreeExpansion(new Set()))

      act(() => {
        result.current.toggleNode('a')
        result.current.toggleNode('b')
        result.current.toggleNode('c')
        result.current.toggleNode('a')
        result.current.toggleNode('b')
      })

      expect(result.current.expandedIds.has('a')).toBe(false)
      expect(result.current.expandedIds.has('b')).toBe(false)
      expect(result.current.expandedIds.has('c')).toBe(true)
    })
  })

  describe('large-scale operations', () => {
    it('handles expanding 1000 nodes via expandAll', () => {
      const { result } = renderHook(() => useTreeExpansion(new Set()))
      const ids = Array.from({ length: 1000 }, (_, i) => `node-${i}`)

      act(() => {
        result.current.expandAll(ids)
      })

      expect(result.current.expandedIds.size).toBe(1000)
    })

    it('handles 1000 individual expand operations', () => {
      const { result } = renderHook(() => useTreeExpansion(new Set()))

      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.expandNode(`node-${i}`)
        }
      })

      expect(result.current.expandedIds.size).toBe(1000)
    })
  })
})
