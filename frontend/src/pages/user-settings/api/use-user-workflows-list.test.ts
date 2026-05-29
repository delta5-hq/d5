import { describe, it, expect } from 'vitest'
import { resolveDisplayTitle } from './use-user-workflows-list'

describe('resolveDisplayTitle', () => {
  it('returns Workflow.title when non-empty', () => {
    expect(resolveDisplayTitle({ workflowId: 'wf1', title: 'My Board', root: 'r1' })).toBe('My Board')
  })

  it('trims leading/trailing whitespace from Workflow.title', () => {
    expect(resolveDisplayTitle({ workflowId: 'wf1', title: '  My Board  ', root: 'r1' })).toBe('My Board')
  })

  it('falls back to root node title when Workflow.title is empty', () => {
    expect(
      resolveDisplayTitle({
        workflowId: 'wf1',
        title: '',
        root: 'r1',
        nodes: { r1: { title: 'Root Node Title' } },
      }),
    ).toBe('Root Node Title')
  })

  it('falls back to root node title when Workflow.title is whitespace-only', () => {
    expect(
      resolveDisplayTitle({
        workflowId: 'wf1',
        title: '   ',
        root: 'r1',
        nodes: { r1: { title: 'Root Node Title' } },
      }),
    ).toBe('Root Node Title')
  })

  it('trims leading/trailing whitespace from root node title', () => {
    expect(
      resolveDisplayTitle({
        workflowId: 'wf1',
        title: '',
        root: 'r1',
        nodes: { r1: { title: '  Root Node  ' } },
      }),
    ).toBe('Root Node')
  })

  it('falls back to workflowId when both Workflow.title and root node title are empty', () => {
    expect(
      resolveDisplayTitle({
        workflowId: 'wf1',
        title: '',
        root: 'r1',
        nodes: { r1: { title: '' } },
      }),
    ).toBe('wf1')
  })

  it('falls back to workflowId when nodes map is absent', () => {
    expect(resolveDisplayTitle({ workflowId: 'wf1', title: '', root: 'r1' })).toBe('wf1')
  })

  it('falls back to workflowId when root node is absent from nodes map', () => {
    expect(
      resolveDisplayTitle({ workflowId: 'wf1', title: '', root: 'r1', nodes: { other: { title: 'Other' } } }),
    ).toBe('wf1')
  })

  it('falls back to workflowId when root is empty string', () => {
    expect(resolveDisplayTitle({ workflowId: 'wf1', title: '', root: '', nodes: { r1: { title: 'Root' } } })).toBe(
      'wf1',
    )
  })
})
