import { useState, useCallback, useEffect, useMemo, useRef, type MouseEvent } from 'react'
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
} from '@features/workflow-tree'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { FormattedMessage, useIntl } from 'react-intl'
import { getDescendantIds, normalizeNodeTitle, hasUsableRoot } from '@entities/workflow/lib'
import { useClickOutside } from '@shared/lib/hooks'
import { matchesAnyCommandWithOrder } from '@shared/lib/command-validation'
import { extractQueryTypeFromCommand } from '@shared/lib/command-querytype-mapper'
import { EmptyWorkflowView } from './empty-workflow-view'
import { DirtyIndicator } from './dirty-indicator'
import { NodeDetailPanel } from './node-detail-panel'
import { DeleteConfirmDialog } from './delete-confirm-dialog'

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

  const selectedId = useWorkflowSelectedId()
  const selectedIds = useWorkflowSelectedIds()
  const selectedNode = useWorkflowNode(selectedId)
  const isSelectedNodeExecuting = useIsNodeExecuting(selectedId)
  const isSelectedNodePrompt = useIsPromptNode(selectedId)
  const executingNodeIds = useWorkflowExecutingNodeIds()
  const [autoEditNodeId, setAutoEditNodeId] = useState<string | undefined>()
  const [autoFocusCommandNodeId, setAutoFocusCommandNodeId] = useState<string | undefined>()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | undefined>()
  const [flashNodeId, setFlashNodeId] = useState<string | undefined>()

  useEffect(() => {
    if (flashNodeId) setFlashNodeId(undefined)
  }, [flashNodeId])

  useEffect(() => {
    if (autoFocusCommandNodeId) setAutoFocusCommandNodeId(undefined)
  }, [autoFocusCommandNodeId])

  const hasValidCommand = useMemo(() => {
    if (!selectedNode?.command?.trim()) return false
    return matchesAnyCommandWithOrder(selectedNode.command)
  }, [selectedNode?.command])
  const visibleOrderRef = useRef<readonly string[]>([])
  const treeContainerRef = useRef<HTMLDivElement>(null)
  const workspaceContainerRef = useRef<HTMLDivElement>(null)

  const handleVisibleOrderChange = useCallback((order: readonly string[]) => {
    visibleOrderRef.current = order
  }, [])

  const handleClickOutside = useCallback(() => {
    if (selectedId !== undefined && !pendingDeleteId) {
      actions.select(undefined)
    }
  }, [selectedId, pendingDeleteId, actions])

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
    (nodeId: string) => {
      const newId = actions.addSibling(nodeId, { title: '' })
      if (newId) {
        actions.select(newId)
        setAutoEditNodeId(newId)
        setFlashNodeId(newId)
      }
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

  const handleRequestDelete = useCallback((nodeId: string) => {
    setPendingDeleteId(nodeId)
  }, [])

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

  const handleDirectDelete = useCallback(
    (nodeId: string) => {
      actions.removeNode(nodeId)
    },
    [actions],
  )

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

  const handleCloseDetailPanel = useCallback(() => {
    actions.select(undefined)
  }, [actions])

  const handleExecute = useCallback(
    async (node: Parameters<typeof actions.executeCommand>[0], queryType: string) => {
      await actions.executeCommand(node, queryType)
    },
    [actions],
  )

  const handleAbort = useCallback(
    (nodeId: string) => {
      actions.abortExecution(nodeId)
    },
    [actions],
  )

  const handleEnterInCommand = useCallback(
    (nodeId: string) => {
      const node = nodes[nodeId]
      if (!node) return
      const queryType = extractQueryTypeFromCommand(node.command)
      void actions.executeCommand(node, queryType)
      const newId = actions.addSibling(nodeId, { title: '' })
      if (newId) {
        actions.select(newId)
        setAutoFocusCommandNodeId(newId)
        setFlashNodeId(newId)
      }
    },
    [actions, nodes],
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
    <div className="flex h-full min-h-[400px] gap-4 p-4" ref={workspaceContainerRef}>
      <Card
        className="w-80 flex flex-col min-h-0 focus:outline-none"
        data-testid="workflow-tree-panel"
        ref={treeContainerRef}
        tabIndex={0}
      >
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
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
            onDirectDelete={handleDirectDelete}
            onDuplicateNode={handleDuplicateNode}
            onRename={handleRename}
            onRequestDelete={handleRequestDelete}
            onRequestRename={handleRequestRename}
            onSelect={handleSelect}
            onVisibleOrderChange={handleVisibleOrderChange}
            rootId={root}
            selectedIds={selectedIds}
          />
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            <FormattedMessage id="workflowTree.nodeDetails" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedNode ? (
            <NodeDetailPanel
              autoFocusCommand={autoFocusCommandNodeId === selectedId}
              autoFocusTitle={autoEditNodeId === selectedId}
              executeDisabled={isSelectedNodeExecuting || !hasValidCommand}
              isExecuting={isSelectedNodeExecuting}
              isPrompt={isSelectedNodePrompt}
              key={selectedNode.id}
              node={selectedNode}
              onAbort={handleAbort}
              onAddChild={handleAddChild}
              onAddSibling={handleAddSibling}
              onClose={handleCloseDetailPanel}
              onDuplicateNode={handleDuplicateNode}
              onEnterInCommand={handleEnterInCommand}
              onExecute={handleExecute}
              onRequestDelete={handleRequestDelete}
              onUpdateNode={handleUpdateNode}
            />
          ) : (
            <p className="text-muted-foreground">
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
    </div>
  )
}
