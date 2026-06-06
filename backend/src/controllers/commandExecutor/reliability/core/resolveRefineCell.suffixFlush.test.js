import {resolveRefineCell} from './resolveRefineCell'
import Store from '../../commands/utils/Store'
import {ForkJudge} from './ForkJudge'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('./SubtreeForkRunner', () => ({runForks: jest.fn()}))
jest.mock('./ForkJudge', () => ({ForkJudge: jest.fn()}))

const {runForks: mockRunForks} = require('./SubtreeForkRunner')
const MockForkJudge = ForkJudge

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

const makeOuterStore = () =>
  buildStore({
    r1: {id: 'r1', title: 'Analyze competitors', command: '/refine :n=2', children: ['v1']},
    v1: {
      id: 'v1',
      parent: 'r1',
      command: '/validate must include revenue figures',
      title: '/validate must include revenue figures',
      children: [],
    },
  })

const makeForkStoreWithValidateTitle = validateTitle =>
  buildStore({
    r1: {id: 'r1', command: '/refine :n=2', children: ['v1']},
    v1: {
      id: 'v1',
      parent: 'r1',
      command: '/validate must include revenue figures',
      title: validateTitle,
      children: [],
    },
  })

beforeEach(() => {
  jest.clearAllMocks()
  MockForkJudge.mockImplementation(() => ({selectWinner: jest.fn().mockResolvedValue(null)}))
})

describe('resolveRefineCell — strict all-fail', () => {
  describe('validate title sync to outer store', () => {
    it('single owned child validate title flushed from first criteria-failed fork', async () => {
      const store = makeOuterStore()
      const forkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [✗ 3 attempts]')

      mockRunForks.mockResolvedValue([
        {forkIndex: 0, status: 'criteria-failed', forkStore},
        {
          forkIndex: 1,
          status: 'criteria-failed',
          forkStore: makeForkStoreWithValidateTitle('/validate must include revenue figures [✗ 3 attempts]'),
        },
      ])

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      const outputNodes = store.getOutput().nodes
      const validate = outputNodes.find(n => n.id === 'v1')
      expect(validate).toBeDefined()
      expect(validate.title).toBe('/validate must include revenue figures [✗ 3 attempts]')
    })

    it('first criteria-failed fork is exclusive diagnostic source when multiple forks fail', async () => {
      const store = makeOuterStore()
      const fork0Store = makeForkStoreWithValidateTitle('/validate must include revenue figures [✗ 1 attempts]')
      const fork1Store = makeForkStoreWithValidateTitle('/validate must include revenue figures [✗ 5 attempts]')

      mockRunForks.mockResolvedValue([
        {forkIndex: 0, status: 'criteria-failed', forkStore: fork0Store},
        {forkIndex: 1, status: 'criteria-failed', forkStore: fork1Store},
      ])

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      const outputNodes = store.getOutput().nodes
      const validate = outputNodes.find(n => n.id === 'v1')
      expect(validate).toBeDefined()
      expect(validate.title).toBe('/validate must include revenue figures [✗ 1 attempts]')
    })

    it('all owned validate titles flushed for multi-criterion topology', async () => {
      const store = buildStore({
        r1: {id: 'r1', command: '/refine :n=2', children: ['v1', 'v2']},
        v1: {
          id: 'v1',
          parent: 'r1',
          command: '/validate must include companies',
          title: '/validate must include companies',
          children: [],
        },
        v2: {
          id: 'v2',
          parent: 'r1',
          command: '/validate must include revenue',
          title: '/validate must include revenue',
          children: [],
        },
      })
      const diagnosticForkStore = buildStore({
        r1: {id: 'r1', command: '/refine :n=2', children: ['v1', 'v2']},
        v1: {
          id: 'v1',
          parent: 'r1',
          command: '/validate must include companies',
          title: '/validate must include companies [✗ 3 attempts]',
          children: [],
        },
        v2: {
          id: 'v2',
          parent: 'r1',
          command: '/validate must include revenue',
          title: '/validate must include revenue [✓]',
          children: [],
        },
      })

      mockRunForks.mockResolvedValue([
        {forkIndex: 0, status: 'criteria-failed', forkStore: diagnosticForkStore},
        {forkIndex: 1, status: 'criteria-failed', forkStore: diagnosticForkStore},
      ])

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      const outputNodes = store.getOutput().nodes
      expect(outputNodes.find(n => n.id === 'v1')?.title).toBe('/validate must include companies [✗ 3 attempts]')
      expect(outputNodes.find(n => n.id === 'v2')?.title).toBe('/validate must include revenue [✓]')
    })

    it('refine cell carries [✗ 0/N] suffix in output', async () => {
      const store = makeOuterStore()
      const forkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [✗ 3 attempts]')

      mockRunForks.mockResolvedValue([
        {forkIndex: 0, status: 'criteria-failed', forkStore},
        {forkIndex: 1, status: 'criteria-failed', forkStore},
      ])

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      const outputNodes = store.getOutput().nodes
      const refine = outputNodes.find(n => n.id === 'r1')
      expect(refine).toBeDefined()
      expect(refine.title).toMatch(/\[✗ 0\/2\]/)
    })
    it('judge noSignal + all forks ok → refine carries [⚠ no judge signal], validate not flushed (no diagnostic source)', async () => {
      const store = makeOuterStore()
      const forkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [✓]')

      mockRunForks.mockResolvedValue([
        {forkIndex: 0, status: 'ok', forkStore},
        {forkIndex: 1, status: 'ok', forkStore},
      ])
      MockForkJudge.mockImplementation(() => ({
        selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: null, noSignal: true}),
      }))

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      const outputNodes = store.getOutput().nodes
      const refine = outputNodes.find(n => n.id === 'r1')
      expect(refine).toBeDefined()
      expect(refine.title).toMatch(/\[⚠ no judge signal\]/)
      expect(outputNodes.find(n => n.id === 'v1')).toBeUndefined()
    })

    it('judge noSignal + criteria-failed fork present → refine carries [⚠ no judge signal], validate IS flushed from diagnostic fork', async () => {
      const store = makeOuterStore()
      const diagnosticForkStore = makeForkStoreWithValidateTitle(
        '/validate must include revenue figures [✗ 2 attempts]',
      )

      mockRunForks.mockResolvedValue([
        {forkIndex: 0, status: 'criteria-failed', forkStore: diagnosticForkStore},
        {forkIndex: 1, status: 'criteria-failed', forkStore: diagnosticForkStore},
      ])
      MockForkJudge.mockImplementation(() => ({
        selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: null, noSignal: true}),
      }))

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      const outputNodes = store.getOutput().nodes
      const refine = outputNodes.find(n => n.id === 'r1')
      expect(refine.title).toMatch(/\[⚠ no judge signal\]/)
      const validate = outputNodes.find(n => n.id === 'v1')
      expect(validate).toBeDefined()
      expect(validate.title).toBe('/validate must include revenue figures [✗ 2 attempts]')
    })

    it('judge returns winnerForkIndex:null with noSignal:false → refine carries [✗ 0/N], not [⚠ no judge signal]', async () => {
      const store = makeOuterStore()
      const forkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [✗ 3 attempts]')

      mockRunForks.mockResolvedValue([
        {forkIndex: 0, status: 'criteria-failed', forkStore},
        {forkIndex: 1, status: 'criteria-failed', forkStore},
      ])
      MockForkJudge.mockImplementation(() => ({
        selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: null, noSignal: false}),
      }))

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      const outputNodes = store.getOutput().nodes
      const refine = outputNodes.find(n => n.id === 'r1')
      expect(refine.title).toMatch(/\[✗ 0\/2\]/)
      expect(refine.title).not.toMatch(/no judge signal/)
    })
  })

  describe('validate reliabilityMetadata sync to outer store', () => {
    it('reliabilityMetadata from diagnostic fork transferred to outer store validate node', async () => {
      const store = makeOuterStore()
      const diagnosticMeta = {verdict: 'fail', attempts: 3, criterion: 'must include revenue figures'}
      const forkStore = buildStore({
        r1: {id: 'r1', command: '/refine :n=2', children: ['v1']},
        v1: {
          id: 'v1',
          parent: 'r1',
          command: '/validate must include revenue figures',
          title: '/validate must include revenue figures [✗ 3 attempts]',
          reliabilityMetadata: diagnosticMeta,
          children: [],
        },
      })

      mockRunForks.mockResolvedValue([
        {forkIndex: 0, status: 'criteria-failed', forkStore},
        {forkIndex: 1, status: 'criteria-failed', forkStore},
      ])

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      const outputNodes = store.getOutput().nodes
      const validate = outputNodes.find(n => n.id === 'v1')
      expect(validate).toBeDefined()
      expect(validate.reliabilityMetadata).toEqual(diagnosticMeta)
    })
  })

  describe('diagnostic source selection', () => {
    it('all runtime-failed forks: no validate flush and refine carries [✗ 0/N] failure suffix', async () => {
      const store = makeOuterStore()

      mockRunForks.mockResolvedValue([
        {forkIndex: 0, status: 'runtime-failed', forkStore: null},
        {forkIndex: 1, status: 'runtime-failed', forkStore: null},
      ])

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      const outputNodes = store.getOutput().nodes
      expect(outputNodes.find(n => n.id === 'v1')).toBeUndefined()
      expect(outputNodes.find(n => n.id === 'r1')?.title).toMatch(/\[✗ 0\/2\]/)
    })

    it('mixed runtime-and-criteria failures: criteria-failed fork provides the diagnostic source', async () => {
      const store = makeOuterStore()
      const criteriaForkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [✗ 2 attempts]')

      mockRunForks.mockResolvedValue([
        {forkIndex: 0, status: 'runtime-failed', forkStore: null},
        {forkIndex: 1, status: 'criteria-failed', forkStore: criteriaForkStore},
      ])

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      const outputNodes = store.getOutput().nodes
      const validate = outputNodes.find(n => n.id === 'v1')
      expect(validate).toBeDefined()
      expect(validate.title).toBe('/validate must include revenue figures [✗ 2 attempts]')
    })
  })

  describe('ownership topology', () => {
    it('grandchild validate two levels below /refine is flushed on all-fail', async () => {
      const store = buildStore({
        r1: {id: 'r1', command: '/refine :n=2', children: ['step1']},
        step1: {id: 'step1', parent: 'r1', command: '/chat', children: ['v1']},
        v1: {
          id: 'v1',
          parent: 'step1',
          command: '/validate must be concise',
          title: '/validate must be concise',
          children: [],
        },
      })
      const forkStore = buildStore({
        r1: {id: 'r1', command: '/refine :n=2', children: ['step1']},
        step1: {id: 'step1', parent: 'r1', command: '/chat', children: ['v1']},
        v1: {
          id: 'v1',
          parent: 'step1',
          command: '/validate must be concise',
          title: '/validate must be concise [✗ 2 attempts]',
          children: [],
        },
      })

      mockRunForks.mockResolvedValue([
        {forkIndex: 0, status: 'criteria-failed', forkStore},
        {forkIndex: 1, status: 'criteria-failed', forkStore},
      ])

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      const outputNodes = store.getOutput().nodes
      expect(outputNodes.find(n => n.id === 'v1')?.title).toBe('/validate must be concise [✗ 2 attempts]')
    })

    it('validate absent from diagnostic fork left at pre-fork title, not included in output', async () => {
      const store = buildStore({
        r1: {id: 'r1', command: '/refine :n=2', children: ['v1']},
        v1: {
          id: 'v1',
          parent: 'r1',
          command: '/validate criterion',
          title: 'original title',
          children: [],
        },
      })
      const diagnosticForkStore = buildStore({
        r1: {id: 'r1', command: '/refine :n=2', children: []},
      })

      mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'criteria-failed', forkStore: diagnosticForkStore}])

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      expect(store.getNode('v1').title).toBe('original title')
      expect(store.getOutput().nodes.find(n => n.id === 'v1')).toBeUndefined()
    })

    it('no owned validates: flush is no-op, refine error node still written', async () => {
      const store = buildStore({r1: {id: 'r1', command: '/refine :n=2', children: []}})
      const emptyForkStore = buildStore({r1: {id: 'r1', command: '/refine :n=2', children: []}})

      mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'criteria-failed', forkStore: emptyForkStore}])

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      const outputNodes = store.getOutput().nodes
      const refineNode = outputNodes.find(n => n.id === 'r1')
      expect(refineNode).toBeDefined()
      expect(refineNode.title).toMatch(/\[✗ 0\/2\]/)
    })
  })
})

describe('resolveRefineCell — winner path: validate flush sources from winner fork, not criteria-failed fork', () => {
  it('mixed ok+criteria-failed run: owned validate title comes from winner fork store', async () => {
    const store = makeOuterStore()
    const winnerForkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [✓]')
    const loserForkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [✗ 3 attempts]')

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winnerForkStore},
      {forkIndex: 1, status: 'criteria-failed', forkStore: loserForkStore},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 0, selectionLayer: 'primary'}),
    }))

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const outputNodes = store.getOutput().nodes
    const validate = outputNodes.find(n => n.id === 'v1')
    expect(validate).toBeDefined()
    expect(validate.title).toBe('/validate must include revenue figures [✓]')
  })

  it('winner is highest-index fork: flush reads from that fork, not earlier criteria-failed fork', async () => {
    const store = makeOuterStore()
    const criteriaForkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [✗ 2 attempts]')
    const winnerForkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [✓]')

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'criteria-failed', forkStore: criteriaForkStore},
      {forkIndex: 1, status: 'ok', forkStore: winnerForkStore},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 1, selectionLayer: 'primary'}),
    }))

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const outputNodes = store.getOutput().nodes
    const validate = outputNodes.find(n => n.id === 'v1')
    expect(validate).toBeDefined()
    expect(validate.title).toBe('/validate must include revenue figures [✓]')
  })

  it('fallback winner from criteria-failed pool: validate title flushed from fallback winner fork store', async () => {
    const store = makeOuterStore()
    const fallbackWinnerStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [✗ 2 attempts]')
    const otherForkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [✗ 3 attempts]')

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'criteria-failed', forkStore: fallbackWinnerStore},
      {forkIndex: 1, status: 'criteria-failed', forkStore: otherForkStore},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({
        winnerForkIndex: 0,
        selectionLayer: 'fallback',
        mode: 'fallback',
        noSignal: false,
        tiebreakUsed: false,
        perCriterionVerdict: [],
        judgeQualityWarnings: [],
      }),
    }))

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const outputNodes = store.getOutput().nodes
    const validate = outputNodes.find(n => n.id === 'v1')
    expect(validate?.title).toBe('/validate must include revenue figures [✗ 2 attempts]')
    expect(outputNodes.find(n => n.id === 'r1')?.title).toMatch(/\[⚠ fallback/)
  })
})

describe('resolveRefineCell — winner path: reliabilityMetadata and memoMap contract', () => {
  it('reliabilityMetadata on refine node includes judgeInput from verdict after winner selection', async () => {
    const store = makeOuterStore()
    const winnerForkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [\u2713]')
    const judgeInputFixture = {
      candidateCount: 2,
      perForkBudgetChars: 8000,
      degradedInput: false,
      resolvedJudgeFamilies: ['OpenAI'],
    }

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winnerForkStore},
      {forkIndex: 1, status: 'ok', forkStore: winnerForkStore},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({
        winnerForkIndex: 0,
        perCriterionVerdict: [],
        mode: 'strict',
        selectionLayer: 'primary',
        noSignal: false,
        tiebreakUsed: false,
        judgeInput: judgeInputFixture,
        judgeQualityWarnings: [],
      }),
    }))

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const refineNode = store.getOutput().nodes.find(n => n.id === 'r1')
    expect(refineNode?.reliabilityMetadata).toMatchObject({
      winnerForkIndex: 0,
      mode: 'strict',
      selectionLayer: 'primary',
      eligible: 2,
      total: 2,
      judgeInput: judgeInputFixture,
    })
  })

  it('reliabilityMetadata.judgeInput is undefined when judge was not invoked (single candidate)', async () => {
    const store = buildStore({
      r1: {id: 'r1', command: '/refine :n=2', children: []},
    })

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: buildStore({r1: {id: 'r1', command: '/refine :n=2', children: []}})},
      {forkIndex: 1, status: 'runtime-failed', forkStore: null},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({
        winnerForkIndex: 0,
        perCriterionVerdict: [],
        mode: 'strict',
        selectionLayer: 'primary',
        noSignal: false,
        tiebreakUsed: false,
        judgeInput: undefined,
        judgeQualityWarnings: [],
      }),
    }))

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const refineNode = store.getOutput().nodes.find(n => n.id === 'r1')
    expect(refineNode?.reliabilityMetadata?.judgeInput).toBeUndefined()
  })

  it('memoMap carries the winner forkStore after successful resolution', async () => {
    const store = makeOuterStore()
    const winnerForkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [\u2713]')

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winnerForkStore},
      {forkIndex: 1, status: 'ok', forkStore: winnerForkStore},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({
        winnerForkIndex: 0,
        perCriterionVerdict: [],
        mode: 'strict',
        selectionLayer: 'primary',
        noSignal: false,
        tiebreakUsed: false,
        judgeQualityWarnings: [],
      }),
    }))

    const memoMap = new Map()
    await resolveRefineCell(store.getNode('r1'), store, memoMap)

    expect(memoMap.get('r1')).toBe(winnerForkStore)
  })

  it('noSignal flag is suppressed in refine suffix when the command carries :fallback — fallback mode implies a winner was chosen regardless of judge ranking', async () => {
    const fallbackStore = buildStore({
      r1: {id: 'r1', title: 'Analyze competitors', command: '/refine :n=2 :fallback', children: ['v1']},
      v1: {
        id: 'v1',
        parent: 'r1',
        command: '/validate must include revenue figures',
        title: '/validate must include revenue figures',
        children: [],
      },
    })
    const winnerForkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [✗ 1 attempts]')

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'criteria-failed', forkStore: winnerForkStore},
      {forkIndex: 1, status: 'criteria-failed', forkStore: winnerForkStore},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({
        winnerForkIndex: 0,
        selectionLayer: 'fallback',
        mode: 'fallback',
        noSignal: true,
        tiebreakUsed: false,
        perCriterionVerdict: [],
        judgeQualityWarnings: [],
      }),
    }))

    await resolveRefineCell(fallbackStore.getNode('r1'), fallbackStore, new Map())

    const refine = fallbackStore.getOutput().nodes.find(n => n.id === 'r1')
    expect(refine?.title).not.toMatch(/no judge signal/)
    expect(refine?.title).toMatch(/fallback/)
  })

  it('memoMap carries null after strict all-fail', async () => {
    const store = makeOuterStore()
    const forkStore = makeForkStoreWithValidateTitle('/validate must include revenue figures [\u2717 3 attempts]')

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'criteria-failed', forkStore},
      {forkIndex: 1, status: 'criteria-failed', forkStore},
    ])

    const memoMap = new Map()
    await resolveRefineCell(store.getNode('r1'), store, memoMap)

    expect(memoMap.get('r1')).toBeNull()
  })
})

describe('sibling validate topology — flush on strict all-fail', () => {
  const makeSiblingStore = () =>
    buildStore({
      parent: {id: 'parent', command: '/chat', children: ['r1', 'sv']},
      r1: {id: 'r1', parent: 'parent', command: '/refine :n=2', children: []},
      sv: {
        id: 'sv',
        parent: 'parent',
        command: '/validate must include revenue',
        title: '/validate must include revenue',
        children: [],
      },
    })

  const makeSiblingForkStore = validateTitle =>
    buildStore({
      parent: {id: 'parent', command: '/chat', children: ['r1', 'sv']},
      r1: {id: 'r1', parent: 'parent', command: '/refine :n=2', children: []},
      sv: {
        id: 'sv',
        parent: 'parent',
        command: '/validate must include revenue',
        title: validateTitle,
        children: [],
      },
    })

  it('sibling validate title flushed to outer store on strict all-fail', async () => {
    const store = makeSiblingStore()
    const forkStore = makeSiblingForkStore('/validate must include revenue [✗ 2 attempts]')

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'criteria-failed', forkStore},
      {forkIndex: 1, status: 'criteria-failed', forkStore},
    ])

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const outputNodes = store.getOutput().nodes
    const sibling = outputNodes.find(n => n.id === 'sv')
    expect(sibling).toBeDefined()
    expect(sibling.title).toBe('/validate must include revenue [✗ 2 attempts]')
  })

  it('sibling validate title flushed to outer store on winner path', async () => {
    const store = makeSiblingStore()
    const winnerForkStore = makeSiblingForkStore('/validate must include revenue [✓]')

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winnerForkStore},
      {forkIndex: 1, status: 'ok', forkStore: makeSiblingForkStore('/validate must include revenue [✓]')},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 0, selectionLayer: 'primary'}),
    }))

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const outputNodes = store.getOutput().nodes
    const sibling = outputNodes.find(n => n.id === 'sv')
    expect(sibling).toBeDefined()
    expect(sibling.title).toBe('/validate must include revenue [✓]')
  })

  it('both sibling and descendant validates flushed on strict all-fail', async () => {
    const store = buildStore({
      parent: {id: 'parent', command: '/chat', children: ['r1', 'sv']},
      r1: {id: 'r1', parent: 'parent', command: '/refine :n=2', children: ['dv']},
      dv: {
        id: 'dv',
        parent: 'r1',
        command: '/validate must be concise',
        title: '/validate must be concise',
        children: [],
      },
      sv: {
        id: 'sv',
        parent: 'parent',
        command: '/validate must include revenue',
        title: '/validate must include revenue',
        children: [],
      },
    })

    const forkStore = buildStore({
      parent: {id: 'parent', command: '/chat', children: ['r1', 'sv']},
      r1: {id: 'r1', parent: 'parent', command: '/refine :n=2', children: ['dv']},
      dv: {
        id: 'dv',
        parent: 'r1',
        command: '/validate must be concise',
        title: '/validate must be concise [✗ 3 attempts]',
        children: [],
      },
      sv: {
        id: 'sv',
        parent: 'parent',
        command: '/validate must include revenue',
        title: '/validate must include revenue [✗ 1 attempts]',
        children: [],
      },
    })

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'criteria-failed', forkStore},
      {forkIndex: 1, status: 'criteria-failed', forkStore},
    ])

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const outputNodes = store.getOutput().nodes
    expect(outputNodes.find(n => n.id === 'dv')?.title).toBe('/validate must be concise [✗ 3 attempts]')
    expect(outputNodes.find(n => n.id === 'sv')?.title).toBe('/validate must include revenue [✗ 1 attempts]')
  })
})
