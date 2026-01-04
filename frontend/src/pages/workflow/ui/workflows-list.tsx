import { useAuthContext } from '@entities/auth'
import { useIsMobile } from '@shared/composables'
import { Card } from '@shared/ui/card'
import { HelmetTitle } from '@shared/ui/helmet'
import { StatusPlaceholder } from '@shared/ui/status-placeholder'
import { AppLayout } from '@widgets/app-layout'
import {
  CallToRegister,
  WorkflowCard,
  WorkflowShareFilters,
  WorkflowsPagination,
  WorkflowsView,
  WorkflowTable,
  WorkflowsHero,
} from '@widgets/workflow'
import { useEffect, useState } from 'react'
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
    <AppLayout>
      <HelmetTitle titleId={isPublic ? 'workflowsPublic' : 'workflowsPrivate'} />
      <div className="flex flex-col gap-4 w-full h-full overflow-y-auto pb-4">
        <WorkflowsHero
          disabled={isWorkflowsLoading}
          isMobile={isMobile}
          isPublic={isPublic}
          onShareFilterChange={setShareFilter}
          onViewChange={setView}
          shareFilter={shareFilter || WorkflowShareFilters.all}
          view={view || WorkflowsView.grid}
        />

        <Card className="flex flex-col justify-between flex-1">
          <div className="p-4">
            {view === WorkflowsView.grid || isMobile ? (
              <WorkflowCard isLoading={isWorkflowsLoading} isPublic={isPublic} workflows={workflows} />
            ) : (
              <WorkflowTable data={workflows} isPublic={isPublic} />
            )}
          </div>

          {total ? (
            <WorkflowsPagination
              limit={WORKFLOWS_PAGE_LIMIT}
              onPageChange={p => setPage(p)}
              page={page}
              total={total}
            />
          ) : null}
        </Card>
      </div>
    </AppLayout>
  )
}
