import { useAuthContext } from '@entities/auth'
import { HelmetTitle } from '@shared/ui/helmet'
import { StatusPlaceholder } from '@shared/ui/status-placeholder'
import { AppLayout } from '@widgets/app-layout'
import { WorkflowTemplates } from '@widgets/workflow'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export const TemplatesPage = () => {
  const navigate = useNavigate()
  const { isLoggedIn, isLoading: isAuthProcessing } = useAuthContext()

  useEffect(() => {
    if (isAuthProcessing) return
    if (!isLoggedIn) {
      navigate('/workflows/public', { replace: true })
    }
  }, [isLoggedIn, isAuthProcessing, navigate])

  if (isAuthProcessing) {
    return <StatusPlaceholder loading />
  }

  if (!isLoggedIn) {
    return null
  }

  return (
    <AppLayout>
      <HelmetTitle titleId="workflowTemplates" />
      <div className="flex flex-col gap-4 w-full h-full overflow-y-auto pb-4">
        <WorkflowTemplates />
      </div>
    </AppLayout>
  )
}
