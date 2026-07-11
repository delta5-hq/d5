import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import * as useUserWorkflowsListModule from '@pages/user-settings/api/use-user-workflows-list'
import { WorkflowScopeSelector } from './workflow-scope-selector'

vi.mock('@pages/user-settings/api/use-user-workflows-list', () => ({
  useUserWorkflowsList: vi.fn(),
}))

const useUserWorkflowsListMock = vi.mocked(useUserWorkflowsListModule.useUserWorkflowsList)

const messages: Record<string, string> = {
  'integration.workflowScope.label': 'Scope',
  'integration.workflowScope.userLevel': 'All workflows (user-level)',
  'integration.workflowScope.descriptionUserLevel': 'Applies to all workflows',
  'integration.workflowScope.descriptionWorkflow': 'Applies to selected workflow',
}

const renderWithIntl = (ui: React.ReactElement) =>
  render(
    <IntlProvider locale="en" messages={messages}>
      {ui}
    </IntlProvider>,
  )

const makeWorkflow = (overrides: Partial<{ workflowId: string; displayTitle: string }> = {}) => ({
  workflowId: 'wf-default',
  displayTitle: 'Default Workflow',
  ...overrides,
})

beforeEach(() => {
  useUserWorkflowsListMock.mockReturnValue({ workflows: [], isLoading: false })
})

describe('WorkflowScopeSelector', () => {
  describe('user-level scope (value=null)', () => {
    it('shows user-level label in trigger when value is null', () => {
      renderWithIntl(<WorkflowScopeSelector onChange={vi.fn()} value={null} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('All workflows (user-level)')
    })

    it('shows user-level description text', () => {
      renderWithIntl(<WorkflowScopeSelector onChange={vi.fn()} value={null} />)
      expect(screen.getByText('Applies to all workflows')).toBeDefined()
    })
  })

  describe('workflow-specific scope (value=workflowId)', () => {
    it('shows workflow title in trigger when workflow is loaded', () => {
      const workflow = makeWorkflow({ workflowId: 'wf-abc', displayTitle: 'My Pipeline' })
      useUserWorkflowsListMock.mockReturnValue({ workflows: [workflow], isLoading: false })

      renderWithIntl(<WorkflowScopeSelector onChange={vi.fn()} value="wf-abc" />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('My Pipeline')
    })

    it('shows workflowId in trigger while workflows are loading (loading race fallback)', () => {
      useUserWorkflowsListMock.mockReturnValue({ workflows: [], isLoading: true })

      renderWithIntl(<WorkflowScopeSelector onChange={vi.fn()} value="wf-xyz" />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('wf-xyz')
    })

    it('shows workflowId in trigger when hook resolves to workflowId as displayTitle (no title available)', () => {
      const workflow = makeWorkflow({ workflowId: 'wf-notitle', displayTitle: 'wf-notitle' })
      useUserWorkflowsListMock.mockReturnValue({ workflows: [workflow], isLoading: false })

      renderWithIntl(<WorkflowScopeSelector onChange={vi.fn()} value="wf-notitle" />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('wf-notitle')
    })

    it('shows workflowId in trigger when hook resolves displayTitle to workflowId (whitespace title)', () => {
      const workflow = makeWorkflow({ workflowId: 'wf-spaces', displayTitle: 'wf-spaces' })
      useUserWorkflowsListMock.mockReturnValue({ workflows: [workflow], isLoading: false })

      renderWithIntl(<WorkflowScopeSelector onChange={vi.fn()} value="wf-spaces" />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('wf-spaces')
    })

    it('shows workflow-level description text when workflow is selected', () => {
      const workflow = makeWorkflow({ workflowId: 'wf-abc', displayTitle: 'My Pipeline' })
      useUserWorkflowsListMock.mockReturnValue({ workflows: [workflow], isLoading: false })

      renderWithIntl(<WorkflowScopeSelector onChange={vi.fn()} value="wf-abc" />)
      expect(screen.getByText('Applies to selected workflow')).toBeDefined()
    })
  })

  describe('dropdown items', () => {
    it('renders the combobox trigger for an empty workflow list', () => {
      useUserWorkflowsListMock.mockReturnValue({ workflows: [], isLoading: false })
      renderWithIntl(<WorkflowScopeSelector onChange={vi.fn()} value={null} />)
      expect(screen.getByRole('combobox')).toBeDefined()
    })
  })

  describe('disabled state', () => {
    it('disables the select while loading', () => {
      useUserWorkflowsListMock.mockReturnValue({ workflows: [], isLoading: true })
      renderWithIntl(<WorkflowScopeSelector onChange={vi.fn()} value={null} />)
      expect(screen.getByRole('combobox')).toBeDisabled()
    })

    it('disables the select when disabled prop is true', () => {
      useUserWorkflowsListMock.mockReturnValue({ workflows: [], isLoading: false })
      renderWithIntl(<WorkflowScopeSelector disabled onChange={vi.fn()} value={null} />)
      expect(screen.getByRole('combobox')).toBeDisabled()
    })

    it('enables the select when loaded and not disabled', () => {
      useUserWorkflowsListMock.mockReturnValue({ workflows: [], isLoading: false })
      renderWithIntl(<WorkflowScopeSelector onChange={vi.fn()} value={null} />)
      expect(screen.getByRole('combobox')).not.toBeDisabled()
    })
  })

  describe('trigger label resolution priority', () => {
    it('prefers loaded title over workflowId for selected workflow', () => {
      const workflow = makeWorkflow({ workflowId: 'wf-priority', displayTitle: 'Human Name' })
      useUserWorkflowsListMock.mockReturnValue({ workflows: [workflow], isLoading: false })

      renderWithIntl(<WorkflowScopeSelector onChange={vi.fn()} value="wf-priority" />)
      const trigger = screen.getByRole('combobox')
      expect(trigger.textContent).toContain('Human Name')
      expect(trigger.textContent).not.toContain('wf-priority')
    })

    it('falls back to workflowId when selected workflow not in loaded list', () => {
      const other = makeWorkflow({ workflowId: 'wf-other', displayTitle: 'Other' })
      useUserWorkflowsListMock.mockReturnValue({ workflows: [other], isLoading: false })

      renderWithIntl(<WorkflowScopeSelector onChange={vi.fn()} value="wf-missing" />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('wf-missing')
    })
  })
})
