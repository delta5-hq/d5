import { useState, useCallback, useEffect, useMemo, useRef, type DragEvent, type MouseEvent } from 'react'
import type { NodeId } from '@shared/base-types'
import {
  WorkflowSegmentTree,
  WorkflowStoreProvider,
  useWorkflowSelectedId,
  useWorkflowSelectedIds,
  useWorkflowNode,
  useWorkflowNodes,
  useWorkflowRoot,
  useWorkflowActions,
  useWorkflowStatus,
  useWorkflowIsDirty,
  useIsNodeExecuting,
  useIsPromptNode,
  useTreeKeyboardNavigation,
  useWorkflowExecutingNodeIds,
  type TreeDropPosition,
  getTreeMoveRequest,
} from '@features/workflow-tree'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { FormattedMessage, useIntl } from 'react-intl'
import { getDescendantIds, normalizeNodeTitle, hasUsableRoot } from '@entities/workflow/lib'
import { useClickOutside } from '@shared/lib/hooks'
import { matchesAnyCommandWithOrder } from '@shared/lib/command-validation'
import { deriveNodeTitle } from '@shared/lib/reliability-suffix'
import { extractQueryTypeFromCommand } from '@shared/lib/command-querytype-mapper'
import { useAliases } from '@entities/aliases'
import { toast } from 'sonner'
import { useViewportBreakpoint } from '@shared/composables/use-viewport-breakpoint'
import { EmptyWorkflowView } from './empty-workflow-view'
import { DirtyIndicator } from './dirty-indicator'
import { NodeDetailPanel } from './node-detail-panel'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { resolveWorkflowFileDropParentId } from '../lib/file-drop-target'

interface WorkflowProps {
  workflowId: string
}

export const Workflow = ({ workflowId }: WorkflowProps) => (
  <WorkflowStoreProvider workflowId={workflowId}>
    <WorkflowContent />
  </WorkflowStoreProvider>
)

const WorkflowContent = () => {
  const nodes = useWorkflowNodes()
  const root = useWorkflowRoot()
  const actions = useWorkflowActions()
  const { isLoading, error, isSaving } = useWorkflowStatus()
  const isDirty = useWorkflowIsDirty()
  const { formatMessage } = useIntl()
  const { aliases } = useAliases()
  const isMobile = useViewportBreakpoint()

  const selectedId = useWorkflowSelectedId()
  const selectedIds = useWorkflowSelectedIds()
  const selectedNode = useWorkflowNode(selectedId)
  const isSelectedNodeExecuting = useIsNodeExecuting(selectedId)
  const isSelectedNodePrompt = useIsPromptNode(selectedId)
  const executingNodeIds = useWorkflowExecutingNodeIds()
  const [autoEditNodeId, setAutoEditNodeId] = useState<string | undefined>()
  const [autoFocusCommandNodeId, setAutoFocusCommandNodeId] = useState<string | undefined>()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | undefined>()
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<NodeId>>(new Set())
  const [flashNodeId, setFlashNodeId] = useState<string | undefined>()

  useEffect(() => {
    if (flashNodeId) setFlashNodeId(undefined)
  }, [flashNodeId])

  useEffect(() => {
    if (autoFocusCommandNodeId) setAutoFocusCommandNodeId(undefined)
  }, [autoFocusCommandNodeId])

  const visibleOrderRef = useRef<readonly string[]>([])
  const treeContainerRef = useRef<HTMLDivElement>(null)
  const workspaceContainerRef = useRef<HTMLDivElement>(null)

  const handleVisibleOrderChange = useCallback((order: readonly string[]) => {
    visibleOrderRef.current = order
  }, [])

  const handleClickOutside = useCallback(() => {
    if (selectedId !== undefined && !pendingDeleteId && pendingDeleteIds.size === 0) {
      actions.select(undefined)
    }
  }, [selectedId, pendingDeleteId, pendingDeleteIds, actions])

  useTreeKeyboardNavigation({
    nodes,
    visibleOrderRef,
    selectedId,
    selectedIds,
    executingNodeIds,
    actions,
    containerRef: treeContainerRef,
    enabled: hasUsableRoot(root, nodes),
    onRequestEdit: setAutoEditNodeId,
    onRequestDelete: setPendingDeleteId,
    onRequestDeleteMultiple: setPendingDeleteIds,
    onRequestWrap: nodeIds => {
      const newId = actions.wrapNodes(nodeIds)
      if (newId) setFlashNodeId(newId)
    },
  })

  useClickOutside({
    ref: workspaceContainerRef,
    onClickOutside: handleClickOutside,
    enabled: hasUsableRoot(root, nodes),
  })

  const pendingDeleteNode = useMemo(
    () => (pendingDeleteId ? nodes[pendingDeleteId] : undefined),
    [pendingDeleteId, nodes],
  )
  const pendingDescendantCount = useMemo(
    () => (pendingDeleteId ? getDescendantIds(nodes, pendingDeleteId).length : 0),
    [pendingDeleteId, nodes],
  )

  const pendingDeleteMultipleDescendantCount = useMemo(() => {
    if (pendingDeleteIds.size === 0) return 0
    return Array.from(pendingDeleteIds).reduce((total, id) => total + getDescendantIds(nodes, id).length, 0)
  }, [pendingDeleteIds, nodes])

  const handleSelect = useCallback(
    (id: string, _node: unknown, event?: MouseEvent) => {
      if (event?.shiftKey) {
        actions.rangeSelect(id, visibleOrderRef.current)
      } else if (event && (event.ctrlKey || event.metaKey)) {
        actions.toggleSelect(id)
      } else {
        actions.select(id)
      }
      setAutoEditNodeId(undefined)
    },
    [actions],
  )

  const handleCreateRoot = useCallback(() => {
    const newId = actions.createRoot({ title: formatMessage({ id: 'workflowTree.rootNodeDefault' }) })
    if (newId) {
      actions.select(newId)
      setAutoEditNodeId(newId)
    }
  }, [actions, formatMessage])

  const handleAddChild = useCallback(
    (parentId: string) => {
      const newId = actions.addChild(parentId, { title: '' })
      if (newId) {
        actions.select(newId)
        setAutoEditNodeId(newId)
        setFlashNodeId(newId)
      }
    },
    [actions],
  )

  const handleAddSibling = useCallback(
    (nodeId: string): string | null => {
      const newId = actions.addSibling(nodeId, { title: '' })
      if (newId) {
        actions.select(newId)
        setAutoEditNodeId(newId)
        setFlashNodeId(newId)
      }
      return newId
    },
    [actions],
  )

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Parameters<typeof actions.updateNode>[1]) => {
      actions.updateNode(nodeId, updates)
    },
    [actions],
  )

  const handleRename = useCallback(
    (nodeId: string, newTitle: string) => {
      actions.updateNode(nodeId, { title: newTitle })
    },
    [actions],
  )

  const handleDelete = useCallback(
    (nodeId: string) => {
      const node = nodes[nodeId]
      if (node?.children?.length) {
        setPendingDeleteId(nodeId)
      } else {
        actions.removeNode(nodeId)
      }
    },
    [actions, nodes],
  )

  const handleRequestRename = useCallback(
    (nodeId: string) => {
      actions.select(nodeId)
      setAutoEditNodeId(nodeId)
    },
    [actions],
  )

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteId) return
    actions.removeNode(pendingDeleteId)
    setPendingDeleteId(undefined)
  }, [actions, pendingDeleteId])

  const handleConfirmDeleteMultiple = useCallback(() => {
    if (pendingDeleteIds.size === 0) return
    actions.removeNodes(pendingDeleteIds)
    setPendingDeleteIds(new Set())
  }, [actions, pendingDeleteIds])

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const newId = actions.duplicateNode(nodeId)
      if (newId) {
        actions.select(newId)
        setAutoEditNodeId(newId)
        setFlashNodeId(newId)
      }
    },
    [actions],
  )

  const handleWrapNodes = useCallback(
    (nodeId: string) => {
      const toWrap = selectedIds.size > 1 && selectedIds.has(nodeId) ? selectedIds : new Set([nodeId])
      const newId = actions.wrapNodes(toWrap)
      if (newId) setFlashNodeId(newId)
    },
    [actions, selectedIds],
  )

  const handleMoveNode = useCallback(
    (nodeId: string, targetNodeId: string, position: TreeDropPosition) => {
      const request = getTreeMoveRequest(nodes, nodeId, targetNodeId, position)
      if (!request) return

      const moved = actions.moveNode(request.nodeId, request.parentId, request.insertionIndex)
      if (!moved) return

      actions.select(request.nodeId)
      if (request.expandTargetId) actions.expandNode(request.expandTargetId)
      void actions.persistNow()
    },
    [actions, nodes],
  )

  const handleDropFiles = useCallback(
    (parentId: string, files: FileList) => {
      void (async () => {
        let lastNodeId: string | null = null
        for (const file of Array.from(files)) {
          lastNodeId = await actions.attachFileChild(parentId, file)
        }
        if (lastNodeId) setFlashNodeId(lastNodeId)
      })().catch(error => {
        toast.error(error instanceof Error ? error.message : 'Failed to attach file')
      })
    },
    [actions],
  )

  const hasDraggedFiles = (event: DragEvent<HTMLElement>): boolean =>
    Array.from(event.dataTransfer.types).includes('Files')

  const getFileDropParentId = useCallback(
    (event: DragEvent<HTMLElement>): string | undefined =>
      resolveWorkflowFileDropParentId({
        eventTarget: event.target instanceof Element ? event.target : undefined,
        pointTarget: document.elementFromPoint(event.clientX, event.clientY),
        rootId: root,
        hasNode: nodeId => Boolean(nodes[nodeId]),
      }),
    [nodes, root],
  )

  const handleTreePanelDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!root || !hasDraggedFiles(event)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    [root],
  )

  const handleTreePanelDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!root || event.dataTransfer.files.length === 0) return
      event.preventDefault()
      const parentId = getFileDropParentId(event)
      if (!parentId) return
      handleDropFiles(parentId, event.dataTransfer.files)
    },
    [getFileDropParentId, handleDropFiles, root],
  )

  const handleCloseDetailPanel = useCallback(() => {
    actions.select(undefined)
  }, [actions])

  const handleExecute = useCallback(
    (node: Parameters<typeof actions.executeCommand>[0], queryType: string): Promise<boolean> =>
      actions.executeCommand(node, queryType),
    [actions],
  )

  const handleAbort = useCallback(
    (nodeId: string) => {
      actions.abortExecution(nodeId)
    },
    [actions],
  )

  const handleEnterInCommand = useCallback(
    (nodeId: string, committedCommand: string) => {
      const node = nodes[nodeId]
      if (!node) return
      if (!matchesAnyCommandWithOrder(committedCommand, aliases)) return
      const queryType = extractQueryTypeFromCommand(committedCommand, aliases)
      void actions.executeCommand(
        { ...node, command: committedCommand, title: deriveNodeTitle(node, committedCommand) },
        queryType,
      )
    },
    [actions, nodes, aliases],
  )

  const handleCtrlEnterInCommand = useCallback(
    (nodeId: string, committedCommand: string) => {
      const node = nodes[nodeId]
      if (!node) return
      const isExecutable = matchesAnyCommandWithOrder(committedCommand, aliases)
      if (isExecutable) {
        const queryType = extractQueryTypeFromCommand(committedCommand, aliases)
        void actions.executeCommand(
          { ...node, command: committedCommand, title: deriveNodeTitle(node, committedCommand) },
          queryType,
        )
      }
      const newId = actions.addSibling(nodeId, { title: '' })
      if (newId) {
        actions.select(newId)
        setAutoFocusCommandNodeId(newId)
        setFlashNodeId(newId)
      }
    },
    [actions, nodes, aliases],
  )

  const handleShiftCtrlEnterInCommand = useCallback(
    (nodeId: string, _committedCommand: string) => {
      const newId = actions.addSibling(nodeId, { title: '' })
      if (newId) {
        actions.select(newId)
        setAutoFocusCommandNodeId(newId)
        setFlashNodeId(newId)
      }
    },
    [actions],
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="m-4">
        <CardHeader>
          <CardTitle className="text-destructive">
            <FormattedMessage id="workflowTree.errorTitle" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button className="mt-4" onClick={() => actions.load()} variant="default">
            <RefreshCw className="mr-2 h-4 w-4" />
            <FormattedMessage id="workflowTree.retry" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!hasUsableRoot(root, nodes)) {
    return <EmptyWorkflowView onCreateRoot={handleCreateRoot} />
  }

  return (
    <div
      className="flex h-full min-h-[25rem] min-w-0 flex-col gap-3 overflow-y-auto p-2 md:flex-row md:gap-4 md:overflow-hidden md:p-4"
      ref={workspaceContainerRef}
    >
      <Card
        className="workflow-editor-panel workflow-editor-panel--tree relative flex h-[68svh] min-h-72 max-h-[calc(100svh-8rem)] w-full min-w-0 shrink-0 flex-col border-muted-foreground/15 bg-card/95 shadow-none focus:outline-none md:h-auto md:min-h-0 md:max-h-none md:w-[32rem] xl:w-[34rem]"
        data-testid="workflow-tree-panel"
        onDragOver={handleTreePanelDragOver}
        onDrop={handleTreePanelDrop}
        ref={treeContainerRef}
        tabIndex={0}
      >
        <CardHeader className="workflow-editor-panel-header flex-shrink-0 border-b border-muted-foreground/10 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="workflow-panel-title font-mono text-sm font-bold uppercase tracking-[0.08em]">
              <FormattedMessage id="workflowTree.title" />
            </CardTitle>
            <DirtyIndicator isDirty={isDirty} isSaving={isSaving} />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden min-h-0">
          <WorkflowSegmentTree
            autoEditNodeId={autoEditNodeId}
            flashNodeId={flashNodeId}
            nodes={nodes}
            onAddChild={handleAddChild}
            onDelete={handleDelete}
            onDropFiles={handleDropFiles}
            onDuplicateNode={handleDuplicateNode}
            onMoveNode={handleMoveNode}
            onRename={handleRename}
            onRequestRename={handleRequestRename}
            onSelect={handleSelect}
            onVisibleOrderChange={handleVisibleOrderChange}
            onWrapNodes={handleWrapNodes}
            rootId={root}
            selectedIds={selectedIds}
            showCheckboxes={isMobile}
          />
        </CardContent>
      </Card>

      <Card className="workflow-editor-panel relative min-w-0 flex-1 border-muted-foreground/15 bg-card/95 shadow-none">
        <CardHeader className="workflow-editor-panel-header border-b border-muted-foreground/10 pb-2">
          <CardTitle className="workflow-panel-title font-mono text-sm font-bold uppercase tracking-[0.08em]">
            <FormattedMessage id="workflowTree.nodeDetails" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedNode ? (
            <NodeDetailPanel
              autoFocusCommand={autoFocusCommandNodeId === selectedId}
              autoFocusTitle={false}
              executeDisabled={isSelectedNodeExecuting}
              isExecuting={isSelectedNodeExecuting}
              isPrompt={isSelectedNodePrompt}
              key={selectedNode.id}
              node={selectedNode}
              onAbort={handleAbort}
              onAddChild={handleAddChild}
              onAddSibling={handleAddSibling}
              onClose={handleCloseDetailPanel}
              onCtrlEnterInCommand={handleCtrlEnterInCommand}
              onDelete={handleDelete}
              onDuplicateNode={handleDuplicateNode}
              onEnterInCommand={handleEnterInCommand}
              onExecute={handleExecute}
              onShiftCtrlEnterInCommand={handleShiftCtrlEnterInCommand}
              onUpdateNode={handleUpdateNode}
            />
          ) : (
            <p className="workflow-empty-panel-callout rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/35 px-4 py-5 text-sm text-muted-foreground">
              <FormattedMessage id="workflowTree.selectNode" />
            </p>
          )}
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        descendantCount={pendingDescendantCount}
        nodeTitle={normalizeNodeTitle(pendingDeleteNode?.title)}
        onConfirm={handleConfirmDelete}
        onOpenChange={open => {
          if (!open) setPendingDeleteId(undefined)
        }}
        open={Boolean(pendingDeleteId)}
      />

      <DeleteConfirmDialog
        descendantCount={pendingDeleteMultipleDescendantCount}
        nodeCount={pendingDeleteIds.size}
        onConfirm={handleConfirmDeleteMultiple}
        onOpenChange={open => {
          if (!open) setPendingDeleteIds(new Set())
        }}
        open={pendingDeleteIds.size > 0}
      />
    </div>
  )
}
