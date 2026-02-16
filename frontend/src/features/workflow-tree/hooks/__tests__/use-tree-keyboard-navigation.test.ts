import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTreeKeyboardNavigation } from '../use-tree-keyboard-navigation'
import type { WorkflowStoreActions } from '../../store/workflow-store-types'
import type { NodeData } from '@shared/base-types'
import { createRef, type RefObject } from 'react'

vi.mock('@shared/lib/dom', () => ({
  isEditableElementFocused: vi.fn(() => false),
}))

function makeActions(): WorkflowStoreActions {
  return {
    load: vi.fn(),
    persist: vi.fn(),
    persistNow: vi.fn(),
    discard: vi.fn(),
    destroy: vi.fn(),
    select: vi.fn(),
    toggleSelect: vi.fn(),
    rangeSelect: vi.fn(),
    toggleExpanded: vi.fn(),
    expandNode: vi.fn(),
    collapseNode: vi.fn(),
    createRoot: vi.fn(),
    addChild: vi.fn(() => 'new-child'),
    addSibling: vi.fn(() => 'new-sibling'),
    addPromptChild: vi.fn(),
    removePromptChildren: vi.fn(),
    updateNode: vi.fn(),
    removeNode: vi.fn(),
    removeNodes: vi.fn(),
    moveNode: vi.fn(),
    duplicateNode: vi.fn(() => 'dup-node'),
    executeCommand: vi.fn(),
  }
}

function makeNodes(): Record<string, NodeData> {
  return {
    root: { id: 'root', children: ['n1', 'n2'] },
    n1: { id: 'n1', parent: 'root', children: ['n1a'] },
    n1a: { id: 'n1a', parent: 'n1', children: [] },
    n2: { id: 'n2', parent: 'root', children: [] },
  }
}

function makeVisibleOrderRef(order: readonly string[]): RefObject<readonly string[]> {
  return { current: order }
}

describe('useTreeKeyboardNavigation', () => {
  let containerRef: ReturnType<typeof createRef<HTMLDivElement>>

  beforeEach(() => {
    containerRef = createRef<HTMLDivElement>()
    const div = document.createElement('div')
    containerRef = { current: div }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('navigation keys', () => {
    it('ArrowDown selects next visible node', () => {
      const actions = makeActions()
      const nodes = makeNodes()
      const visibleOrder = ['root', 'n1', 'n1a', 'n2']

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(visibleOrder),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.select).toHaveBeenCalledWith('n1a')
    })

    it('ArrowUp selects previous visible node', () => {
      const actions = makeActions()
      const nodes = makeNodes()
      const visibleOrder = ['root', 'n1', 'n1a', 'n2']

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(visibleOrder),
          selectedId: 'n1a',
          selectedIds: new Set(['n1a']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.select).toHaveBeenCalledWith('n1')
    })

    it('ArrowDown does nothing at last node', () => {
      const actions = makeActions()
      const nodes = makeNodes()
      const visibleOrder = ['root', 'n1', 'n1a', 'n2']

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(visibleOrder),
          selectedId: 'n2',
          selectedIds: new Set(['n2']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.select).not.toHaveBeenCalled()
    })

    it('ArrowUp does nothing at first node', () => {
      const actions = makeActions()
      const nodes = makeNodes()
      const visibleOrder = ['root', 'n1', 'n1a', 'n2']

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(visibleOrder),
          selectedId: 'root',
          selectedIds: new Set(['root']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.select).not.toHaveBeenCalled()
    })
  })

  describe('expand/collapse keys', () => {
    it('ArrowLeft collapses selected node', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.collapseNode).toHaveBeenCalledWith('n1')
    })

    it('ArrowRight expands node with children', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.expandNode).toHaveBeenCalledWith('n1')
    })

    it('ArrowRight does nothing for leaf node', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1', 'n1a']),
          selectedId: 'n1a',
          selectedIds: new Set(['n1a']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.expandNode).not.toHaveBeenCalled()
    })
  })

  describe('node creation keys', () => {
    it('Tab creates child node', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'Tab' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.addChild).toHaveBeenCalledWith('n1', { title: '' })
      expect(actions.select).toHaveBeenCalledWith('new-child')
    })

    it('Ctrl+N creates sibling node', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true })
      containerRef.current?.dispatchEvent(event)

      expect(actions.addSibling).toHaveBeenCalledWith('n1', { title: '' })
      expect(actions.select).toHaveBeenCalledWith('new-sibling')
    })

    it('Cmd+N creates sibling node on Mac', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'n', metaKey: true })
      containerRef.current?.dispatchEvent(event)

      expect(actions.addSibling).toHaveBeenCalledWith('n1', { title: '' })
      expect(actions.select).toHaveBeenCalledWith('new-sibling')
    })

    it('Tab handles null return from addChild', () => {
      const actions = makeActions()
      vi.mocked(actions.addChild).mockReturnValueOnce(null)
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'Tab' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.select).not.toHaveBeenCalled()
    })
  })

  describe('delete keys', () => {
    it('Delete removes single selected node', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'Delete' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.removeNode).toHaveBeenCalledWith('n1')
    })

    it('Backspace removes single selected node', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'Backspace' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.removeNode).toHaveBeenCalledWith('n1')
    })

    it('Delete bulk removes multi-selection', () => {
      const actions = makeActions()
      const nodes = makeNodes()
      const selectedIds = new Set(['n1', 'n2'])

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1', 'n2']),
          selectedId: 'n2',
          selectedIds,
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'Delete' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.removeNodes).toHaveBeenCalledWith(selectedIds)
      expect(actions.removeNode).not.toHaveBeenCalled()
    })

    it('Delete ignores root node', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root']),
          selectedId: 'root',
          selectedIds: new Set(['root']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'Delete' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.removeNode).not.toHaveBeenCalled()
    })

    it('Delete ignores executing nodes', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(['n1']),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'Delete' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.removeNode).not.toHaveBeenCalled()
    })
  })

  describe('other keys', () => {
    it('Escape clears selection', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.select).toHaveBeenCalledWith(undefined)
    })

    it('Ctrl+D duplicates selected node', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true })
      containerRef.current?.dispatchEvent(event)

      expect(actions.duplicateNode).toHaveBeenCalledWith('n1')
      expect(actions.select).toHaveBeenCalledWith('dup-node')
    })

    it('Cmd+D duplicates on Mac', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'd', metaKey: true })
      containerRef.current?.dispatchEvent(event)

      expect(actions.duplicateNode).toHaveBeenCalledWith('n1')
    })

    it('Ctrl+D handles null return from duplicate', () => {
      const actions = makeActions()
      vi.mocked(actions.duplicateNode).mockReturnValueOnce(null)
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true })
      containerRef.current?.dispatchEvent(event)

      expect(actions.select).not.toHaveBeenCalled()
    })
  })

  describe('edge cases and guards', () => {
    it('does nothing when no node selected', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: undefined,
          selectedIds: new Set(),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.select).not.toHaveBeenCalled()
    })

    it('does nothing when selected node missing from nodes', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'ghost',
          selectedIds: new Set(['ghost']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'Tab' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.addChild).not.toHaveBeenCalled()
    })

    it('does nothing when disabled', () => {
      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
          enabled: false,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'Delete' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.removeNode).not.toHaveBeenCalled()
    })

    it('does nothing when editable element focused', async () => {
      const { isEditableElementFocused } = await import('@shared/lib/dom')
      vi.mocked(isEditableElementFocused).mockReturnValueOnce(true)

      const actions = makeActions()
      const nodes = makeNodes()

      renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      const event = new KeyboardEvent('keydown', { key: 'Delete' })
      containerRef.current?.dispatchEvent(event)

      expect(actions.removeNode).not.toHaveBeenCalled()
    })

    it('handles missing container ref gracefully', () => {
      const actions = makeActions()
      const nodes = makeNodes()
      const nullRef = { current: null }

      expect(() =>
        renderHook(() =>
          useTreeKeyboardNavigation({
            nodes,
            visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
            selectedId: 'n1',
            selectedIds: new Set(['n1']),
            executingNodeIds: new Set(),
            actions,
            containerRef: nullRef,
          }),
        ),
      ).not.toThrow()
    })

    it('cleans up event listener on unmount', () => {
      const actions = makeActions()
      const nodes = makeNodes()
      const removeEventListenerSpy = vi.spyOn(containerRef.current!, 'removeEventListener')

      const { unmount } = renderHook(() =>
        useTreeKeyboardNavigation({
          nodes,
          visibleOrderRef: makeVisibleOrderRef(['root', 'n1']),
          selectedId: 'n1',
          selectedIds: new Set(['n1']),
          executingNodeIds: new Set(),
          actions,
          containerRef,
        }),
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })
})
