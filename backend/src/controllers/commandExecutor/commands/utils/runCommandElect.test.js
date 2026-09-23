/**
 *
 * resolveElectCell is NOT mocked — it runs naturally.
 * The test controls the result by mocking SubtreeForkRunner.runForks and ForkJudge.
 * StoreFork.applyCandidate is mocked to isolate store-merge side effects.
 */
import {runCommand} from './runCommand'
import Store from './Store'

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

  it('post-processing /elect enables source-candidate admission for the already-produced parent output', async () => {
    const winnerForkStore = makeOkForkStore()
    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winnerForkStore},
      {forkIndex: 1, status: 'ok', forkStore: makeOkForkStore()},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 0, selectionLayer: 'primary'}),
    }))

    const store = buildStore({
      parent: {
        id: 'parent',
        parent: null,
        command: '/chat do task',
        children: ['out', 'elect'],
        prompts: ['out'],
      },
      out: {id: 'out', parent: 'parent', title: 'existing output', children: []},
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

    expect(mockRunForks).toHaveBeenCalledWith(
      expect.objectContaining({
        electNode: expect.objectContaining({id: 'elect'}),
        admitSourceCandidate: true,
      }),
    )
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

describe('/elect :n=N /term — inline form where elect carries its own generating term', () => {
  it('executes through resolveElectCell rather than the modifier root-error path', async () => {
    const store = buildStore({
      elect: {
        id: 'elect',
        parent: null,
        command: '/elect :n=2 /chatgpt propose directions',
        children: [],
      },
    })
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    mockRunForks.mockResolvedValue([])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue(null),
    }))

    await runCommand({
      queryType: 'elect',
      cell: store.getNode('elect'),
      store,
      memoMap: new Map(),
    })

    expect(createErrorSpy).not.toHaveBeenCalledWith(expect.stringMatching(/requires a parent cell/), expect.anything())
    expect(mockRunForks).toHaveBeenCalled()
    expect(store._nodes['elect:term']).toBeUndefined()
    expect(store._nodes['elect'].parent).toBeNull()
  })

  it('bare elect without inline term still writes modifier-root error', async () => {
    const store = buildStore({
      elect: {
        id: 'elect',
        parent: null,
        command: '/elect :n=2',
        children: [],
      },
    })
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    await runCommand({queryType: 'elect', cell: store.getNode('elect'), store})

    expect(createErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/elect requires a parent cell/), 'elect')
    expect(mockRunForks).not.toHaveBeenCalled()
  })

  it('trailing criterion prose (not a command) still writes modifier-root error', async () => {
    const store = buildStore({
      elect: {
        id: 'elect',
        parent: null,
        command: '/elect :n=2 must cite sources',
        children: [],
      },
    })
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    await runCommand({queryType: 'elect', cell: store.getNode('elect'), store})

    expect(createErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/elect requires a parent cell/), 'elect')
    expect(mockRunForks).not.toHaveBeenCalled()
  })

  // Root routing must send an external-dispatch-shaped term into resolveElectCell so it is refused as
  // an external dispatch, not diverted to the modifier-root path where the /mcp: shape reads as an
  // unrecognised bare modifier. Generalised over both external transports and asserted with no alias
  // configured, so the refusal turns on the command shape alone.
  it.each([
    ['/elect :n=3 /mcp:jira create issue', 'MCP'],
    ['/elect :n=2 /rpc:worker run', 'RPC'],
  ])('routes an inline %s external-dispatch term into the refusal path, not the modifier-root error', async command => {
    const store = buildStore({elect: {id: 'elect', parent: null, command, children: []}})
    store._aliases = {mcp: [], rpc: []}
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    await runCommand({queryType: 'elect', cell: store.getNode('elect'), store, memoMap: new Map()})

    expect(createErrorSpy).not.toHaveBeenCalledWith(expect.stringMatching(/requires a parent cell/), expect.anything())
    const [msg] = createErrorSpy.mock.calls[0]
    expect(msg).toContain('external dispatch')
    expect(msg).not.toContain('side effect')
    expect(mockRunForks).not.toHaveBeenCalled()
    expect(store.getNode('elect').reliabilityMetadata.failureCause).toBe('external-dispatch-refused')
  })
})

describe('/refine :n=N /term — top-level inline refine routes into the refine engine', () => {
  // A top-level /refine :n=N <term> now wraps its own generating term, mirroring root /elect.
  // The bare and criterion-prose forms carry no term to wrap and stay refused as modifier roots.

  it('routes a top-level inline term into refine, requiring a /validate child rather than refusing as a modifier root', async () => {
    const store = buildStore({
      refine: {
        id: 'refine',
        parent: null,
        command: '/refine :n=2 /chatgpt propose directions',
        children: [],
      },
    })
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    await runCommand({queryType: 'refine', cell: store.getNode('refine'), store})

    expect(createErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/requires at least one direct \/validate child/),
      'refine',
    )
    expect(createErrorSpy).not.toHaveBeenCalledWith(expect.stringMatching(/requires a parent cell/), 'refine')
  })

  it('bare /refine without inline term still writes modifier-root error', async () => {
    const store = buildStore({
      refine: {id: 'refine', parent: null, command: '/refine :n=2', children: []},
    })
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    await runCommand({queryType: 'refine', cell: store.getNode('refine'), store})

    expect(createErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/requires a parent cell/), 'refine')
  })

  it('trailing criterion prose still writes modifier-root error even for /refine', async () => {
    const store = buildStore({
      refine: {id: 'refine', parent: null, command: '/refine :n=2 must cite sources', children: []},
    })
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    await runCommand({queryType: 'refine', cell: store.getNode('refine'), store})

    expect(createErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/requires a parent cell/), 'refine')
  })
})
