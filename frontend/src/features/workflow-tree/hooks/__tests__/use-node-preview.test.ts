import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNodePreview, hasReferences } from '../use-node-preview'
import type { NodeData, EdgeData } from '@shared/base-types'

vi.mock('../../api/resolve-node-preview', () => ({
  resolveNodePreview: vi.fn(),
}))

import { resolveNodePreview } from '../../api/resolve-node-preview'

const DEBOUNCE_MS = 300

function makeNode(id: string, overrides: Partial<NodeData> = {}): NodeData {
  return { id, title: `Node ${id}`, children: [], ...overrides } as NodeData
}

function defaultParams(overrides: Partial<Parameters<typeof useNodePreview>[0]> = {}) {
  return {
    nodeId: 'n1',
    command: 'plain text',
    title: undefined,
    nodes: { n1: makeNode('n1') } as Record<string, NodeData>,
    edges: {} as Record<string, EdgeData>,
    workflowId: 'wf-1',
    ...overrides,
  }
}

async function advanceDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
  })
}

describe('hasReferences', () => {
  it.each([
    ['@@ref', true],
    ['text @@ref text', true],
    ['##_var', true],
    ['text ##_var text', true],
    ['@@ref and ##_var', true],
    ['email@@domain.com', true],
    ['##plain', true],
    ['plain text', false],
    ['user@email.com', false],
    ['# heading', false],
    ['/chatgpt summarize', false],
    ['', false],
    [undefined, false],
  ] as const)('hasReferences(%j) → %s', (input, expected) => {
    expect(hasReferences(input as string | undefined)).toBe(expected)
  })
})

describe('useNodePreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('commands without references', () => {
    it('returns raw command as previewText', async () => {
      const { result } = renderHook(() => useNodePreview(defaultParams({ command: 'Hello world' })))
      await advanceDebounce()

      expect(result.current.previewText).toBe('Hello world')
      expect(resolveNodePreview).not.toHaveBeenCalled()
    })

    it('returns empty string for undefined command', async () => {
      const { result } = renderHook(() => useNodePreview(defaultParams({ command: undefined })))
      await advanceDebounce()

      expect(result.current.previewText).toBe('')
      expect(resolveNodePreview).not.toHaveBeenCalled()
    })

    it('returns empty string for empty command', async () => {
      const { result } = renderHook(() => useNodePreview(defaultParams({ command: '' })))
      await advanceDebounce()

      expect(result.current.previewText).toBe('')
      expect(resolveNodePreview).not.toHaveBeenCalled()
    })

    it('reports no loading or error state', async () => {
      const { result } = renderHook(() => useNodePreview(defaultParams({ command: 'plain' })))
      await advanceDebounce()

      expect(result.current.error).toBeUndefined()
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('commands with @@ references', () => {
    it('resolves via API and returns result', async () => {
      vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'resolved text' })

      const { result } = renderHook(() => useNodePreview(defaultParams({ command: 'use @@myref here' })))
      await advanceDebounce()

      expect(result.current.previewText).toBe('resolved text')
      expect(resolveNodePreview).toHaveBeenCalledTimes(1)
    })

    it('passes correct request parameters to API', async () => {
      vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: '' })
      const nodes = { n1: makeNode('n1') } as Record<string, NodeData>
      const edges = { e1: { id: 'e1' } } as unknown as Record<string, EdgeData>

      renderHook(() =>
        useNodePreview({
          nodeId: 'n1',
          command: '@@ref',
          title: undefined,
          nodes,
          edges,
          workflowId: 'wf-42',
        }),
      )
      await advanceDebounce()

      expect(resolveNodePreview).toHaveBeenCalledWith({
        nodeId: 'n1',
        workflowNodes: nodes,
        workflowEdges: edges,
        workflowId: 'wf-42',
      })
    })

    it('makes single API call for multiple @@refs', async () => {
      vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'both' })

      renderHook(() => useNodePreview(defaultParams({ command: '@@alpha and @@beta' })))
      await advanceDebounce()

      expect(resolveNodePreview).toHaveBeenCalledTimes(1)
    })
  })

  describe('commands with ## hashrefs', () => {
    it('calls API for ##_hashref pattern', async () => {
      vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'hash resolved' })

      const { result } = renderHook(() => useNodePreview(defaultParams({ command: 'use ##_myvar here' })))
      await advanceDebounce()

      expect(result.current.previewText).toBe('hash resolved')
    })

    it('detects ## without underscore suffix', async () => {
      vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'ok' })

      renderHook(() => useNodePreview(defaultParams({ command: '##plain' })))
      await advanceDebounce()

      expect(resolveNodePreview).toHaveBeenCalled()
    })
  })

  describe('commands with mixed @@ and ## references', () => {
    it('calls API when both @@ and ## present', async () => {
      vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'mixed' })

      const { result } = renderHook(() => useNodePreview(defaultParams({ command: '@@ref and ##_var' })))
      await advanceDebounce()

      expect(result.current.previewText).toBe('mixed')
      expect(resolveNodePreview).toHaveBeenCalledTimes(1)
    })
  })

  describe('debounce behavior', () => {
    it('does not call API before debounce period', () => {
      renderHook(() => useNodePreview(defaultParams({ command: '@@ref' })))

      vi.advanceTimersByTime(DEBOUNCE_MS - 1)
      expect(resolveNodePreview).not.toHaveBeenCalled()
    })

    it('calls API after debounce period', async () => {
      vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'ok' })

      renderHook(() => useNodePreview(defaultParams({ command: '@@ref' })))
      await advanceDebounce()

      expect(resolveNodePreview).toHaveBeenCalledTimes(1)
    })

    it('resets timer on parameter change within debounce window', async () => {
      vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'second' })

      const { rerender } = renderHook((props: Parameters<typeof useNodePreview>[0]) => useNodePreview(props), {
        initialProps: defaultParams({ command: '@@first' }),
      })

      vi.advanceTimersByTime(DEBOUNCE_MS - 50)
      expect(resolveNodePreview).not.toHaveBeenCalled()

      rerender(defaultParams({ command: '@@second' }))
      await advanceDebounce()

      expect(resolveNodePreview).toHaveBeenCalledTimes(1)
    })
  })

  describe('loading state', () => {
    it('sets isLoading during API call', async () => {
      vi.mocked(resolveNodePreview).mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve({ resolvedCommand: 'done' }), 1000)
          }),
      )

      const { result } = renderHook(() => useNodePreview(defaultParams({ command: '@@ref' })))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
      })

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.previewText).toBe('done')
    })

    it('isLoading is false for plain commands', async () => {
      const { result } = renderHook(() => useNodePreview(defaultParams({ command: 'no refs' })))
      await advanceDebounce()

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('error handling', () => {
    it('sets error message on API failure', async () => {
      vi.mocked(resolveNodePreview).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useNodePreview(defaultParams({ command: '@@ref' })))
      await advanceDebounce()

      expect(result.current.error).toBe('Network error')
      expect(result.current.isLoading).toBe(false)
    })

    it('uses fallback message for non-Error rejects', async () => {
      vi.mocked(resolveNodePreview).mockRejectedValue('raw string error')

      const { result } = renderHook(() => useNodePreview(defaultParams({ command: '@@ref' })))
      await advanceDebounce()

      expect(result.current.error).toBe('Preview failed')
    })

    it('clears error when command changes to plain text', async () => {
      vi.mocked(resolveNodePreview).mockRejectedValueOnce(new Error('fail'))

      const { result, rerender } = renderHook((props: Parameters<typeof useNodePreview>[0]) => useNodePreview(props), {
        initialProps: defaultParams({ command: '@@broken' }),
      })
      await advanceDebounce()
      expect(result.current.error).toBe('fail')

      rerender(defaultParams({ command: 'plain text now' }))
      await advanceDebounce()

      expect(result.current.error).toBeUndefined()
      expect(result.current.previewText).toBe('plain text now')
    })

    it('clears error on subsequent successful API call', async () => {
      vi.mocked(resolveNodePreview)
        .mockRejectedValueOnce(new Error('first fail'))
        .mockResolvedValueOnce({ resolvedCommand: 'success' })

      const { result, rerender } = renderHook((props: Parameters<typeof useNodePreview>[0]) => useNodePreview(props), {
        initialProps: defaultParams({ command: '@@first' }),
      })
      await advanceDebounce()
      expect(result.current.error).toBe('first fail')

      rerender(defaultParams({ command: '@@second' }))
      await advanceDebounce()

      expect(result.current.error).toBeUndefined()
      expect(result.current.previewText).toBe('success')
    })
  })

  describe('title reference handling', () => {
    describe('text source priority', () => {
      it('uses command when both command and title are plain text', async () => {
        const { result } = renderHook(() => useNodePreview(defaultParams({ command: 'cmd', title: 'ttl' })))
        await advanceDebounce()

        expect(result.current.previewText).toBe('cmd')
        expect(resolveNodePreview).not.toHaveBeenCalled()
      })

      it('uses title when command is undefined', async () => {
        const { result } = renderHook(() => useNodePreview(defaultParams({ command: undefined, title: 'fallback' })))
        await advanceDebounce()

        expect(result.current.previewText).toBe('fallback')
        expect(resolveNodePreview).not.toHaveBeenCalled()
      })

      it('uses empty string when both command and title are undefined', async () => {
        const { result } = renderHook(() => useNodePreview(defaultParams({ command: undefined, title: undefined })))
        await advanceDebounce()

        expect(result.current.previewText).toBe('')
        expect(resolveNodePreview).not.toHaveBeenCalled()
      })
    })

    describe('reference detection in title', () => {
      it('calls API when title has @@ references but command does not', async () => {
        vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'title resolved' })

        const { result } = renderHook(() =>
          useNodePreview(defaultParams({ command: undefined, title: 'use @@ref in title' })),
        )
        await advanceDebounce()

        expect(resolveNodePreview).toHaveBeenCalledTimes(1)
        expect(result.current.previewText).toBe('title resolved')
      })

      it('calls API when title has ## references but command does not', async () => {
        vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'hashref in title resolved' })

        const { result } = renderHook(() =>
          useNodePreview(defaultParams({ command: 'plain', title: '##_var in title' })),
        )
        await advanceDebounce()

        expect(resolveNodePreview).toHaveBeenCalledTimes(1)
        expect(result.current.previewText).toBe('hashref in title resolved')
      })

      it('calls API when title has mixed references', async () => {
        vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'mixed refs resolved' })

        const { result } = renderHook(() =>
          useNodePreview(defaultParams({ command: undefined, title: '@@ref and ##_var' })),
        )
        await advanceDebounce()

        expect(resolveNodePreview).toHaveBeenCalledTimes(1)
        expect(result.current.previewText).toBe('mixed refs resolved')
      })
    })

    describe('reference detection in both fields', () => {
      it('calls API when both command and title have references', async () => {
        vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'both resolved' })

        const { result } = renderHook(() => useNodePreview(defaultParams({ command: '@@cmdRef', title: '##titleRef' })))
        await advanceDebounce()

        expect(resolveNodePreview).toHaveBeenCalledTimes(1)
        expect(result.current.previewText).toBe('both resolved')
      })

      it('calls API when command has references and title is plain', async () => {
        vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'command resolved' })

        const { result } = renderHook(() =>
          useNodePreview(defaultParams({ command: '@@cmdRef', title: 'plain title' })),
        )
        await advanceDebounce()

        expect(resolveNodePreview).toHaveBeenCalledTimes(1)
        expect(result.current.previewText).toBe('command resolved')
      })
    })

    describe('no references in either field', () => {
      it('returns command as-is when neither command nor title has references', async () => {
        const { result } = renderHook(() => useNodePreview(defaultParams({ command: 'plain', title: 'also plain' })))
        await advanceDebounce()

        expect(result.current.previewText).toBe('plain')
        expect(resolveNodePreview).not.toHaveBeenCalled()
      })

      it('returns title as-is when command is undefined and title has no references', async () => {
        const { result } = renderHook(() => useNodePreview(defaultParams({ command: undefined, title: 'plain title' })))
        await advanceDebounce()

        expect(result.current.previewText).toBe('plain title')
        expect(resolveNodePreview).not.toHaveBeenCalled()
      })
    })

    describe('edge cases', () => {
      it('handles empty strings correctly', async () => {
        const { result } = renderHook(() => useNodePreview(defaultParams({ command: '', title: '' })))
        await advanceDebounce()

        expect(result.current.previewText).toBe('')
        expect(resolveNodePreview).not.toHaveBeenCalled()
      })

      it('handles whitespace-only strings', async () => {
        const { result } = renderHook(() => useNodePreview(defaultParams({ command: '   ', title: '  ' })))
        await advanceDebounce()

        expect(result.current.previewText).toBe('   ')
        expect(resolveNodePreview).not.toHaveBeenCalled()
      })

      it('detects references in whitespace-padded text', async () => {
        vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'padded resolved' })

        renderHook(() => useNodePreview(defaultParams({ command: undefined, title: '  @@ref  ' })))
        await advanceDebounce()

        expect(resolveNodePreview).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('abort behavior', () => {
    it('does not update state after unmount', async () => {
      vi.mocked(resolveNodePreview).mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve({ resolvedCommand: 'too late' }), 1000)
          }),
      )

      const { result, unmount } = renderHook(() => useNodePreview(defaultParams({ command: '@@ref' })))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
      })

      unmount()

      /* resolve after unmount — should not cause React state update warning */
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      expect(result.current.previewText).not.toBe('too late')
    })

    it('cancels pending debounce timer on unmount', () => {
      const { unmount } = renderHook(() => useNodePreview(defaultParams({ command: '@@ref' })))

      unmount()
      vi.advanceTimersByTime(DEBOUNCE_MS * 2)

      expect(resolveNodePreview).not.toHaveBeenCalled()
    })
  })

  describe('refresh callback', () => {
    it('exposes a refresh function', () => {
      const { result } = renderHook(() => useNodePreview(defaultParams()))
      expect(typeof result.current.refresh).toBe('function')
    })

    it('refresh triggers immediate fetch for commands with references', async () => {
      vi.mocked(resolveNodePreview).mockResolvedValue({ resolvedCommand: 'refreshed' })

      const { result } = renderHook(() => useNodePreview(defaultParams({ command: '@@ref' })))

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.previewText).toBe('refreshed')
    })

    it('refresh returns raw command for plain text', async () => {
      const { result } = renderHook(() => useNodePreview(defaultParams({ command: 'no refs' })))

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.previewText).toBe('no refs')
      expect(resolveNodePreview).not.toHaveBeenCalled()
    })
  })

  describe('parameter-driven re-fetch', () => {
    it('re-fetches when nodeId changes', async () => {
      vi.mocked(resolveNodePreview)
        .mockResolvedValueOnce({ resolvedCommand: 'first' })
        .mockResolvedValueOnce({ resolvedCommand: 'second' })

      const { result, rerender } = renderHook((props: Parameters<typeof useNodePreview>[0]) => useNodePreview(props), {
        initialProps: defaultParams({ nodeId: 'n1', command: '@@ref' }),
      })
      await advanceDebounce()
      expect(result.current.previewText).toBe('first')

      rerender(defaultParams({ nodeId: 'n2', command: '@@ref' }))
      await advanceDebounce()

      expect(result.current.previewText).toBe('second')
      expect(resolveNodePreview).toHaveBeenCalledTimes(2)
    })

    it('re-fetches when workflowId changes', async () => {
      vi.mocked(resolveNodePreview)
        .mockResolvedValueOnce({ resolvedCommand: 'wf-1 result' })
        .mockResolvedValueOnce({ resolvedCommand: 'wf-2 result' })

      const { result, rerender } = renderHook((props: Parameters<typeof useNodePreview>[0]) => useNodePreview(props), {
        initialProps: defaultParams({ command: '@@ref', workflowId: 'wf-1' }),
      })
      await advanceDebounce()
      expect(result.current.previewText).toBe('wf-1 result')

      rerender(defaultParams({ command: '@@ref', workflowId: 'wf-2' }))
      await advanceDebounce()

      expect(result.current.previewText).toBe('wf-2 result')
      expect(resolveNodePreview).toHaveBeenCalledTimes(2)
    })
  })
})
