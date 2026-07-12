import { render, screen } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import messages from '@shared/lib/intl'
import WorkflowVisibilityDialog from '../workflow-card/workflow-visibility-dialog'

let isAdmin = false

vi.mock('@entities/auth', () => ({
  useAuthContext: () => ({ isAdmin }),
}))

vi.mock('@shared/composables', () => ({
  useApiQuery: () => ({
    data: {
      workflowId: 'wf-1',
      title: 'Workflow',
      nodes: {},
      edges: {},
      share: { public: { enabled: true, hidden: false, writeable: false } },
    },
  }),
  useApiMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

const renderDialog = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IntlProvider locale="en" messages={messages.en}>
        <WorkflowVisibilityDialog onClose={vi.fn()} open workflowId="wf-1" />
      </IntlProvider>
    </QueryClientProvider>,
  )

describe('WorkflowVisibilityDialog', () => {
  beforeEach(() => {
    isAdmin = false
  })

  it('hides public writeable visibility from non-admin users', () => {
    renderDialog()

    expect(screen.queryByText('Public Writeable')).not.toBeInTheDocument()
  })

  it('shows public writeable visibility to admin users', () => {
    isAdmin = true
    renderDialog()

    expect(screen.getByText('Public Writeable')).toBeInTheDocument()
  })
})
