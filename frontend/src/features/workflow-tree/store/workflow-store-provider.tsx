import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useIntl } from 'react-intl'
import type { WorkflowStore } from './create-workflow-store'
import { createWorkflowStore } from './create-workflow-store'

const WorkflowStoreContext = createContext<WorkflowStore | null>(null)

export function useWorkflowStore(): WorkflowStore {
  const ctx = useContext(WorkflowStoreContext)
  if (!ctx) throw new Error('useWorkflowStore requires WorkflowStoreProvider')
  return ctx
}

interface WorkflowStoreProviderProps {
  workflowId: string
  children: ReactNode
}

export const WorkflowStoreProvider = ({ workflowId, children }: WorkflowStoreProviderProps) => {
  const { formatMessage } = useIntl()
  const storeRef = useRef<WorkflowStore | null>(null)

  if (!storeRef.current || storeRef.current.store.getState().workflowId !== workflowId) {
    storeRef.current?.actions.destroy()
    storeRef.current = createWorkflowStore(workflowId, formatMessage)
  }

  useEffect(() => {
    storeRef.current?.actions.load()
    return () => {
      storeRef.current?.actions.destroy()
    }
  }, [workflowId])

  return <WorkflowStoreContext.Provider value={storeRef.current}>{children}</WorkflowStoreContext.Provider>
}
