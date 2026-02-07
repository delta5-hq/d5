import { useState, useCallback, useMemo } from 'react'
import {
  WorkflowSegmentTree,
  WorkflowTreeProvider,
  useWorkflowTreeData,
  useExecuteFromTree,
} from '@features/workflow-tree'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card'
import { Genie } from '@shared/ui/genie'
import { getCommandRole } from '@shared/constants/command-roles'
import { getColorForRole } from '@shared/ui/genie/role-colors'
import { useGenieState } from '@shared/lib/use-genie-state'
import { extractQueryTypeFromCommand } from '@shared/lib/command-querytype-mapper'
import { FileText, Folder, Loader2, Play, RefreshCw } from 'lucide-react'
import { Button } from '@shared/ui/button'

interface WorkflowProps {
  workflowId: string
}

const WorkflowContent = () => {
  const { nodes, root, isLoading, error, workflow, refetch } = useWorkflowTreeData()
  const [selectedId, setSelectedId] = useState<string | undefined>()

  const selectedNode = useMemo(() => (selectedId ? nodes[selectedId] : undefined), [selectedId, nodes])

  const workflowId = workflow?.workflowId ?? ''

  const { executeNode, isExecuting } = useExecuteFromTree({
    workflowId,
    workflowData: workflow ?? { nodes: {}, edges: {}, root: '', share: { access: [] } },
    onSuccess: refetch,
  })

  const genieState = useGenieState(selectedId ?? '')

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const handleExecute = useCallback(async () => {
    if (!selectedNode) return

    const queryType = extractQueryTypeFromCommand(selectedNode.command)
    await executeNode(selectedNode, queryType)
  }, [selectedNode, executeNode])

  const hasChildren = selectedNode?.children && selectedNode.children.length > 0
  const showHandRibs = Boolean(selectedNode?.command)
  const canExecute = selectedNode && (selectedNode.command || true)

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
          <CardTitle className="text-destructive">Error Loading Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button className="mt-4" onClick={refetch} variant="default">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!root || Object.keys(nodes).length === 0) {
    return (
      <Card className="m-4">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No workflow data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex h-full min-h-[400px] gap-4">
      <Card className="w-80 flex flex-col min-h-0">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-base">Workflow Tree</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden min-h-0">
          <WorkflowSegmentTree
            initialExpandedIds={new Set([root])}
            nodes={nodes}
            onSelect={handleSelect}
            rootId={root}
            selectedId={selectedId}
          />
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {selectedNode ? (
              <>
                {hasChildren ? (
                  <Folder className="w-4 h-4 text-amber-500" />
                ) : (
                  <FileText className="w-4 h-4 text-muted-foreground" />
                )}
                {selectedNode.title || selectedNode.id}
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 text-muted-foreground" />
                Node Details
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedNode ? (
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Node ID</span>
                    <span className="font-mono text-xs">{selectedNode.id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Title</span>
                    <span>{selectedNode.title || '—'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Command</span>
                    <span className="font-mono text-xs">{selectedNode.command || '—'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">State</span>
                    <span className="font-mono">{genieState}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Children</span>
                    <span>{selectedNode.children?.length || 0}</span>
                  </div>
                  {canExecute ? (
                    <Button className="w-full" disabled={isExecuting} onClick={handleExecute} variant="default">
                      {isExecuting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Execute Command
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
                <div className="flex-shrink-0">
                  <Genie
                    clipboardEdge="#424242"
                    clipboardFill="#ffffff"
                    color={getColorForRole(getCommandRole(selectedNode.command))}
                    showHandRibs={showHandRibs}
                    size={80}
                    state={genieState}
                  />
                </div>
              </div>
              {hasChildren ? (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground block mb-2">Child nodes:</span>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedNode.children?.map(childId => (
                      <li className="text-foreground/80" key={childId}>
                        {nodes[childId]?.title || childId}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground">Select a node from the tree to view details</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export const Workflow = ({ workflowId }: WorkflowProps) => (
  <WorkflowTreeProvider workflowId={workflowId}>
    <WorkflowContent />
  </WorkflowTreeProvider>
)
