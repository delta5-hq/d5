import { useState, useCallback, useRef, useEffect } from 'react'
import { WorkflowSegmentTree } from '@/features/workflow-tree'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card'
import { Genie, type GenieRef, type GenieState } from '@shared/ui/genie'
import { genieStateStore } from '@shared/lib/genie-state-store'
import { FileText, Folder, Layers, Zap } from 'lucide-react'
import type { NodeData } from '@/shared/base-types/workflow'

/* Hand colors mapped to ROLE (command) per Issue #336 */
const ROLE_HAND_COLORS: Record<string, string> = {
  '/instruct': '#ffa726', // Orange
  '/reason': '#66bb6a', // Green
  '/web': '#42a5f5', // Blue
  '/scholar': '#ab47bc', // Purple
  '/refine': '#ef5350', // Red
  '/foreach': '#26c6da', // Cyan
}
const DEFAULT_HAND_COLOR = '#9e9e9e' // Gray for nodes without command

function getHandColorFromRole(command?: string): string {
  if (!command) return DEFAULT_HAND_COLOR
  return ROLE_HAND_COLORS[command] || DEFAULT_HAND_COLOR
}

/* Extended node data with genie state for demo */
interface DemoNodeData extends NodeData {
  genieState?: GenieState
}

const COMMANDS = ['/instruct', '/reason', '/web', '/scholar', '/refine', '/foreach'] as const
const STATES: GenieState[] = ['idle', 'busy', 'busy-alert', 'done-success', 'done-failure']

function generateLargeTree(): Record<string, DemoNodeData> {
  const nodes: Record<string, DemoNodeData> = {}
  const rootChildren: string[] = []

  for (let phase = 1; phase <= 10; phase++) {
    const phaseId = `phase-${phase}`
    rootChildren.push(phaseId)
    const phaseChildren: string[] = []

    for (let task = 1; task <= 5; task++) {
      const taskId = `${phaseId}-task-${task}`
      phaseChildren.push(taskId)
      const taskChildren: string[] = []

      for (let sub = 1; sub <= 5; sub++) {
        const subId = `${taskId}-sub-${sub}`
        taskChildren.push(subId)
        nodes[subId] = {
          id: subId,
          title: `Subtask ${phase}.${task}.${sub}`,
          children: [],
          genieState: STATES[(phase + task + sub) % STATES.length],
          command: COMMANDS[(phase + task + sub) % COMMANDS.length],
        }
      }

      nodes[taskId] = {
        id: taskId,
        title: `Task ${phase}.${task}`,
        children: taskChildren,
        genieState: STATES[(phase + task) % STATES.length],
        command: COMMANDS[(phase + task) % COMMANDS.length],
      }
    }

    nodes[phaseId] = {
      id: phaseId,
      title: `Phase ${phase}`,
      children: phaseChildren,
      genieState: STATES[phase % STATES.length],
      command: COMMANDS[phase % COMMANDS.length],
    }
  }

  nodes['root'] = {
    id: 'root',
    title: 'Large Project (300+ nodes)',
    children: rootChildren,
    genieState: 'idle',
  }

  return nodes
}

const mockNodes: Record<string, DemoNodeData> = generateLargeTree()

export const Workflow = () => {
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [selectedNode, setSelectedNode] = useState<DemoNodeData | undefined>()
  const genieRef = useRef<GenieRef>(null)

  useEffect(() => {
    const initialStates: Record<string, GenieState> = {}
    for (const [nodeId, nodeData] of Object.entries(mockNodes)) {
      if (nodeData.genieState) {
        initialStates[nodeId] = nodeData.genieState
      }
    }
    genieStateStore.hydrate(initialStates)
  }, [])

  const handleSelect = useCallback((id: string, node: NodeData) => {
    setSelectedId(id)
    setSelectedNode(node as DemoNodeData)
    /* Trigger front flash on selection */
    setTimeout(() => genieRef.current?.flash(), 100)
  }, [])

  const handleFlashClick = useCallback(() => {
    genieRef.current?.flash()
  }, [])

  const hasChildren = selectedNode?.children && selectedNode.children.length > 0
  const genieState = selectedNode?.genieState || 'idle'
  /* Hand ribs: show for nodes with commands (role-augmented genies) */
  const showHandRibs = Boolean(selectedNode?.command)

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
          <WorkflowSegmentTree
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
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono">{selectedNode.id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Title</span>
                    <span>{selectedNode.title || '—'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">State</span>
                    <span className="font-mono">{genieState}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Children</span>
                    <span>{selectedNode.children?.length || 0}</span>
                  </div>
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
                    onClick={handleFlashClick}
                    type="button"
                  >
                    <Zap className="w-3 h-3" />
                    Trigger Flash
                  </button>
                </div>
                <div className="flex-shrink-0 cursor-pointer" onClick={handleFlashClick}>
                  <Genie
                    clipboardEdge="#424242"
                    clipboardFill="#ffffff"
                    handColor={getHandColorFromRole(selectedNode.command)}
                    ref={genieRef}
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
