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
  onRequestEdit?: (nodeId: NodeId) => void
  onRequestDelete?: (nodeId: NodeId) => void
  onRequestDeleteMultiple?: (nodeIds: Set<NodeId>) => void
  onRequestWrap?: (nodeIds: Set<NodeId>) => void
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
  onRequestEdit,
  onRequestDelete,
  onRequestDeleteMultiple,
  onRequestWrap,
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

          const hasAnyChildren = Array.from(selectedIds).some(id => {
            const node = nodes[id]
            return node?.children?.length
          })

          if (hasAnyChildren && onRequestDeleteMultiple) {
            onRequestDeleteMultiple(selectedIds)
          } else {
            actions.removeNodes(selectedIds)
          }
          return
        }

        if (selectedId) {
          const node = nodes[selectedId]
          if (node?.parent && !executingNodeIds.has(selectedId)) {
            event.preventDefault()
            if (node.children?.length && onRequestDelete) {
              onRequestDelete(selectedId)
            } else {
              actions.removeNode(selectedId)
            }
          }
        }
        return
      }

      if (isCtrl && key.toLowerCase() === 'z') {
        event.preventDefault()
        actions.undo()
        return
      }

      if (isCtrl && key.toLowerCase() === 'y') {
        event.preventDefault()
        actions.redo()
        return
      }

      if (isCtrl && key.toLowerCase() === 'w' && selectedIds.size > 0) {
        event.preventDefault()
        const toWrap = selectedIds.size > 1 ? selectedIds : selectedId ? new Set([selectedId]) : undefined
        if (toWrap) onRequestWrap?.(toWrap)
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
          actions.expandNode(selectedId)
          actions.select(newId)
          onRequestEdit?.(newId)
        }
        return
      }

      if (isCtrl && key.toLowerCase() === 'n') {
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

      if (key === 'Enter') {
        event.preventDefault()
        onRequestEdit?.(selectedId)
        return
      }
    },
    [
      enabled,
      nodes,
      visibleOrderRef,
      selectedId,
      selectedIds,
      executingNodeIds,
      actions,
      onRequestEdit,
      onRequestDelete,
      onRequestDeleteMultiple,
      onRequestWrap,
    ],
  )

  useEffect(() => {
    if (!enabled) return

    const container = containerRef.current
    if (!container) return

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled, containerRef])
}
