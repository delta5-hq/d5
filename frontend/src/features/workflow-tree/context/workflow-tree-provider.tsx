import { createContext, useContext, type ReactNode } from 'react'
import { useWorkflow, type WorkflowResponse } from '@entities/workflow/api'
import type { NodeData, EdgeDatas } from '@shared/base-types'

interface WorkflowTreeContextValue {
  nodes: Record<string, NodeData>
  edges: EdgeDatas
  root: string | undefined
  isLoading: boolean
  error: Error | null
  workflow: WorkflowResponse | undefined
  refetch: () => void
}

const WorkflowTreeContext = createContext<WorkflowTreeContextValue | null>(null)

interface WorkflowTreeProviderProps {
  workflowId: string
  children: ReactNode
}

export const WorkflowTreeProvider = ({ workflowId, children }: WorkflowTreeProviderProps) => {
  const { workflow, nodes, root, isLoading, error, refetch } = useWorkflow(workflowId)

  const value: WorkflowTreeContextValue = {
    nodes: nodes ?? {},
    edges: workflow?.edges ?? {},
    root,
    isLoading,
    error,
    workflow,
    refetch,
  }

  return <WorkflowTreeContext.Provider value={value}>{children}</WorkflowTreeContext.Provider>
}

export const useWorkflowTreeData = () => {
  const context = useContext(WorkflowTreeContext)
  if (!context) {
    throw new Error('useWorkflowTreeData must be used within WorkflowTreeProvider')
  }
  return context
}
