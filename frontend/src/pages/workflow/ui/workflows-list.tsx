import { useAuthContext } from '@entities/auth'
import { useIsMobile } from '@shared/composables'
import { Card } from '@shared/ui/card'
import { StatusPlaceholder } from '@shared/ui/status-placeholder'
import { AppLayout } from '@widgets/app-layout'
import {
  CallToRegister,
  ControlButtons,
  WorkflowsView,
  WorkflowTable,
  WorkflowCard,
  WorkflowTemplates,
  MapShareFilters,
  WorkflowsPagination,
} from '@widgets/workflow'
import { useEffect, useState } from 'react'
import { useMatch, useNavigate } from 'react-router-dom'
import { useWorkflows } from '../api'
import { useLocalStorage } from 'react-use'
import { WORKFLOWS_PAGE_LIMIT } from '../config'
import { useIntl } from 'react-intl'
import { HelmetTitle } from '@shared/ui/helmet'

export const WorkflowsListPage = () => {
  const navigate = useNavigate()
  const matchPublic = useMatch('/workflows/public')
  const isPublic = !!matchPublic
  const { isLoggedIn, isLoading: isAuthProcessing } = useAuthContext()
  const isMobile = useIsMobile()
  const { formatMessage } = useIntl()

  const [view, setView] = useLocalStorage<WorkflowsView>('workflowsView', WorkflowsView.grid)
  const [shareFilter, setShareFilter] = useLocalStorage<MapShareFilters>('workflowsShareFilter', MapShareFilters.all)
  const [page, setPage] = useState(1)

  const {
    workflows,
    isLoading: isWorkflowsLoading,
    total,
  } = useWorkflows({ isPublic, filter: shareFilter, page, limit: WORKFLOWS_PAGE_LIMIT })

  useEffect(() => {
    if (isAuthProcessing) return
    if (!isPublic && !isLoggedIn) {
      navigate('/workflows/public', { replace: true })
    }
  }, [isPublic, isLoggedIn, isAuthProcessing, navigate])

  if (isAuthProcessing) {
    return <StatusPlaceholder loading />
  }

  if (!isLoggedIn && !isPublic) {
    return (
      <AppLayout>
        <CallToRegister />
      </AppLayout>
    )
  }

  return (
    <AppLayout searchPlaceholder={formatMessage({ id: 'searchWorkflow' })}>
      <HelmetTitle titleId={isPublic ? 'workflowsPublic' : 'workflowsPrivate'} />
      <Card className="flex flex-col justify-between w-full h-full overflow-y-auto pb-4">
        <div>
          {isLoggedIn && !isMobile ? <WorkflowTemplates /> : null}
          <ControlButtons
            disabled={isWorkflowsLoading}
            isPublic={isPublic}
            setShareFilter={setShareFilter}
            setView={setView}
            shareFilter={shareFilter || MapShareFilters.all}
            view={view || WorkflowsView.grid}
          />

          <div className="w-full p-4">
            <Card className="p-4" glassEffect={false}>
              {view === WorkflowsView.grid || isMobile ? (
                <WorkflowCard isLoading={isWorkflowsLoading} isPublic={isPublic} workflows={workflows} />
              ) : (
                <WorkflowTable data={workflows} isPublic={isPublic} />
              )}
            </Card>
          </div>
        </div>

        {total ? (
          <WorkflowsPagination limit={WORKFLOWS_PAGE_LIMIT} onPageChange={p => setPage(p)} page={page} total={total} />
        ) : null}
      </Card>
    </AppLayout>
  )
}
