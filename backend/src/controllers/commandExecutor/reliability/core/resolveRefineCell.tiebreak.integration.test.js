import {resolveRefineCell} from './resolveRefineCell'
import OwnershipResolver from './OwnershipResolver'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('./SubtreeForkRunner', () => ({runForks: jest.fn(), computeEffectiveN: jest.fn((_r, _s, n) => n)}))
jest.mock('./StoreFork', () => ({
  applyCandidate: jest.fn(),
  createFork: jest.fn(),
}))
jest.mock('./OwnershipResolver', () => jest.fn())
jest.mock('./ForkProgressEmitter', () => ({
  NullForkProgressEmitter: jest.fn(() => ({
    forksStarted: jest.fn(),
    forkSettled: jest.fn(),
    refineComplete: jest.fn(),
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
  getIntegrationSettings: jest.fn(),
  determineLLMType: jest.fn(),
  getLLM: jest.fn(),
}))

jest.mock('../../commands/utils/NodeTextExtractor', () => ({
  NodeTextExtractor: jest.fn(),
}))

const {runForks: mockRunForks} = require('./SubtreeForkRunner')
const MockOwnershipResolver = OwnershipResolver
const {getIntegrationSettings, getLLM} = require('../../commands/utils/langchain/getLLM')
const {NodeTextExtractor} = require('../../commands/utils/NodeTextExtractor')

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

const makeRefineStore = () => {
  const store = buildStore({
    p1: {
      id: 'p1',
      parent: null,
      children: ['r1'],
      command: '/chat task',
      title: 'Parent',
    },
    r1: {
      id: 'r1',
      parent: 'p1',
      title: 'Refine Cell',
      command: '/refine :n=2',
      children: [],
    },
  })
  jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
  jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})
  return store
}

const make3ForkRefineStore = () => {
  const store = buildStore({
    p1: {
      id: 'p1',
      parent: null,
      children: ['r1'],
      command: '/chat task',
      title: 'Parent',
    },
    r1: {
      id: 'r1',
      parent: 'p1',
      title: 'Refine Cell',
      command: '/refine :n=3',
      children: [],
    },
  })
  jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
  jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})
  return store
}

const makeForkStore = (forkIndex, n = 2) =>
  buildStore({
    p1: {
      id: 'p1',
      parent: null,
      children: ['r1'],
      title: `Fork-${forkIndex} parent output`,
      command: '/chat task',
    },
    r1: {
      id: 'r1',
      parent: 'p1',
      title: `Fork-${forkIndex} result`,
      command: `/refine :n=${n}`,
      children: [],
    },
  })

const makeValidateNode = (id, command) => buildStore({[id]: {id, parent: 'p1', command, children: []}}).getNode(id)

const TWO_FAMILIES = {openai: {apiKey: 'k'}, claude: {apiKey: 'c'}}

const mockLLMWithContent = content => ({
  llm: {invoke: jest.fn().mockResolvedValue({content})},
  chunkSize: 100_000,
})

beforeEach(() => {
  jest.clearAllMocks()
  getIntegrationSettings.mockResolvedValue(TWO_FAMILIES)
  NodeTextExtractor.mockImplementation(() => ({
    extractFullContent: jest
      .fn()
      .mockImplementation(node => Promise.resolve(`substantive output for node ${node?.id ?? 'node'}`)),
  }))
})

describe('resolveRefineCell — real ForkJudge Borda scoring → reliabilityMetadata contract', () => {
  it('complete Borda tie: two forks, two criteria, opposing juror rankings — fork-0 wins by position; tiebreakUsed:true', async () => {
    getLLM.mockReturnValueOnce(mockLLMWithContent('1,2')).mockReturnValueOnce(mockLLMWithContent('2,1'))

    MockOwnershipResolver.mockReturnValue(
      new Map([
        [
          'r1',
          [makeValidateNode('va', '/validate :n=1 quality'), makeValidateNode('vb', '/validate :n=1 completeness')],
        ],
      ]),
    )

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: makeForkStore(0)},
      {forkIndex: 1, status: 'ok', forkStore: makeForkStore(1)},
    ])

    const store = makeRefineStore()
    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const meta = store.getNode('r1').reliabilityMetadata
    expect(meta.tiebreakUsed).toBe(true)
    expect(meta.winnerForkIndex).toBe(0)
    expect(meta.eligible).toBe(2)
    expect(meta.total).toBe(2)
  })

  it('partial Borda tie: three forks, two jurors split on top two — fork-0 wins by position; fork-2 not in tie; tiebreakUsed:true', async () => {
    getLLM.mockReturnValueOnce(mockLLMWithContent('1,2,3')).mockReturnValueOnce(mockLLMWithContent('2,1,3'))

    MockOwnershipResolver.mockReturnValue(new Map([['r1', [makeValidateNode('v1', '/validate :n=2 criterion')]]]))

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: makeForkStore(0, 3)},
      {forkIndex: 1, status: 'ok', forkStore: makeForkStore(1, 3)},
      {forkIndex: 2, status: 'ok', forkStore: makeForkStore(2, 3)},
    ])

    const store = make3ForkRefineStore()
    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const meta = store.getNode('r1').reliabilityMetadata
    expect(meta.tiebreakUsed).toBe(true)
    expect(meta.winnerForkIndex).toBe(0)
    expect(meta.eligible).toBe(3)
    expect(meta.total).toBe(3)
  })

  it('no tie: two forks, both jurors agree on winner — tiebreakUsed:false; losing fork in discardedForks', async () => {
    getLLM.mockReturnValue(mockLLMWithContent('1,2'))

    MockOwnershipResolver.mockReturnValue(new Map([['r1', [makeValidateNode('v1', '/validate :n=2 criterion')]]]))

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: makeForkStore(0)},
      {forkIndex: 1, status: 'ok', forkStore: makeForkStore(1)},
    ])

    const store = makeRefineStore()
    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const meta = store.getNode('r1').reliabilityMetadata
    expect(meta.tiebreakUsed).toBe(false)
    expect(meta.winnerForkIndex).toBe(0)
    expect(meta.discardedForks).toEqual([{forkIndex: 1, status: 'ok'}])
  })

  it('full reliabilityMetadata field contract — all fields present with correct types and values', async () => {
    getLLM.mockReturnValue(mockLLMWithContent('1,2'))

    MockOwnershipResolver.mockReturnValue(new Map([['r1', [makeValidateNode('v1', '/validate :n=1 criterion')]]]))

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: makeForkStore(0)},
      {forkIndex: 1, status: 'ok', forkStore: makeForkStore(1)},
    ])

    const store = makeRefineStore()
    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const meta = store.getNode('r1').reliabilityMetadata

    expect(meta.winnerForkIndex).toBe(0)
    expect(meta.tiebreakUsed).toBe(false)
    expect(meta.noSignal).toBe(false)
    expect(meta.mode).toBe('strict')
    expect(meta.selectionLayer).toBe('primary')
    expect(meta.eligible).toBe(2)
    expect(meta.total).toBe(2)
    expect(meta.judgeQualityWarnings).toEqual([])
    expect(meta.discardedForks).toEqual([{forkIndex: 1, status: 'ok'}])

    expect(meta.perCriterionVerdict).toHaveLength(1)
    expect(meta.perCriterionVerdict[0]).toMatchObject({
      criterionId: 'v1',
      criterion: 'criterion',
      forkRankings: [
        {forkIndex: 0, rank: 1},
        {forkIndex: 1, rank: 2},
      ],
    })

    expect(meta.judgeInput).toMatchObject({
      candidateCount: 2,
      degradedInput: false,
      resolvedJudgeFamilies: ['OpenAI'],
    })
    expect(typeof meta.judgeInput.perForkBudgetChars).toBe('number')
  })
})
