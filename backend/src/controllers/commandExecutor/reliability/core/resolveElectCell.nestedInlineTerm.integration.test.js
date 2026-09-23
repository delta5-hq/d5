/**
 * Tree-state invariant for inline-term /elect under a real runForks + StoreFork call.
 * runForks and StoreFork are NOT mocked; runCommand/postProcessExistingOutput/ForkJudge are.
 */
import {resolveElectCell} from './resolveElectCell'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../../commands/utils/runCommand', () => ({
  foreachValidateTemplateExclusions: jest.fn().mockReturnValue([]),
  postProcessExistingOutput: jest.fn().mockResolvedValue(undefined),
  runCommand: jest.fn().mockResolvedValue(undefined),
}))

const mockSelectWinner = jest.fn().mockResolvedValue(null)
jest.mock('./ForkJudge', () => ({
  ForkJudge: jest.fn(() => ({selectWinner: mockSelectWinner})),
}))

jest.mock('./OwnershipResolver', () => jest.fn().mockReturnValue(new Map()))

jest.mock('./ForkProgressEmitter', () => ({
  NullForkProgressEmitter: jest.fn(() => ({
    forksStarted: jest.fn(),
    forkSettled: jest.fn(),
    electComplete: jest.fn(),
  })),
}))

jest.mock('../../commands/utils/langchain/getLLM', () => ({
  Model: {OpenAI: 'OpenAI'},
  getIntegrationSettings: jest.fn().mockResolvedValue({openai: {apiKey: 'test'}}),
  getLLM: jest.fn(),
}))

jest.mock('../../commands/utils/NodeTextExtractor', () => ({
  NodeTextExtractor: jest.fn(() => ({extractFullContent: jest.fn().mockResolvedValue('')})),
}))

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

describe('inline-term /elect — nested tree-state invariant through real runForks', () => {
  it('store is in original state after resolveElectCell returns when elect is nested under a parent', async () => {
    const store = buildStore({
      ancestor: {
        id: 'ancestor',
        parent: null,
        command: '/chat context',
        title: 'context',
        children: ['r1'],
        prompts: [],
      },
      r1: {
        id: 'r1',
        parent: 'ancestor',
        title: 'Nested Inline Elect',
        command: '/elect :n=2 /chat propose directions',
        children: [],
      },
    })
    jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
    jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes['r1:term']).toBeUndefined()
    expect(store._nodes['r1'].parent).toBe('ancestor')
    expect(store._nodes['ancestor'].children).toContain('r1')
    expect(store._nodes['ancestor'].children).not.toContain('r1:term')
  })

  it('store is in original state when elect is at the top level (no ancestor to restore)', async () => {
    const store = buildStore({
      r1: {
        id: 'r1',
        parent: null,
        title: 'Top-Level Inline Elect',
        command: '/elect :n=2 /chat propose directions',
        children: [],
      },
    })
    jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
    jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes['r1:term']).toBeUndefined()
    expect(store._nodes['r1'].parent).toBeNull()
  })

  afterEach(() => {
    mockSelectWinner.mockResolvedValue(null)
  })

  it('re-running resolveElectCell on the same node produces the same outcome (idempotent restoration)', async () => {
    const store = buildStore({
      ancestor: {
        id: 'ancestor',
        parent: null,
        command: '/chat context',
        children: ['r1'],
        prompts: [],
      },
      r1: {
        id: 'r1',
        parent: 'ancestor',
        title: 'Nested Inline Elect',
        command: '/elect :n=2 /chat propose directions',
        children: [],
      },
    })
    jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
    jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await resolveElectCell(store.getNode('r1'), store, new Map())
    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes['r1:term']).toBeUndefined()
    expect(store._nodes['r1'].parent).toBe('ancestor')
    expect(store._nodes['ancestor'].children).toContain('r1')
    expect(store._nodes['ancestor'].children).not.toContain('r1:term')
  })
})

describe('inline-term /elect — winner path: StoreFork.applyCandidate replaces store node before restore', () => {
  // Real StoreFork.applyCandidate runs — restore closure must resolve the live node by id, not the captured ref.

  afterEach(() => {
    mockSelectWinner.mockResolvedValue(null)
  })

  it('elect.parent is restored to original after applyCandidate replaces store._nodes[electId] with a fork clone', async () => {
    const store = buildStore({
      ancestor: {
        id: 'ancestor',
        parent: null,
        command: '/chat context',
        title: 'context',
        children: ['r1'],
        prompts: [],
      },
      r1: {
        id: 'r1',
        parent: 'ancestor',
        title: 'Nested Inline Elect',
        command: '/elect :n=2 /chat propose directions',
        children: [],
      },
    })
    jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
    jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    // ForkJudge picks winner 0 — resolveElectCell will call StoreFork.applyCandidate
    // which replaces store._nodes['r1'] with the fork clone (parent still 'r1:term').
    mockSelectWinner.mockResolvedValue({winnerForkIndex: 0, selectionLayer: 'primary'})

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes['r1'].parent).toBe('ancestor')
    expect(store._nodes['r1:term']).toBeUndefined()
    expect(store._nodes['ancestor'].children).toContain('r1')
    expect(store._nodes['ancestor'].children).not.toContain('r1:term')
  })

  it('elect.parent is restored to null when inline elect is at the top level and a winner is selected', async () => {
    const store = buildStore({
      r1: {
        id: 'r1',
        parent: null,
        title: 'Top-Level Inline Elect',
        command: '/elect :n=2 /chat propose directions',
        children: [],
      },
    })
    jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
    jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    mockSelectWinner.mockResolvedValue({winnerForkIndex: 0, selectionLayer: 'primary'})

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes['r1'].parent).toBeNull()
    expect(store._nodes['r1:term']).toBeUndefined()
  })
})
