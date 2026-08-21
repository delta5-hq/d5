import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkflowStore } from '../create-workflow-store'
import type { FormatMessage } from '../workflow-store-mutations'

vi.mock('@shared/lib/base-api', () => ({ apiFetch: vi.fn() }))
vi.mock('../../../api/execute-workflow-command', () => ({ executeWorkflowCommand: vi.fn() }))

import { apiFetch } from '@shared/lib/base-api'

const fmt: FormatMessage = (d: { id: string }) => d.id

const baseApiResponse = (nodes: Record<string, unknown>, root: string) => ({
  _id: 'w1',
  workflowId: 'w1',
  userId: 'u1',
  createdAt: '',
  updatedAt: '',
  nodes,
  edges: {},
  root,
  share: { access: [] },
})

async function loadStore(nodes: Record<string, unknown>, root: string) {
  const { store, actions } = createWorkflowStore('w1', fmt)
  vi.mocked(apiFetch).mockResolvedValueOnce(baseApiResponse(nodes, root))
  vi.mocked(apiFetch).mockResolvedValue({ ok: true })
  await actions.load()
  return { store, actions }
}

describe('toggleExpanded — commandless lazy-split', () => {
  beforeEach(() => vi.resetAllMocks())

  it('splits a collapsed commandless child node title into prompt children on expand', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Para 1\n\nPara 2\n\nPara 3', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    expect(store.getState().expandedIds.has('n1')).toBe(false)
    actions.toggleExpanded('n1')

    const { nodes: n } = store.getState()
    expect(n['n1'].children).toHaveLength(3)
    expect(n['n1'].prompts).toHaveLength(3)
    expect(n['n1'].titleProjection).toEqual({
      sourceTitle: 'Para 1\n\nPara 2\n\nPara 3',
      childIds: n['n1'].children,
      nodeIds: n['n1'].children,
    })

    const paragraphs = n['n1'].children!.map(id => n[id]?.title)
    expect(paragraphs).toContain('Para 1')
    expect(paragraphs).toContain('Para 2')
    expect(paragraphs).toContain('Para 3')

    expect(store.getState().expandedIds.has('n1')).toBe(true)
  })

  it('materializes a persisted CRLF blank line and indentation hierarchy on expand', async () => {
    const nodes = {
      root: { id: 'root', title: 'Workflow', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Root\r\n\r\n  Child', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    const { nodes: materialized } = store.getState()
    expect(materialized.n1.prompts).toHaveLength(1)
    const [rootId] = materialized.n1.prompts!
    expect(materialized[rootId]?.title).toBe('Root')
    expect(materialized[rootId]?.children).toHaveLength(1)
    expect(materialized.n1.titleProjection).toEqual({
      sourceTitle: 'Root\r\n\r\n  Child',
      childIds: [rootId],
      nodeIds: [rootId, ...materialized[rootId].children!],
    })
    expect(materialized[materialized[rootId]!.children![0]]?.title).toBe('Child')
    expect(store.getState().expandedIds.has('n1')).toBe(true)
  })

  it('does not split when the node has a command', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Para 1\n\nPara 2', command: '/chat', children: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    expect(store.getState().nodes['n1'].children).toHaveLength(0)
  })

  it('does not split when title has no paragraph break', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Single line', children: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    expect(store.getState().nodes['n1'].children).toHaveLength(0)
  })

  it('does not split when the commandless node already has children — user-edited regular child', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Para 1\n\nPara 2', children: ['c1'], parent: 'root' },
      c1: { id: 'c1', title: 'regular child', children: [], parent: 'n1' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    expect(store.getState().nodes['n1'].children).toHaveLength(1)
  })

  it('does not split when the commandless node already has children — prompt-style child loaded from persistence', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Para 1\n\nPara 2', children: ['c1'], prompts: ['c1'], parent: 'root' },
      c1: { id: 'c1', title: 'Para 1', children: [], parent: 'n1' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    expect(store.getState().nodes['n1'].children).toHaveLength(1)
  })

  it('does not re-split on re-expand once children have been materialized', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Para 1\n\nPara 2', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')
    const afterFirst = store.getState().nodes['n1'].children!.length
    expect(afterFirst).toBe(2)

    actions.toggleExpanded('n1')
    actions.toggleExpanded('n1')

    const afterSecond = store.getState().nodes['n1'].children!.length
    expect(afterSecond).toBe(2)
  })

  it('materializes indented outline into nested prompt and child nodes on expand', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Topic\n  Detail\n\nAnother', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    const { nodes: n } = store.getState()
    expect(n['n1'].prompts).toHaveLength(2)

    const topicId = n['n1'].prompts!.find(id => n[id]?.title === 'Topic')!
    expect(topicId).toBeTruthy()
    expect(n[topicId]?.children).toHaveLength(1)
    expect(n[n[topicId]!.children![0]]?.title).toBe('Detail')

    const anotherId = n['n1'].prompts!.find(id => n[id]?.title === 'Another')!
    expect(anotherId).toBeTruthy()
    expect(n[anotherId]?.children).toHaveLength(0)
  })

  it('expands to zero children when the commandless title contains only whitespace and newlines', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: '\n\n', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    expect(store.getState().expandedIds.has('n1')).toBe(true)
    expect(store.getState().nodes['n1'].children).toHaveLength(0)
  })
})

describe('toggleExpanded — normal nodes', () => {
  beforeEach(() => vi.resetAllMocks())

  it('expands a normal node without creating children', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Child', children: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    expect(store.getState().expandedIds.has('n1')).toBe(true)
    expect(store.getState().nodes['n1'].children).toHaveLength(0)
  })
})
