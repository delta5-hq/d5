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
    it('all runtime-failed forks: no validate flush when no criteria-failed source available', async () => {
      const store = makeOuterStore()

      mockRunForks.mockResolvedValue([
        {forkIndex: 0, status: 'runtime-failed', forkStore: null},
        {forkIndex: 1, status: 'runtime-failed', forkStore: null},
      ])

      await resolveRefineCell(store.getNode('r1'), store, new Map())

      expect(store.getOutput().nodes.find(n => n.id === 'v1')).toBeUndefined()
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
