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

const makeWorkflow = (overrides: Partial<{ workflowId: string; title: string }> = {}) => ({
  workflowId: 'wf-default',
  title: 'Default Workflow',
  ...overrides,
})

beforeEach(() => {
  useUserWorkflowsListMock.mockReturnValue({ workflows: [], isLoading: false })
})

describe('WorkflowScopeSelector', () => {
  describe('user-level scope (value=null)', () => {
    it('shows user-level label in trigger when value is null', () => {
      renderWithIntl(<WorkflowScopeSelector value={null} onChange={vi.fn()} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('All workflows (user-level)')
    })

    it('shows user-level description text', () => {
      renderWithIntl(<WorkflowScopeSelector value={null} onChange={vi.fn()} />)
      expect(screen.getByText('Applies to all workflows')).toBeDefined()
    })
  })

  describe('workflow-specific scope (value=workflowId)', () => {
    it('shows workflow title in trigger when workflow is loaded', () => {
      const workflow = makeWorkflow({ workflowId: 'wf-abc', title: 'My Pipeline' })
      useUserWorkflowsListMock.mockReturnValue({ workflows: [workflow], isLoading: false })

      renderWithIntl(<WorkflowScopeSelector value="wf-abc" onChange={vi.fn()} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('My Pipeline')
    })

    it('shows workflowId in trigger while workflows are loading (loading race fallback)', () => {
      useUserWorkflowsListMock.mockReturnValue({ workflows: [], isLoading: true })

      renderWithIntl(<WorkflowScopeSelector value="wf-xyz" onChange={vi.fn()} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('wf-xyz')
    })

    it('shows workflowId in trigger when workflow has no title', () => {
      const workflow = makeWorkflow({ workflowId: 'wf-notitle', title: '' })
      useUserWorkflowsListMock.mockReturnValue({ workflows: [workflow], isLoading: false })

      renderWithIntl(<WorkflowScopeSelector value="wf-notitle" onChange={vi.fn()} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('wf-notitle')
    })

    it('shows workflowId in trigger when workflow has whitespace-only title', () => {
      const workflow = makeWorkflow({ workflowId: 'wf-spaces', title: '   ' })
      useUserWorkflowsListMock.mockReturnValue({ workflows: [workflow], isLoading: false })

      renderWithIntl(<WorkflowScopeSelector value="wf-spaces" onChange={vi.fn()} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('wf-spaces')
    })

    it('shows workflow-level description text when workflow is selected', () => {
      const workflow = makeWorkflow({ workflowId: 'wf-abc', title: 'My Pipeline' })
      useUserWorkflowsListMock.mockReturnValue({ workflows: [workflow], isLoading: false })

      renderWithIntl(<WorkflowScopeSelector value="wf-abc" onChange={vi.fn()} />)
      expect(screen.getByText('Applies to selected workflow')).toBeDefined()
    })
  })

  describe('dropdown items', () => {
    it('renders the combobox trigger for an empty workflow list', () => {
      useUserWorkflowsListMock.mockReturnValue({ workflows: [], isLoading: false })
      renderWithIntl(<WorkflowScopeSelector value={null} onChange={vi.fn()} />)
      expect(screen.getByRole('combobox')).toBeDefined()
    })
  })

  describe('disabled state', () => {
    it('disables the select while loading', () => {
      useUserWorkflowsListMock.mockReturnValue({ workflows: [], isLoading: true })
      renderWithIntl(<WorkflowScopeSelector value={null} onChange={vi.fn()} />)
      expect(screen.getByRole('combobox')).toBeDisabled()
    })

    it('disables the select when disabled prop is true', () => {
      useUserWorkflowsListMock.mockReturnValue({ workflows: [], isLoading: false })
      renderWithIntl(<WorkflowScopeSelector value={null} onChange={vi.fn()} disabled />)
      expect(screen.getByRole('combobox')).toBeDisabled()
    })

    it('enables the select when loaded and not disabled', () => {
      useUserWorkflowsListMock.mockReturnValue({ workflows: [], isLoading: false })
      renderWithIntl(<WorkflowScopeSelector value={null} onChange={vi.fn()} />)
      expect(screen.getByRole('combobox')).not.toBeDisabled()
    })
  })

  describe('trigger label resolution priority', () => {
    it('prefers loaded title over workflowId for selected workflow', () => {
      const workflow = makeWorkflow({ workflowId: 'wf-priority', title: 'Human Name' })
      useUserWorkflowsListMock.mockReturnValue({ workflows: [workflow], isLoading: false })

      renderWithIntl(<WorkflowScopeSelector value="wf-priority" onChange={vi.fn()} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger.textContent).toContain('Human Name')
      expect(trigger.textContent).not.toContain('wf-priority')
    })

    it('falls back to workflowId when selected workflow not in loaded list', () => {
      const other = makeWorkflow({ workflowId: 'wf-other', title: 'Other' })
      useUserWorkflowsListMock.mockReturnValue({ workflows: [other], isLoading: false })

      renderWithIntl(<WorkflowScopeSelector value="wf-missing" onChange={vi.fn()} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('wf-missing')
    })
  })
})
