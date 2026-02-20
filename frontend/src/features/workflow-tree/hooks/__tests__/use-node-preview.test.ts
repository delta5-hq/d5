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
  describe('plain text nodes (no references)', () => {
    it('returns node title when no command is set', () => {
      const nodes = makeNodes([['n1', { title: 'hello world' }]])
      const { result } = renderPreview('n1', nodes)
      expect(result.current.previewText).toBe('hello world')
    })

    it('returns command when command is set with no references', () => {
      const nodes = makeNodes([['n1', { title: 'title', command: '/chatgpt summarize this' }]])
      const { result } = renderPreview('n1', nodes)
      expect(result.current.previewText).toBe('/chatgpt summarize this')
    })

    it('returns empty string for unknown nodeId', () => {
      const { result } = renderPreview('missing', {})
      expect(result.current.previewText).toBe('')
    })
  })

  describe('@@ reference resolution', () => {
    it('substitutes @@ reference with referenced node content', () => {
      const nodes = makeNodes([
        ['root', { children: ['n1', 'n2'], title: 'root' }],
        ['n1', { parent: 'root', title: '@ref_data some text' }],
        ['n2', { parent: 'root', title: '@@ref_data', command: '@@ref_data' }],
      ])
      const { result } = renderPreview('n2', nodes)
      expect(result.current.previewText).toContain('some text')
    })

    it('strips @@ marker when no matching reference found', () => {
      const nodes = makeNodes([['n1', { title: 'no refs', command: '@@nonexistent' }]])
      const { result } = renderPreview('n1', nodes)
      expect(result.current.previewText).not.toContain('@@')
    })
  })

  describe('##_ hashref resolution', () => {
    it('substitutes ##_ usage with content of matching #_ definition node', () => {
      const nodes = makeNodes([
        ['root', { children: ['def', 'user'], title: 'root' }],
        ['def', { parent: 'root', title: '#_data_key the payload' }],
        ['user', { parent: 'root', title: 'query', command: '##_data_key' }],
      ])
      const { result } = renderPreview('user', nodes)
      expect(result.current.previewText).toContain('the payload')
    })

    it('strips ##_ marker when no matching definition found', () => {
      const nodes = makeNodes([['n1', { title: 'no refs', command: '##_nonexistent' }]])
      const { result } = renderPreview('n1', nodes)
      expect(result.current.previewText).not.toContain('##_')
    })
  })

  describe('@@ and ##_ combined resolution', () => {
    it('resolves both @@ and ##_ references present in the same command', () => {
      const nodes = makeNodes([
        ['root', { children: ['ref_node', 'data_node', 'user'], title: 'root' }],
        ['ref_node', { parent: 'root', title: '@var1 the ref value' }],
        ['data_node', { parent: 'root', title: '#_var2 the hash value' }],
        ['user', { parent: 'root', title: 'query', command: '/custom use @@var1 and ##_var2 together' }],
      ])
      const { result } = renderPreview('user', nodes)
      expect(result.current.previewText).toContain('the ref value')
      expect(result.current.previewText).toContain('the hash value')
      expect(result.current.previewText).not.toContain('@@')
      expect(result.current.previewText).not.toContain('##_')
    })

    it('resolves both references when ##_ appears before @@ in the command string', () => {
      const nodes = makeNodes([
        ['root', { children: ['ref_node', 'data_node', 'user'], title: 'root' }],
        ['ref_node', { parent: 'root', title: '@var1 the ref value' }],
        ['data_node', { parent: 'root', title: '#_var2 the hash value' }],
        ['user', { parent: 'root', title: 'query', command: '/custom use ##_var2 and @@var1 in that order' }],
      ])
      const { result } = renderPreview('user', nodes)
      expect(result.current.previewText).toContain('the ref value')
      expect(result.current.previewText).toContain('the hash value')
      expect(result.current.previewText).not.toContain('@@')
      expect(result.current.previewText).not.toContain('##_')
    })
  })

  describe('prompt filtering', () => {
    it('excludes prompt children from output', () => {
      const promptId = 'prompt1'
      const nodes = makeNodes([
        ['root', { children: ['parent'], title: 'root' }],
        [
          'parent',
          {
            parent: 'root',
            children: ['child', promptId],
            prompts: [promptId],
            title: 'parent',
            command: '/chatgpt do work',
          },
        ],
        ['child', { parent: 'parent', title: 'child text' }],
        [promptId, { parent: 'parent', title: 'prompt output text' }],
      ])
      const { result } = renderPreview('parent', nodes)
      expect(result.current.previewText).not.toContain('prompt output text')
    })
  })

  describe('node depth enrichment', () => {
    it('produces greater indentation for deeper nesting levels', () => {
      const nodes = makeNodes([
        ['root', { children: ['n1'], title: 'root', command: '/chatgpt test' }],
        ['n1', { parent: 'root', children: ['n2'], title: 'level one' }],
        ['n2', { parent: 'n1', children: [], title: 'level two' }],
      ])
      const { result } = renderPreview('root', nodes)
      const lines = result.current.previewText.split('\n')
      const levelOneIndent = lines.find(l => l.includes('level one'))!.match(/^(\s*)/)?.[1].length ?? 0
      const levelTwoIndent = lines.find(l => l.includes('level two'))!.match(/^(\s*)/)?.[1].length ?? 0
      expect(levelTwoIndent).toBeGreaterThan(levelOneIndent)
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
