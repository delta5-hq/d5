/**
 *
 * resolveElectCell is NOT mocked — it runs naturally.
 * The test controls the result by mocking SubtreeForkRunner.runForks and ForkJudge.
 * StoreFork.applyCandidate is mocked to isolate store-merge side effects.
 */
import {runCommand} from './runCommand'
import Store from './Store'
import {MCP_FUSION_QUERY_TYPE} from '../../constants/mcpFusion'
import {MEMO_SENTINEL_PRE_EXECUTED_CHILD} from '../../reliability/core/memoSentinels'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../../ProgressReporter', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    add: jest.fn(async label => label),
    remove: jest.fn(),
    dispose: jest.fn(),
    registerChild: jest.fn(),
  })),
}))

// Mock SubtreeForkRunner so forks return controlled results without real LLM calls
jest.mock('../../reliability/core/SubtreeForkRunner', () => ({
  runForks: jest.fn(),
  computeEffectiveN: jest.fn((_r, _s, n) => n),
}))

// Mock ForkJudge so winner selection is deterministic
jest.mock('../../reliability/core/ForkJudge', () => ({ForkJudge: jest.fn()}))

// Mock StoreFork.applyCandidate to prevent actual store merging; verify it's called
jest.mock('../../reliability/core/StoreFork', () => ({
  __esModule: true,
  default: {
    createFork: jest.fn(s => s),
    applyCandidate: jest.fn(),
  },
}))

// ElectTopology must return empty to avoid triggering nested /elect resolution
jest.mock('../../reliability/core/ElectTopology', () => jest.fn(() => []))

const {runForks: mockRunForks} = require('../../reliability/core/SubtreeForkRunner')
const {ForkJudge: MockForkJudge} = require('../../reliability/core/ForkJudge')
const MockStoreFork = require('../../reliability/core/StoreFork').default

const buildStore = nodeMap => new Store({userId: 'u1', nodes: nodeMap})

// Spy on ChatCommand.run to avoid real LLM call for the parent /chat execution
const chatSpy = () => jest.spyOn(require('../ChatCommand').ChatCommand.prototype, 'run').mockResolvedValue({})

const makeOkForkStore = () =>
  buildStore({
    parent: {
      id: 'parent',
      parent: null,
      command: '/chat do task',
      children: ['elect'],
    },
    elect: {
      id: 'elect',
      parent: 'parent',
      command: '/elect :n=2',
      children: [],
    },
  })

beforeEach(() => {
  jest.clearAllMocks()
  MockForkJudge.mockImplementation(() => ({
    selectWinner: jest.fn().mockResolvedValue(null),
  }))
  mockRunForks.mockResolvedValue([])
})

describe('/elect fusion-child exactly-once sentinel', () => {
  it('does not execute a fusion child again after SubtreeForkRunner pre-executed it', async () => {
    const store = buildStore({
      parent: {id: 'parent', command: '/chat do task', children: ['elect']},
      elect: {id: 'elect', parent: 'parent', command: '/elect :n=2', children: ['fusion']},
      fusion: {id: 'fusion', parent: 'elect', command: '/mcp use configured tools', children: []},
    })
    const fusionRun = jest.spyOn(require('../MCPFusionCommand').MCPFusionCommand.prototype, 'run').mockResolvedValue({})

    await runCommand({
      queryType: MCP_FUSION_QUERY_TYPE,
      cell: store.getNode('fusion'),
      store,
      preventPostProcess: true,
    })

    const memoMap = new Map([
      ['elect', 'in-progress'],
      ['fusion', MEMO_SENTINEL_PRE_EXECUTED_CHILD],
    ])
    const parentRun = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('parent'), store, memoMap})

    expect(parentRun).toHaveBeenCalledTimes(1)
    expect(fusionRun).toHaveBeenCalledTimes(1)
    fusionRun.mockRestore()
    parentRun.mockRestore()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
describe('/elect :n=2 strict mode — winner selected and applied', () => {
  it('calls StoreFork.applyCandidate with the winning forkStore', async () => {
    const winnerForkStore = makeOkForkStore(0)
    const loserForkStore = makeOkForkStore(1)

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winnerForkStore},
      {forkIndex: 1, status: 'ok', forkStore: loserForkStore},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 0, selectionLayer: 'primary'}),
    }))

    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=2',
        children: [],
      },
    })

    const spy = chatSpy()
    await runCommand({
      queryType: 'chat',
      cell: store.getNode('parent'),
      store,
    })
    spy.mockRestore()

    expect(MockStoreFork.applyCandidate).toHaveBeenCalledWith(store, winnerForkStore, 'elect')
  })

  it('updates elect node title with ✓ suffix after winner is applied', async () => {
    const winnerForkStore = makeOkForkStore(0)

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winnerForkStore},
      {forkIndex: 1, status: 'ok', forkStore: makeOkForkStore(1)},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 0, selectionLayer: 'primary'}),
    }))

    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=2',
        children: [],
      },
    })

    const spy = chatSpy()
    await runCommand({
      queryType: 'chat',
      cell: store.getNode('parent'),
      store,
    })
    spy.mockRestore()

    expect(store.getNode('elect').title).toMatch(/\[✓ 2\/2\]/)
  })

  it('does NOT write an error node when a winner is found (strict mode)', async () => {
    const winnerForkStore = makeOkForkStore(0)
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winnerForkStore}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 0, selectionLayer: 'primary'}),
    }))

    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=2',
        children: [],
      },
    })
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    const spy = chatSpy()
    await runCommand({
      queryType: 'chat',
      cell: store.getNode('parent'),
      store,
    })
    spy.mockRestore()

    expect(createErrorSpy).not.toHaveBeenCalled()
  })

  it('passes ownedValidates gathered by OwnershipResolver to ForkJudge.selectWinner', async () => {
    // /validate is a child of /elect → OwnershipResolver assigns it to /elect
    const winnerForkStore = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=2',
        children: ['validate'],
      },
      validate: {
        id: 'validate',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })
    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winnerForkStore},
      {forkIndex: 1, status: 'ok', forkStore: winnerForkStore},
    ])

    let capturedValidateNodes
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn(async ({validateNodes}) => {
        capturedValidateNodes = validateNodes
        return {winnerForkIndex: 0, selectionLayer: 'primary'}
      }),
    }))

    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=2',
        children: ['validate'],
      },
      validate: {
        id: 'validate',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })

    const spy = chatSpy()
    await runCommand({
      queryType: 'chat',
      cell: store.getNode('parent'),
      store,
    })
    spy.mockRestore()

    expect(capturedValidateNodes).toHaveLength(1)
    expect(capturedValidateNodes[0].id).toBe('validate')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
describe('/elect :n=3 :fallback — all forks fail criteria, commits highest-ranked', () => {
  const makeFailedForkStore = () =>
    buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=3 :fallback',
        children: ['validate'],
      },
      validate: {
        id: 'validate',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })

  it('applies the highest-ranked criteria-failed fork via StoreFork.applyCandidate', async () => {
    const f0 = makeFailedForkStore()
    const f1 = makeFailedForkStore()
    const f2 = makeFailedForkStore()

    mockRunForks.mockResolvedValue([
      {
        forkIndex: 0,
        status: 'criteria-failed',
        failedAt: 'must include numbers',
        attempts: 3,
        forkStore: f0,
      },
      {
        forkIndex: 1,
        status: 'criteria-failed',
        failedAt: 'must include numbers',
        attempts: 3,
        forkStore: f1,
      },
      {
        forkIndex: 2,
        status: 'criteria-failed',
        failedAt: 'must include numbers',
        attempts: 3,
        forkStore: f2,
      },
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 1, selectionLayer: 'fallback'}),
    }))

    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=3 :fallback',
        children: ['validate'],
      },
      validate: {
        id: 'validate',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })

    const spy = chatSpy()
    await runCommand({
      queryType: 'chat',
      cell: store.getNode('parent'),
      store,
    })
    spy.mockRestore()

    // f1 is fork at index 1 — the one the mocked judge selected
    expect(MockStoreFork.applyCandidate).toHaveBeenCalledWith(store, f1, 'elect')
  })

  it('updates elect node title with ⚠ fallback suffix including chosen fork index', async () => {
    const f0 = makeFailedForkStore()
    const f1 = makeFailedForkStore()
    const f2 = makeFailedForkStore()

    mockRunForks.mockResolvedValue([
      {
        forkIndex: 0,
        status: 'criteria-failed',
        failedAt: 'must include numbers',
        attempts: 3,
        forkStore: f0,
      },
      {
        forkIndex: 1,
        status: 'criteria-failed',
        failedAt: 'must include numbers',
        attempts: 3,
        forkStore: f1,
      },
      {
        forkIndex: 2,
        status: 'criteria-failed',
        failedAt: 'must include numbers',
        attempts: 3,
        forkStore: f2,
      },
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 1, selectionLayer: 'fallback'}),
    }))

    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=3 :fallback',
        children: ['validate'],
      },
      validate: {
        id: 'validate',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })

    const spy = chatSpy()
    await runCommand({
      queryType: 'chat',
      cell: store.getNode('parent'),
      store,
    })
    spy.mockRestore()

    const title = store.getNode('elect').title
    expect(title).toMatch(/⚠/)
    expect(title).toContain('0/3')
  })

  it('strict mode: no commit when all forks fail criteria — writes error node instead', async () => {
    const f0 = makeFailedForkStore()
    const f1 = makeFailedForkStore()

    mockRunForks.mockResolvedValue([
      {
        forkIndex: 0,
        status: 'criteria-failed',
        failedAt: 'criterion',
        attempts: 3,
        forkStore: f0,
      },
      {
        forkIndex: 1,
        status: 'criteria-failed',
        failedAt: 'criterion',
        attempts: 3,
        forkStore: f1,
      },
    ])
    // selectWinner returns null (strict: no eligible forks)
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: null, selectionLayer: 'none'}),
    }))

    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=2',
        children: [],
      },
    })
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    const spy = chatSpy()
    await runCommand({
      queryType: 'chat',
      cell: store.getNode('parent'),
      store,
    })
    spy.mockRestore()

    expect(MockStoreFork.applyCandidate).not.toHaveBeenCalled()
    expect(createErrorSpy).toHaveBeenCalled()
  })
})

describe('/elect with absent or below-minimum :n= — parse-time refusal visible on cell', () => {
  it.each([['/elect :n=1'], ['/elect :n=0'], ['/elect']])(
    'appends [\u2717 invalid] to elect cell title and launches no forks for command "%s"',
    async command => {
      const store = buildStore({
        parent: {
          id: 'parent',
          parent: null,
          command: '/chat do task',
          children: ['elect'],
        },
        elect: {id: 'elect', parent: 'parent', command, children: []},
      })

      const spy = chatSpy()
      await runCommand({
        queryType: 'chat',
        cell: store.getNode('parent'),
        store,
      })
      spy.mockRestore()

      expect(store.getNode('elect').title).toMatch(/\[\u2717 !\]/)
      expect(mockRunForks).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['/elect :n=1', 1],
    ['/elect :n=0', 0],
  ])('error message names the actual below-minimum :n= value for command "%s"', async (command, rawN) => {
    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {id: 'elect', parent: 'parent', command, children: []},
    })
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    const spy = chatSpy()
    await runCommand({
      queryType: 'chat',
      cell: store.getNode('parent'),
      store,
    })
    spy.mockRestore()

    expect(createErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`/elect :n=${rawN} is a no-op`), 'elect')
  })

  it('error message prompts for :n=N syntax when :n= is absent entirely', async () => {
    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect',
        children: [],
      },
    })
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    const spy = chatSpy()
    await runCommand({
      queryType: 'chat',
      cell: store.getNode('parent'),
      store,
    })
    spy.mockRestore()

    expect(createErrorSpy).toHaveBeenCalledWith(expect.stringContaining('/elect requires :n=N'), 'elect')
  })
})

describe('in-progress /elect — descendant /validate executes inside fork', () => {
  it('validate child of /elect runs when memoMap marks elect as in-progress', async () => {
    const {ValidateCommand} = require('../../reliability/core/ValidateCommand')
    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=2',
        children: ['v'],
      },
      v: {
        id: 'v',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })

    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
      passed: true,
      criterion: 'must include numbers',
      reason: '',
    })
    const spy = chatSpy()
    const memoMap = new Map([['elect', 'in-progress']])

    await runCommand({
      queryType: 'chat',
      cell: store.getNode('parent'),
      store,
      memoMap,
    })

    expect(validateSpy).toHaveBeenCalled()
    spy.mockRestore()
    validateSpy.mockRestore()
  })

  it('CriteriaFailedError propagates when descendant /validate fails all retries in fork context', async () => {
    const {ValidateCommand} = require('../../reliability/core/ValidateCommand')
    const {CriteriaFailedError} = require('../../reliability/core/CriteriaFailedError')
    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=2',
        children: ['v'],
      },
      v: {
        id: 'v',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })

    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
      passed: false,
      criterion: 'must include numbers',
      reason: 'no numbers found',
    })
    const spy = chatSpy()
    const memoMap = new Map([['elect', 'in-progress']])

    let thrown
    try {
      await runCommand({
        queryType: 'chat',
        cell: store.getNode('parent'),
        store,
        memoMap,
      })
    } catch (e) {
      thrown = e
    } finally {
      spy.mockRestore()
      validateSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(CriteriaFailedError)
    expect(thrown.criterion).toBe('must include numbers')
  })

  it('/elect with memoMap value other than in-progress is still skipped', async () => {
    const {ValidateCommand} = require('../../reliability/core/ValidateCommand')
    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=2',
        children: ['v'],
      },
      v: {
        id: 'v',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })

    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
      passed: true,
      criterion: 'criterion',
      reason: '',
    })
    const spy = chatSpy()
    // null = resolved (all-fail), not 'in-progress'
    const memoMap = new Map([['elect', null]])

    await runCommand({
      queryType: 'chat',
      cell: store.getNode('parent'),
      store,
      memoMap,
    })

    expect(validateSpy).not.toHaveBeenCalled()
    spy.mockRestore()
    validateSpy.mockRestore()
  })
})
