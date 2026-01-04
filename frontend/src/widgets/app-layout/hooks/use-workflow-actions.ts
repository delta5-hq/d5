import { useWorkflowManage } from '@entities/workflow'
import { useNavigate } from 'react-router-dom'

export function useWorkflowActions() {
  const navigate = useNavigate()
  const { createEmpty, isCreating } = useWorkflowManage()

  const createWorkflow = async () => {
    const { workflowId } = await createEmpty()
    navigate(`/workflow/${workflowId}`)
  }

  return {
    createWorkflow,
    isCreatingWorkflow: isCreating,
  }
}
