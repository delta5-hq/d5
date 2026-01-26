import { useState, useCallback } from 'react'
import { WorkflowTree } from '@/features/workflow-tree'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card'
import { FileText, Folder, Layers } from 'lucide-react'
import type { NodeData } from '@/shared/base-types/workflow'

const mockNodes: Record<string, NodeData> = {
  root: { id: 'root', title: 'Project Alpha', children: ['requirements', 'design', 'development', 'testing'] },
  requirements: { id: 'requirements', title: 'Requirements', children: ['req-1', 'req-2', 'req-3'] },
  'req-1': { id: 'req-1', title: 'User Stories', children: [] },
  'req-2': { id: 'req-2', title: 'Technical Specs', children: [] },
  'req-3': { id: 'req-3', title: 'Acceptance Criteria', children: [] },
  design: { id: 'design', title: 'Design', children: ['design-1', 'design-2'] },
  'design-1': { id: 'design-1', title: 'UI Mockups', children: ['design-1-1'] },
  'design-1-1': { id: 'design-1-1', title: 'Mobile Wireframes', children: [] },
  'design-2': { id: 'design-2', title: 'Architecture Diagram', children: [] },
  development: { id: 'development', title: 'Development', children: ['dev-1', 'dev-2', 'dev-3'] },
  'dev-1': { id: 'dev-1', title: 'Backend API', children: [] },
  'dev-2': { id: 'dev-2', title: 'Frontend UI', children: [] },
  'dev-3': { id: 'dev-3', title: 'Database Schema', children: [] },
  testing: { id: 'testing', title: 'Testing', children: ['test-1', 'test-2'] },
  'test-1': { id: 'test-1', title: 'Unit Tests', children: [] },
  'test-2': { id: 'test-2', title: 'E2E Tests', children: [] },
}

export const Workflow = () => {
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [selectedNode, setSelectedNode] = useState<NodeData | undefined>()

  const handleSelect = useCallback((id: string, node: NodeData) => {
    setSelectedId(id)
    setSelectedNode(node)
  }, [])

  const hasChildren = selectedNode?.children && selectedNode.children.length > 0

  return (
    <div className="flex h-full min-h-[400px] gap-4">
      {/* Tree panel */}
      <Card className="w-80 flex flex-col min-h-0">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Project Alpha
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden min-h-0">
          <WorkflowTree
            initialExpandedIds={new Set(['root', 'requirements', 'design', 'development', 'testing', 'design-1'])}
            nodes={mockNodes}
            onSelect={handleSelect}
            rootId="root"
            selectedId={selectedId}
          />
        </CardContent>
      </Card>

      {/* Detail panel - data-bound to selection */}
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
                No Selection
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedNode ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono">{selectedNode.id}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Title</span>
                <span>{selectedNode.title || '—'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Children</span>
                <span>{selectedNode.children?.length || 0}</span>
              </div>
              {hasChildren ? (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground block mb-2">Child nodes:</span>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedNode.children?.map(childId => (
                      <li className="text-foreground/80" key={childId}>
                        {mockNodes[childId]?.title || childId}
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
