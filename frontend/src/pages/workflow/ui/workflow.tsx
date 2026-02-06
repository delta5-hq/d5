import { useAuthContext } from '@entities/auth'
import { StatusPlaceholder } from '@shared/ui/status-placeholder'
import { Workflow } from '@widgets/workflow'
import { useNavigate, useParams } from 'react-router-dom'

export const WorkflowPage = () => {
  const navigate = useNavigate()
  const { workflowId } = useParams<{ workflowId: string }>()
  const { isLoading, isLoggedIn } = useAuthContext()

  if (isLoading) return <StatusPlaceholder loading />
  if (!isLoggedIn) {
    navigate('/')
  }

  if (!workflowId) {
    navigate('/workflows')
    return <StatusPlaceholder loading />
  }

  return <Workflow workflowId={workflowId} />
}
