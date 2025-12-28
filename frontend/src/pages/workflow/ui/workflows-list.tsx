import { useAuthContext } from '@entities/auth'
import { useIsMobile } from '@shared/composables'
import { Card } from '@shared/ui/card'
import { HelmetTitle } from '@shared/ui/helmet'
import { StatusPlaceholder } from '@shared/ui/status-placeholder'
import { AppLayout } from '@widgets/app-layout'
import {
  CallToRegister,
  ControlButtons,
  WorkflowCard,
  WorkflowShareFilters,
  WorkflowsPagination,
  WorkflowsView,
  WorkflowTable,
  WorkflowTemplates,
} from '@widgets/workflow'
import { useEffect, useState } from 'react'
import { useIntl } from 'react-intl'
import { useMatch, useNavigate } from 'react-router-dom'
import { useLocalStorage } from 'react-use'
import { useWorkflows } from '../api'
import { WORKFLOWS_PAGE_LIMIT } from '../config'

export const WorkflowsListPage = () => {
  const navigate = useNavigate()
  const matchPublic = useMatch('/workflows/public')
  const isPublic = !!matchPublic
  const { isLoggedIn, isLoading: isAuthProcessing } = useAuthContext()
  const isMobile = useIsMobile()
  const { formatMessage } = useIntl()

  const [view, setView] = useLocalStorage<WorkflowsView>('workflowsView', WorkflowsView.grid)
  const [shareFilter, setShareFilter] = useLocalStorage<WorkflowShareFilters>(
    'workflowsShareFilter',
    WorkflowShareFilters.all,
  )
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
          {/* Only show WorkflowTemplates on private workflows page, not on public */}
          {isLoggedIn && !isMobile && !isPublic ? <WorkflowTemplates /> : null}
          <ControlButtons
            disabled={isWorkflowsLoading}
            isPublic={isPublic}
            setShareFilter={setShareFilter}
            setView={setView}
            shareFilter={shareFilter || WorkflowShareFilters.all}
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
