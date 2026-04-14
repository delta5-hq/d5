import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { useCommandEnterExecute } from '../use-command-enter-execute'
import type { NodeData } from '@shared/base-types'
import { AliasProvider } from '@entities/aliases'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AliasProvider>{children}</AliasProvider>
  </QueryClientProvider>
)

const makeNode = (overrides: Partial<NodeData> = {}): NodeData => ({
  id: 'node-1',
  title: 'Test Node',
  command: '/chat Hello',
  parent: 'parent-id',
  children: [],
  collapsed: false,
  prompts: [],
  ...overrides,
})

function makeHandlers() {
  return {
    onExecute: vi.fn<(node: NodeData, queryType: string) => Promise<boolean>>().mockResolvedValue(true),
    onAddSibling: vi.fn<(nodeId: string) => string | null>().mockReturnValue('sibling-id'),
    onSelectNode: vi.fn<(nodeId: string) => void>(),
  }
}

function renderChain(node: NodeData, isRoot = false, isExecuting = false) {
  const handlers = makeHandlers()
  const hook = renderHook(
    ({ n, r, e }: { n: NodeData; r: boolean; e: boolean }) =>
      useCommandEnterExecute({ node: n, isRoot: r, isExecuting: e, ...handlers }),
    {
      initialProps: { n: node, r: isRoot, e: isExecuting },
      wrapper: TestWrapper,
    },
  )
  return { ...hook, handlers }
}

describe('useCommandEnterExecute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('guard conditions — execution is skipped when', () => {
    it('node has no parent (root node)', async () => {
      const { result, handlers } = renderChain(makeNode({ parent: undefined }), true)
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onExecute).not.toHaveBeenCalled()
    })

    it('isExecuting is true', async () => {
      const { result, handlers } = renderChain(makeNode(), false, true)
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onExecute).not.toHaveBeenCalled()
    })

    it('command is empty string', async () => {
      const { result, handlers } = renderChain(makeNode({ command: '' }))
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onExecute).not.toHaveBeenCalled()
    })

    it('command is whitespace only', async () => {
      const { result, handlers } = renderChain(makeNode({ command: '   ' }))
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onExecute).not.toHaveBeenCalled()
    })

    it('command is undefined', async () => {
      const { result, handlers } = renderChain(makeNode({ command: undefined }))
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onExecute).not.toHaveBeenCalled()
    })

    it('command is plain text without a slash-command prefix', async () => {
      const { result, handlers } = renderChain(makeNode({ command: 'plain text' }))
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onExecute).not.toHaveBeenCalled()
    })
  })

  describe('execution', () => {
    it('calls onExecute with the node and a string queryType', async () => {
      const node = makeNode({ command: '/chat Write a poem' })
      const { result, handlers } = renderChain(node)
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onExecute).toHaveBeenCalledWith(node, expect.any(String))
      expect(handlers.onExecute).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['/chat hello', 'chat'],
      ['/claude describe', 'claude'],
      ['/chatgpt analyze', 'chat'],
    ])('extracts correct queryType from "%s"', async (command, expectedType) => {
      const { result, handlers } = renderChain(makeNode({ command }))
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onExecute).toHaveBeenCalledWith(expect.anything(), expectedType)
    })
  })

  describe('post-execution sibling creation', () => {
    it('creates a sibling using the current node id after successful execution', async () => {
      const { result, handlers } = renderChain(makeNode({ id: 'my-node' }))
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onAddSibling).toHaveBeenCalledWith('my-node')
    })

    it('selects the newly created sibling', async () => {
      const { result, handlers } = renderChain(makeNode())
      handlers.onAddSibling.mockReturnValue('new-sibling')
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onSelectNode).toHaveBeenCalledWith('new-sibling')
    })

    it('does not create sibling when execution returns false', async () => {
      const { result, handlers } = renderChain(makeNode())
      handlers.onExecute.mockResolvedValue(false)
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onAddSibling).not.toHaveBeenCalled()
      expect(handlers.onSelectNode).not.toHaveBeenCalled()
    })

    it('does not select when onAddSibling returns null', async () => {
      const { result, handlers } = renderChain(makeNode())
      handlers.onAddSibling.mockReturnValue(null)
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onSelectNode).not.toHaveBeenCalled()
    })

    it('does not create sibling when execution rejects', async () => {
      const { result, handlers } = renderChain(makeNode())
      handlers.onExecute.mockRejectedValue(new Error('network'))
      await act(async () => result.current.handleCommandEnter())
      expect(handlers.onAddSibling).not.toHaveBeenCalled()
    })
  })

  describe('callback stability', () => {
    it('handleCommandEnter is the same reference when dependencies are unchanged', () => {
      const node = makeNode()
      const { result, rerender } = renderChain(node)
      const first = result.current.handleCommandEnter
      rerender({ n: node, r: false, e: false })
      expect(result.current.handleCommandEnter).toBe(first)
    })

    it('handleCommandEnter updates when isExecuting changes', () => {
      const node = makeNode()
      const { result, rerender } = renderChain(node, false, false)
      const first = result.current.handleCommandEnter
      rerender({ n: node, r: false, e: true })
      expect(result.current.handleCommandEnter).not.toBe(first)
    })
  })
})
