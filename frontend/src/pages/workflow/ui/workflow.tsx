import { useAuthContext } from '@entities/auth'
import { StatusPlaceholder } from '@shared/ui/status-placeholder'
import { Workflow } from '@widgets/workflow'
import { useNavigate } from 'react-router-dom'

export const WorkflowPage = () => {
  const navigate = useNavigate()
  const { isLoading, isLoggedIn } = useAuthContext()

  if (isLoading) return <StatusPlaceholder loading />
  if (!isLoggedIn) {
    navigate('/')
  }

  return <Workflow />
}
