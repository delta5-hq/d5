import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNodePreview } from '../use-node-preview'
import type { NodeData, EdgeData } from '@shared/base-types'

function makeNode(id: string, overrides: Partial<NodeData> = {}): NodeData {
  return { id, title: `Node ${id}`, children: [], ...overrides }
}

function makeNodes(entries: Array<[string, Partial<NodeData>]>): Record<string, NodeData> {
  return Object.fromEntries(entries.map(([id, overrides]) => [id, makeNode(id, overrides)]))
}

function renderPreview(nodeId: string, nodes: Record<string, NodeData>, edges: Record<string, EdgeData> = {}) {
  return renderHook(() => useNodePreview({ nodeId, nodes, edges }))
}

describe('useNodePreview', () => {
  describe('preview semantics', () => {
    it('uses node title not command for display', () => {
      const nodes = makeNodes([['n1', { title: 'Task Title', command: '/chatgpt execute' }]])
      const { result } = renderPreview('n1', nodes)
      expect(result.current.previewText).toBe('Task Title')
      expect(result.current.previewText).not.toContain('/chatgpt')
    })

    it('includes prompt children in output', () => {
      const nodes = makeNodes([
        ['parent', { children: ['regular', 'prompt'], prompts: ['prompt'], title: 'Parent' }],
        ['regular', { parent: 'parent', title: 'Regular child' }],
        ['prompt', { parent: 'parent', title: 'Prompt child' }],
      ])
      const { result } = renderPreview('parent', nodes)
      expect(result.current.previewText).toContain('Regular child')
      expect(result.current.previewText).toContain('Prompt child')
    })

    it('shows command-bearing child nodes by title in hierarchical preview', () => {
      const nodes = makeNodes([
        ['root', { children: ['cmd-child', 'plain'], title: 'Root' }],
        ['cmd-child', { parent: 'root', title: 'Child Title', command: '/custom process' }],
        ['plain', { parent: 'root', title: 'Plain text' }],
      ])
      const { result } = renderPreview('root', nodes)
      expect(result.current.previewText).toContain('Child Title')
      expect(result.current.previewText).not.toContain('/custom')
      expect(result.current.previewText).toContain('Plain text')
    })
  })

  describe('reference resolution in titles', () => {
    it('resolves @@ references in node title', () => {
      const nodes = makeNodes([
        ['root', { children: ['def', 'user'], title: 'root' }],
        ['def', { parent: 'root', title: '@var content' }],
        ['user', { parent: 'root', title: 'Text with @@var' }],
      ])
      const { result } = renderPreview('user', nodes)
      expect(result.current.previewText).toContain('content')
      expect(result.current.previewText).not.toContain('@@')
    })

    it('resolves ##_ references in node title', () => {
      const nodes = makeNodes([
        ['root', { children: ['def', 'user'], title: 'root' }],
        ['def', { parent: 'root', title: '#_key payload' }],
        ['user', { parent: 'root', title: 'Result: ##_key' }],
      ])
      const { result } = renderPreview('user', nodes)
      expect(result.current.previewText).toContain('payload')
      expect(result.current.previewText).not.toContain('##_')
    })

    it('resolves mixed @@ and ##_ references in single title', () => {
      const nodes = makeNodes([
        ['root', { children: ['ref', 'hash', 'user'], title: 'root' }],
        ['ref', { parent: 'root', title: '@r alpha' }],
        ['hash', { parent: 'root', title: '#_h beta' }],
        ['user', { parent: 'root', title: 'Combine @@r and ##_h' }],
      ])
      const { result } = renderPreview('user', nodes)
      expect(result.current.previewText).toContain('alpha')
      expect(result.current.previewText).toContain('beta')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for unknown nodeId', () => {
      const { result } = renderPreview('missing', {})
      expect(result.current.previewText).toBe('')
    })

    it('handles nodes with empty title', () => {
      const nodes = makeNodes([['n1', { title: '' }]])
      const { result } = renderPreview('n1', nodes)
      expect(result.current.previewText).toBe('')
    })

    it('preserves indentation hierarchy', () => {
      const nodes = makeNodes([
        ['root', { children: ['mid'], title: 'Root' }],
        ['mid', { parent: 'root', children: ['deep'], title: 'Mid' }],
        ['deep', { parent: 'mid', title: 'Deep' }],
      ])
      const { result } = renderPreview('root', nodes)
      const lines = result.current.previewText.split('\n')
      const midIndent = lines.find(l => l.includes('Mid'))!.match(/^(\s*)/)?.[1].length ?? 0
      const deepIndent = lines.find(l => l.includes('Deep'))!.match(/^(\s*)/)?.[1].length ?? 0
      expect(deepIndent).toBeGreaterThan(midIndent)
    })
  })

  describe('reactivity', () => {
    it('recomputes when nodes change', () => {
      const nodes1 = makeNodes([['n1', { title: 'first title' }]])
      const nodes2 = makeNodes([['n1', { title: 'second title' }]])

      const { result, rerender } = renderHook(
        ({ nodes }: { nodes: Record<string, NodeData> }) => useNodePreview({ nodeId: 'n1', nodes, edges: {} }),
        { initialProps: { nodes: nodes1 } },
      )

      expect(result.current.previewText).toBe('first title')
      rerender({ nodes: nodes2 })
      expect(result.current.previewText).toBe('second title')
    })

    it('recomputes when nodeId changes', () => {
      const nodes = makeNodes([
        ['n1', { title: 'node one' }],
        ['n2', { title: 'node two' }],
      ])

      const { result, rerender } = renderHook(
        ({ nodeId }: { nodeId: string }) => useNodePreview({ nodeId, nodes, edges: {} }),
        { initialProps: { nodeId: 'n1' } },
      )

      expect(result.current.previewText).toBe('node one')
      rerender({ nodeId: 'n2' })
      expect(result.current.previewText).toBe('node two')
    })

    it('recomputes when edges change', () => {
      const nodes = makeNodes([['n1', { title: 'stable title' }]])
      const edges1: Record<string, EdgeData> = {}
      const edges2: Record<string, EdgeData> = { 'n1:n1': { id: 'n1:n1', start: 'n1', end: 'n1', title: 'loop' } }

      const { result, rerender } = renderHook(
        ({ edges }: { edges: Record<string, EdgeData> }) => useNodePreview({ nodeId: 'n1', nodes, edges }),
        { initialProps: { edges: edges1 } },
      )

      expect(result.current.previewText).toBe('stable title')
      rerender({ edges: edges2 })
      expect(result.current.previewText).toBe('stable title')
    })
  })
})
