import { useCallback, useEffect, type RefObject } from 'react'
import type { NodeData, NodeId } from '@shared/base-types'
import { isEditableElementFocused } from '@shared/lib/dom'
import type { WorkflowStoreActions } from '../store/workflow-store-types'

export interface UseTreeKeyboardNavigationOptions {
  nodes: Record<NodeId, NodeData>
  visibleOrderRef: RefObject<readonly NodeId[]>
  selectedId: NodeId | undefined
  selectedIds: Set<NodeId>
  executingNodeIds: Set<NodeId>
  actions: WorkflowStoreActions
  containerRef: RefObject<HTMLElement | null>
  enabled?: boolean
}

export function useTreeKeyboardNavigation({
  nodes,
  visibleOrderRef,
  selectedId,
  selectedIds,
  executingNodeIds,
  actions,
  containerRef,
  enabled = true,
}: UseTreeKeyboardNavigationOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || isEditableElementFocused()) return

      const visibleOrder = visibleOrderRef.current
      const isCtrl = event.ctrlKey || event.metaKey
      const key = event.key

      if (key === 'Delete' || key === 'Backspace') {
        if (selectedIds.size > 1) {
          event.preventDefault()
          actions.removeNodes(selectedIds)
          return
        }

        if (selectedId) {
          const node = nodes[selectedId]
          if (node?.parent && !executingNodeIds.has(selectedId)) {
            event.preventDefault()
            actions.removeNode(selectedId)
          }
        }
        return
      }

      if (!selectedId) return
      const selectedNode = nodes[selectedId]
      if (!selectedNode) return

      if (key === 'ArrowUp') {
        event.preventDefault()
        const currentIndex = visibleOrder.indexOf(selectedId)
        if (currentIndex > 0) {
          actions.select(visibleOrder[currentIndex - 1])
        }
        return
      }

      if (key === 'ArrowDown') {
        event.preventDefault()
        const currentIndex = visibleOrder.indexOf(selectedId)
        if (currentIndex >= 0 && currentIndex < visibleOrder.length - 1) {
          actions.select(visibleOrder[currentIndex + 1])
        }
        return
      }

      if (key === 'ArrowLeft') {
        event.preventDefault()
        actions.collapseNode(selectedId)
        return
      }

      if (key === 'ArrowRight') {
        event.preventDefault()
        if (selectedNode.children?.length) {
          actions.expandNode(selectedId)
        }
        return
      }

      if (key === 'Tab') {
        event.preventDefault()
        const newId = actions.addChild(selectedId, { title: '' })
        if (newId) {
          actions.select(newId)
        }
        return
      }

      if (key === 'Enter') {
        event.preventDefault()
        const newId = actions.addSibling(selectedId, { title: '' })
        if (newId) {
          actions.select(newId)
        }
        return
      }

      if (key === 'Escape') {
        event.preventDefault()
        actions.select(undefined)
        return
      }

      if (isCtrl && key.toLowerCase() === 'd') {
        event.preventDefault()
        const newId = actions.duplicateNode(selectedId)
        if (newId) {
          actions.select(newId)
        }
        return
      }
    },
    [enabled, nodes, visibleOrderRef, selectedId, selectedIds, executingNodeIds, actions],
  )

  useEffect(() => {
    if (!enabled) return

    const container = containerRef.current
    if (!container) return

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled, containerRef])
}
