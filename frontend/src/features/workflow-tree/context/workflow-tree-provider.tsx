import { createContext, useContext, type ReactNode } from 'react'
import { useWorkflow } from '@entities/workflow/api'
import type { NodeData } from '@shared/base-types'

interface WorkflowTreeContextValue {
  nodes: Record<string, NodeData>
  root: string | undefined
  isLoading: boolean
  refetch: () => void
}

const WorkflowTreeContext = createContext<WorkflowTreeContextValue | null>(null)

interface WorkflowTreeProviderProps {
  workflowId: string
  children: ReactNode
}

export const WorkflowTreeProvider = ({ workflowId, children }: WorkflowTreeProviderProps) => {
  const { nodes, root, isLoading, refetch } = useWorkflow(workflowId)

  const value: WorkflowTreeContextValue = {
    nodes: nodes ?? {},
    root,
    isLoading,
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
