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

const childTitles = (nodes: Record<string, { title?: string }>, ids: readonly string[]): string[] =>
  ids.map(id => nodes[id]?.title ?? '')

describe('toggleExpanded — commandless lazy-split', () => {
  beforeEach(() => vi.resetAllMocks())

  it('splits a collapsed commandless child node title into direct prompt children, clearing parent title and projection', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Para 1\n\nPara 2\n\nPara 3', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    expect(store.getState().expandedIds.has('n1')).toBe(false)
    actions.toggleExpanded('n1')

    const { nodes: n } = store.getState()
    expect(n['n1'].title).toBe('')
    expect(n['n1'].titleProjection).toBeUndefined()
    expect(n['n1'].children).toHaveLength(3)
    expect(n['n1'].prompts).toHaveLength(3)
    expect(childTitles(n, n['n1'].children!)).toEqual(['Para 1', 'Para 2', 'Para 3'])
    expect(store.getState().expandedIds.has('n1')).toBe(true)
  })

  it('materializes the accepted First paragraph / Outline fixture with full hierarchy', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: {
        id: 'n1',
        title: 'First paragraph\n\nOutline\n  sub a\n  sub b',
        children: [],
        prompts: [],
        parent: 'root',
      },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    const { nodes: n } = store.getState()
    expect(n['n1'].title).toBe('')
    expect(n['n1'].titleProjection).toBeUndefined()
    expect(childTitles(n, n['n1'].children!)).toEqual(['First paragraph', 'Outline'])

    const outlineId = n['n1'].children!.find(id => n[id]?.title === 'Outline')!
    expect(childTitles(n, n[outlineId]!.children!)).toEqual(['sub a', 'sub b'])
  })

  it('materializes the adversarial A/A1/B/B1 indented outline without merging roots', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'A\n  A1\nB\n  B1', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    const { nodes: n } = store.getState()
    expect(n['n1'].title).toBe('')
    expect(n['n1'].titleProjection).toBeUndefined()
    expect(childTitles(n, n['n1'].children!)).toEqual(['A', 'B'])

    const aId = n['n1'].children!.find(id => n[id]?.title === 'A')!
    const bId = n['n1'].children!.find(id => n[id]?.title === 'B')!
    expect(childTitles(n, n[aId]!.children!)).toEqual(['A1'])
    expect(childTitles(n, n[bId]!.children!)).toEqual(['B1'])
  })

  it('materializes a persisted CRLF blank line and indentation hierarchy on expand', async () => {
    const nodes = {
      root: { id: 'root', title: 'Workflow', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Root\r\n\r\n  Child', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    const { nodes: materialized } = store.getState()
    expect(materialized.n1.title).toBe('')
    expect(materialized.n1.titleProjection).toBeUndefined()
    expect(materialized.n1.prompts).toHaveLength(1)
    const [rootId] = materialized.n1.prompts!
    expect(materialized[rootId]?.title).toBe('Root')
    expect(childTitles(materialized, materialized[rootId]!.children!)).toEqual(['Child'])
    expect(store.getState().expandedIds.has('n1')).toBe(true)
  })

  it('normalizes CR line endings the same as CRLF on expand', async () => {
    const nodes = {
      root: { id: 'root', title: 'Workflow', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Root\r\r  Child', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    const { nodes: n } = store.getState()
    expect(n['n1'].title).toBe('')
    const [rootId] = n['n1'].prompts!
    expect(n[rootId]?.title).toBe('Root')
    expect(childTitles(n, n[rootId]!.children!)).toEqual(['Child'])
  })

  it('materializes canonical NBSP indentation through the established splitter', async () => {
    const nodes = {
      root: { id: 'root', title: 'Workflow', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'A\n\u00a0\u00a0A1', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    const { nodes: n } = store.getState()
    expect(n.n1.title).toBe('')
    const [aId] = n.n1.children!
    expect(n[aId]?.title).toBe('A')
    expect(childTitles(n, n[aId]!.children!)).toEqual(['A1'])
  })

  it.each([
    ['odd indentation', 'A\n A1'],
    ['tab indentation', 'A\n\tA1'],
    ['parser-underflow indentation', '  A\n B'],
    ['blank-delimited indented root', 'A\n\n  B'],
  ])('leaves a non-round-tripping %s joined and expands normally', async (_label, title) => {
    const nodes = {
      root: { id: 'root', title: 'Workflow', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title, children: [], prompts: [], parent: 'root', collapsed: true },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    expect(() => actions.toggleExpanded('n1')).not.toThrow()

    expect(store.getState().nodes.n1.title).toBe(title)
    expect(store.getState().nodes.n1.children).toEqual([])
    expect(store.getState().expandedIds.has('n1')).toBe(true)
    expect(store.getState().nodes.n1.collapsed).toBe(false)
  })

  it('drops blank paragraphs without fabricating empty child nodes', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'A\n\n\n\nB', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    const { nodes: n } = store.getState()
    expect(childTitles(n, n['n1'].children!)).toEqual(['A', 'B'])
    expect(n['n1'].children!.every(id => n[id]?.title !== '')).toBe(true)
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
    expect(store.getState().nodes['n1'].title).toBe('')

    actions.toggleExpanded('n1')
    actions.toggleExpanded('n1')

    const afterSecond = store.getState().nodes['n1'].children!.length
    expect(afterSecond).toBe(2)
    expect(store.getState().nodes['n1'].title).toBe('')
  })

  it('does not re-split or duplicate children after a reload of the persisted split state', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'A\n  A1\nB\n  B1', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')
    actions.toggleExpanded('n1')
    const persisted = store.getState().nodes

    vi.mocked(apiFetch).mockResolvedValueOnce(baseApiResponse(persisted, 'root'))
    vi.mocked(apiFetch).mockResolvedValue({ ok: true })
    await actions.load()

    expect(store.getState().nodes['n1'].title).toBe('')
    expect(childTitles(store.getState().nodes, store.getState().nodes['n1'].children!)).toEqual(['A', 'B'])

    actions.toggleExpanded('n1')
    actions.toggleExpanded('n1')

    expect(store.getState().nodes['n1'].title).toBe('')
    expect(childTitles(store.getState().nodes, store.getState().nodes['n1'].children!)).toEqual(['A', 'B'])
  })

  it('materializes indented outline into nested prompt and child nodes on expand', async () => {
    const nodes = {
      root: { id: 'root', title: 'Root', children: ['n1'], collapsed: false },
      n1: { id: 'n1', title: 'Topic\n  Detail\n\nAnother', children: [], prompts: [], parent: 'root' },
    }
    const { store, actions } = await loadStore(nodes, 'root')

    actions.toggleExpanded('n1')

    const { nodes: n } = store.getState()
    expect(n['n1'].title).toBe('')
    expect(n['n1'].titleProjection).toBeUndefined()
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
