/**
 * P0.11 end-to-end wiring tests: runCommand → resolveRefineCell → suffix + applyCandidate.
 *
 * resolveRefineCell is NOT mocked — it runs naturally.
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
jest.mock('../../reliability/core/SubtreeForkRunner', () => ({runForks: jest.fn()}))

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

// RefineTopology must return empty to avoid triggering nested /refine resolution
jest.mock('../../reliability/core/RefineTopology', () => jest.fn(() => []))

const {runForks: mockRunForks} = require('../../reliability/core/SubtreeForkRunner')
const {ForkJudge: MockForkJudge} = require('../../reliability/core/ForkJudge')
const MockStoreFork = require('../../reliability/core/StoreFork').default

const buildStore = nodeMap => new Store({userId: 'u1', nodes: nodeMap})

// Spy on ChatCommand.run to avoid real LLM call for the parent /chat execution
const chatSpy = () => jest.spyOn(require('../ChatCommand').ChatCommand.prototype, 'run').mockResolvedValue({})

const makeOkForkStore = () =>
  buildStore({
    parent: {id: 'parent', parent: null, command: '/chat do task', children: ['refine']},
    refine: {id: 'refine', parent: 'parent', command: '/refine :n=2', children: []},
  })

beforeEach(() => {
  jest.clearAllMocks()
  MockForkJudge.mockImplementation(() => ({selectWinner: jest.fn().mockResolvedValue(null)}))
  mockRunForks.mockResolvedValue([])
})

// ────────────────────────────────────────────────────────────────────────────
// P0.11(a): strict mode — winner picked and applied, title gets ✓ suffix
// ────────────────────────────────────────────────────────────────────────────
describe('P0.11(a): /refine :n=2 strict mode — winner selected and applied', () => {
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
      parent: {id: 'parent', parent: null, command: '/chat do task', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', command: '/refine :n=2', children: []},
    })

    const spy = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('parent'), store})
    spy.mockRestore()

    expect(MockStoreFork.applyCandidate).toHaveBeenCalledWith(store, winnerForkStore, 'refine')
  })

  it('updates refine node title with ✓ suffix after winner is applied', async () => {
    const winnerForkStore = makeOkForkStore(0)

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winnerForkStore},
      {forkIndex: 1, status: 'ok', forkStore: makeOkForkStore(1)},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 0, selectionLayer: 'primary'}),
    }))

    const store = buildStore({
      parent: {id: 'parent', parent: null, command: '/chat do task', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', command: '/refine :n=2', children: []},
    })

    const spy = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('parent'), store})
    spy.mockRestore()

    expect(store.getNode('refine').title).toMatch(/\[✓ 2\/2\]/)
  })

  it('does NOT write an error node when a winner is found (strict mode)', async () => {
    const winnerForkStore = makeOkForkStore(0)
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winnerForkStore}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 0, selectionLayer: 'primary'}),
    }))

    const store = buildStore({
      parent: {id: 'parent', parent: null, command: '/chat do task', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', command: '/refine :n=2', children: []},
    })
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    const spy = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('parent'), store})
    spy.mockRestore()

    expect(createErrorSpy).not.toHaveBeenCalled()
  })

  it('passes ownedValidates gathered by OwnershipResolver to ForkJudge.selectWinner', async () => {
    // /validate is a child of /refine → OwnershipResolver assigns it to /refine
    const winnerForkStore = buildStore({
      parent: {id: 'parent', parent: null, command: '/chat do task', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', command: '/refine :n=2', children: ['validate']},
      validate: {id: 'validate', parent: 'refine', command: '/validate must include numbers', children: []},
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
      parent: {id: 'parent', parent: null, command: '/chat do task', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', command: '/refine :n=2', children: ['validate']},
      validate: {id: 'validate', parent: 'refine', command: '/validate must include numbers', children: []},
    })

    const spy = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('parent'), store})
    spy.mockRestore()

    expect(capturedValidateNodes).toHaveLength(1)
    expect(capturedValidateNodes[0].id).toBe('validate')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// P0.11(b): :fallback mode — all forks fail criteria, commits highest-ranked
// ────────────────────────────────────────────────────────────────────────────
describe('P0.11(b): /refine :n=3 :fallback — all forks fail criteria, commits highest-ranked', () => {
  const makeFailedForkStore = () =>
    buildStore({
      parent: {id: 'parent', parent: null, command: '/chat do task', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', command: '/refine :n=3 :fallback', children: ['validate']},
      validate: {id: 'validate', parent: 'refine', command: '/validate must include numbers', children: []},
    })

  it('applies the highest-ranked criteria-failed fork via StoreFork.applyCandidate', async () => {
    const f0 = makeFailedForkStore()
    const f1 = makeFailedForkStore()
    const f2 = makeFailedForkStore()

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'criteria-failed', failedAt: 'must include numbers', attempts: 3, forkStore: f0},
      {forkIndex: 1, status: 'criteria-failed', failedAt: 'must include numbers', attempts: 3, forkStore: f1},
      {forkIndex: 2, status: 'criteria-failed', failedAt: 'must include numbers', attempts: 3, forkStore: f2},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 1, selectionLayer: 'fallback'}),
    }))

    const store = buildStore({
      parent: {id: 'parent', parent: null, command: '/chat do task', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', command: '/refine :n=3 :fallback', children: ['validate']},
      validate: {id: 'validate', parent: 'refine', command: '/validate must include numbers', children: []},
    })

    const spy = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('parent'), store})
    spy.mockRestore()

    // f1 is fork at index 1 — the one the mocked judge selected
    expect(MockStoreFork.applyCandidate).toHaveBeenCalledWith(store, f1, 'refine')
  })

  it('updates refine node title with ⚠ fallback suffix including chosen fork index', async () => {
    const f0 = makeFailedForkStore()
    const f1 = makeFailedForkStore()
    const f2 = makeFailedForkStore()

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'criteria-failed', failedAt: 'must include numbers', attempts: 3, forkStore: f0},
      {forkIndex: 1, status: 'criteria-failed', failedAt: 'must include numbers', attempts: 3, forkStore: f1},
      {forkIndex: 2, status: 'criteria-failed', failedAt: 'must include numbers', attempts: 3, forkStore: f2},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: 1, selectionLayer: 'fallback'}),
    }))

    const store = buildStore({
      parent: {id: 'parent', parent: null, command: '/chat do task', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', command: '/refine :n=3 :fallback', children: ['validate']},
      validate: {id: 'validate', parent: 'refine', command: '/validate must include numbers', children: []},
    })

    const spy = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('parent'), store})
    spy.mockRestore()

    const title = store.getNode('refine').title
    expect(title).toMatch(/⚠/)
    expect(title).toContain('fallback')
    expect(title).toContain('0/3')
    expect(title).toContain('fork-1')
  })

  it('strict mode: no commit when all forks fail criteria — writes error node instead', async () => {
    const f0 = makeFailedForkStore()
    const f1 = makeFailedForkStore()

    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'criteria-failed', failedAt: 'criterion', attempts: 3, forkStore: f0},
      {forkIndex: 1, status: 'criteria-failed', failedAt: 'criterion', attempts: 3, forkStore: f1},
    ])
    // selectWinner returns null (strict: no eligible forks)
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn().mockResolvedValue({winnerForkIndex: null, selectionLayer: 'none'}),
    }))

    const store = buildStore({
      parent: {id: 'parent', parent: null, command: '/chat do task', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', command: '/refine :n=2', children: []},
    })
    const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

    const spy = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('parent'), store})
    spy.mockRestore()

    expect(MockStoreFork.applyCandidate).not.toHaveBeenCalled()
    expect(createErrorSpy).toHaveBeenCalled()
  })
})
