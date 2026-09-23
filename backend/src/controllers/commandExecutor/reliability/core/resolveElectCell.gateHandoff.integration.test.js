import {resolveElectCell} from './resolveElectCell'
import OwnershipResolver from './OwnershipResolver'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('./SubtreeForkRunner', () => ({
  runForks: jest.fn(),
  computeEffectiveN: jest.fn((_electNode, _store, n) => n),
}))

jest.mock('./StoreFork', () => ({applyCandidate: jest.fn()}))

jest.mock('./OwnershipResolver', () => jest.fn())

jest.mock('./ForkProgressEmitter', () => ({
  NullForkProgressEmitter: jest.fn(() => ({
    forksStarted: jest.fn(),
    forkSettled: jest.fn(),
    electComplete: jest.fn(),
  })),
}))

jest.mock('../../commands/utils/langchain/getLLM', () => ({
  Model: {
    Claude: 'Claude',
    OpenAI: 'OpenAI',
    Deepseek: 'Deepseek',
    Qwen: 'Qwen',
    YandexGPT: 'YandexGPT',
    CustomLLM: 'CustomLLM',
  },
  getIntegrationSettings: jest.fn().mockRejectedValue(new Error('LLM must not be reached for all-gated forks')),
  determineLLMType: jest.fn(),
  getLLM: jest.fn(),
}))

jest.mock('../../commands/utils/NodeTextExtractor', () => ({NodeTextExtractor: jest.fn()}))

const {runForks: mockRunForks} = require('./SubtreeForkRunner')
const MockOwnershipResolver = OwnershipResolver
const {NodeTextExtractor} = require('../../commands/utils/NodeTextExtractor')

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

const makeElectStore = () => {
  const store = buildStore({
    p1: {id: 'p1', parent: null, children: ['r1'], command: '/chat task', title: 'Parent'},
    r1: {id: 'r1', parent: 'p1', title: 'Elect Cell', command: '/elect :n=3', children: []},
  })
  jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
  jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})
  return store
}

const makeForkStore = label =>
  buildStore({
    p1: {id: 'p1', parent: null, children: [], command: '/chat task', title: `${label} output`, prompts: []},
  })

const stubNodeTextExtractorByStore = contentByStore => {
  NodeTextExtractor.mockImplementation((_budget, _skip, forkStore) => ({
    extractFullContent: jest.fn().mockResolvedValue(contentByStore.get(forkStore) ?? ''),
  }))
}

beforeEach(() => {
  jest.clearAllMocks()
  MockOwnershipResolver.mockReturnValue(new Map([['r1', []]]))
})

describe('resolveElectCell — real structural gate selects short valid output as winner', () => {
  it('short valid output ("Elephant", 8 chars) passes the real gate and is selected as winner — never reported as empty or refusal', async () => {
    const shortValidStore = makeForkStore('short-valid')
    const emptyStore = makeForkStore('empty')
    const refusalStore = makeForkStore('refusal')

    stubNodeTextExtractorByStore(
      new Map([
        [shortValidStore, 'Elephant'],
        [emptyStore, ''],
        [refusalStore, 'I cannot help with that request'],
      ]),
    )

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: shortValidStore, leafOutputs: []},
      {forkIndex: 1, status: 'ok', forkStore: emptyStore, leafOutputs: []},
      {forkIndex: 2, status: 'ok', forkStore: refusalStore, leafOutputs: []},
    ])

    const store = makeElectStore()
    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store.importer.createErrorNode).not.toHaveBeenCalled()
    expect(store._nodes.r1.title).toContain('[✓')
  })
})

describe('resolveElectCell — real structural gate drives per-fork rejection reasons (gate-to-verdict handoff)', () => {
  it('each fork carries the reason assigned by the real gate: empty-output, refusal-output, and mcp-tool-error — not the collapsed "empty or refusal" string', async () => {
    const forkStore0 = makeForkStore('empty')
    const forkStore1 = makeForkStore('refusal')
    const forkStore2 = makeForkStore('mcp')

    stubNodeTextExtractorByStore(
      new Map([
        [forkStore0, ''],
        [forkStore1, 'I cannot help with that request'],
        [forkStore2, 'substantive text that passes empty and refusal checks'],
      ]),
    )

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: forkStore0, leafOutputs: []},
      {forkIndex: 1, status: 'ok', forkStore: forkStore1, leafOutputs: []},
      {forkIndex: 2, status: 'ok', forkStore: forkStore2, leafOutputs: [{executionFailureType: 'mcp-tool-error'}]},
    ])

    const store = makeElectStore()
    await resolveElectCell(store.getNode('r1'), store, new Map())

    const [msg] = store.importer.createErrorNode.mock.calls[0]
    expect(msg).toContain('fork 0: empty-output')
    expect(msg).toContain('fork 1: refusal-output')
    expect(msg).toContain('fork 2: mcp-tool-error')
    expect(msg).not.toContain('empty or refusal output')
  })
})
