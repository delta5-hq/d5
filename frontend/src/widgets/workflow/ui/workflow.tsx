import { useState, useCallback, useMemo } from 'react'
import {
  WorkflowSegmentTree,
  WorkflowStoreProvider,
  useWorkflowSelectedId,
  useWorkflowNode,
  useWorkflowNodes,
  useWorkflowRoot,
  useWorkflowActions,
  useWorkflowStatus,
  useWorkflowIsDirty,
} from '@features/workflow-tree'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { FormattedMessage, useIntl } from 'react-intl'
import { getDescendantIds, normalizeNodeTitle } from '@entities/workflow/lib'
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
  const { isLoading, error, isSaving, isExecuting } = useWorkflowStatus()
  const isDirty = useWorkflowIsDirty()
  const { formatMessage } = useIntl()

  const selectedId = useWorkflowSelectedId()
  const selectedNode = useWorkflowNode(selectedId)
  const [autoEditNodeId, setAutoEditNodeId] = useState<string | undefined>()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | undefined>()

  const pendingDeleteNode = useMemo(
    () => (pendingDeleteId ? nodes[pendingDeleteId] : undefined),
    [pendingDeleteId, nodes],
  )
  const pendingDescendantCount = useMemo(
    () => (pendingDeleteId ? getDescendantIds(nodes, pendingDeleteId).length : 0),
    [pendingDeleteId, nodes],
  )

  const handleSelect = useCallback(
    (id: string) => {
      actions.select(id)
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

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const newId = actions.duplicateNode(nodeId)
      if (newId) {
        actions.select(newId)
        setAutoEditNodeId(newId)
      }
    },
    [actions],
  )

  const handleExecute = useCallback(
    async (node: Parameters<typeof actions.executeCommand>[0], queryType: string) => {
      await actions.executeCommand(node, queryType)
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

  if (!root || Object.keys(nodes).length === 0) {
    return <EmptyWorkflowView onCreateRoot={handleCreateRoot} />
  }

  return (
    <div className="flex h-full min-h-[400px] gap-4 p-4">
      <Card className="w-80 flex flex-col min-h-0">
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
            initialExpandedIds={new Set([root])}
            nodes={nodes}
            onAddChild={handleAddChild}
            onDuplicateNode={handleDuplicateNode}
            onRename={handleRename}
            onRequestDelete={handleRequestDelete}
            onRequestRename={handleRequestRename}
            onSelect={handleSelect}
            rootId={root}
            selectedId={selectedId}
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
              autoFocusTitle={autoEditNodeId === selectedId}
              isExecuting={isExecuting}
              key={selectedNode.id}
              node={selectedNode}
              nodes={nodes}
              onAddChild={handleAddChild}
              onDuplicateNode={handleDuplicateNode}
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
