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

    it('replaces valid projected source title with materialized children exactly once', () => {
      const sourceTitle = 'Topic\n  Detail\n\nAnother'
      const nodes = makeNodes([
        [
          'parent',
          {
            title: sourceTitle,
            children: ['topic', 'another', 'ordinary', 'execution'],
            prompts: ['topic', 'another', 'execution'],
            titleProjection: {
              sourceTitle,
              childIds: ['topic', 'another'],
              nodeIds: ['topic', 'detail', 'another'],
            },
          },
        ],
        ['topic', { parent: 'parent', title: 'Topic', children: ['detail'] }],
        ['detail', { parent: 'topic', title: 'Detail' }],
        ['another', { parent: 'parent', title: 'Another' }],
        ['ordinary', { parent: 'parent', title: 'Ordinary child' }],
        ['execution', { parent: 'parent', title: 'Execution prompt' }],
      ])

      const { result } = renderPreview('parent', nodes)
      const lines = result.current.previewText.split('\n')

      expect(lines.filter(line => line.trim() === 'Topic')).toHaveLength(1)
      expect(lines.filter(line => line.trim() === 'Detail')).toHaveLength(1)
      expect(lines.filter(line => line.trim() === 'Another')).toHaveLength(1)
      expect(result.current.previewText).toContain('Ordinary child')
      expect(result.current.previewText).toContain('Execution prompt')
    })

    it('does not suppress content when title projection is stale', () => {
      const nodes = makeNodes([
        [
          'parent',
          {
            title: 'Edited title',
            children: ['projected'],
            prompts: ['projected'],
            titleProjection: { sourceTitle: 'Old title', childIds: ['projected'], nodeIds: ['projected'] },
          },
        ],
        ['projected', { parent: 'parent', title: 'Old title' }],
      ])

      const { result } = renderPreview('parent', nodes)

      expect(result.current.previewText).toContain('Edited title')
      expect(result.current.previewText).toContain('Old title')
    })

    it('does not use prompt membership as title projection provenance', () => {
      const nodes = makeNodes([
        [
          'parent',
          {
            title: 'Topic\n\nAnother',
            children: ['topic', 'another'],
            prompts: ['topic', 'another'],
          },
        ],
        ['topic', { parent: 'parent', title: 'Topic' }],
        ['another', { parent: 'parent', title: 'Another' }],
      ])

      const { result } = renderPreview('parent', nodes)
      const lines = result.current.previewText.split('\n')

      expect(lines.filter(line => line.trim() === 'Topic')).toHaveLength(2)
      expect(lines.filter(line => line.trim() === 'Another')).toHaveLength(2)
    })

    it('applies nested title projections without shifting unrelated descendants', () => {
      const sourceTitle = 'Outer'
      const nestedSourceTitle = 'Inner\n  Leaf'
      const nodes = makeNodes([
        [
          'parent',
          {
            title: sourceTitle,
            children: ['outer', 'nested', 'sibling'],
            titleProjection: { sourceTitle, childIds: ['outer'], nodeIds: ['outer'] },
          },
        ],
        ['outer', { parent: 'parent', title: 'Outer' }],
        [
          'nested',
          {
            parent: 'parent',
            title: nestedSourceTitle,
            children: ['inner', 'plain'],
            titleProjection: {
              sourceTitle: nestedSourceTitle,
              childIds: ['inner'],
              nodeIds: ['inner', 'leaf'],
            },
          },
        ],
        ['inner', { parent: 'nested', title: 'Inner', children: ['leaf'] }],
        ['leaf', { parent: 'inner', title: 'Leaf' }],
        ['plain', { parent: 'nested', title: 'Plain descendant' }],
        ['sibling', { parent: 'parent', title: 'Sibling' }],
      ])

      const { result } = renderPreview('parent', nodes)
      const lines = result.current.previewText.split('\n')

      expect(lines.filter(line => line.trim() === 'Outer')).toHaveLength(1)
      expect(lines.filter(line => line.trim() === 'Inner')).toHaveLength(1)
      expect(lines.filter(line => line.trim() === 'Leaf')).toHaveLength(1)
      expect(result.current.previewText).toContain('Plain descendant')
      expect(result.current.previewText).toContain('Sibling')
    })

    it('restores the source title when a nested projected line is edited', () => {
      const sourceTitle = 'Root\n  Child'
      const nodes = makeNodes([
        [
          'parent',
          {
            title: sourceTitle,
            children: ['root-line'],
            titleProjection: {
              sourceTitle,
              childIds: ['root-line'],
              nodeIds: ['root-line', 'child-line'],
            },
          },
        ],
        ['root-line', { parent: 'parent', title: 'Root', children: ['child-line'] }],
        ['child-line', { parent: 'root-line', title: 'Edited child' }],
      ])

      const { result } = renderPreview('parent', nodes)

      expect(result.current.previewText).toContain(sourceTitle)
      expect(result.current.previewText).toContain('Edited child')
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
