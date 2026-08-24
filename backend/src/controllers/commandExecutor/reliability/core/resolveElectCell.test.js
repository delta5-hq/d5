import {resolveElectCell} from './resolveElectCell'
import StoreFork from './StoreFork'
import {ForkJudge} from './ForkJudge'
import OwnershipResolver from './OwnershipResolver'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('./SubtreeForkRunner', () => ({
  runForks: jest.fn(),
  computeEffectiveN: jest.fn((electNode, store, n) => n),
}))
jest.mock('./ForkJudge', () => ({ForkJudge: jest.fn()}))
jest.mock('./OwnershipResolver', () => jest.fn())
jest.mock('./StoreFork', () => ({applyCandidate: jest.fn()}))

const {runForks: mockRunForks, computeEffectiveN: mockComputeEffectiveN} = require('./SubtreeForkRunner')
const MockForkJudge = ForkJudge
const MockOwnershipResolver = OwnershipResolver

const buildStore = (nodeMap, opts = {}) =>
  new Store({
    userId: opts.userId || 'user1',
    workflowId: opts.workflowId,
    nodes: nodeMap,
  })

const makeStore = (command = '/elect :n=3', opts = {}) => {
  const store = buildStore(
    {
      p1: {id: 'p1', children: ['r1']},
      r1: {id: 'r1', parent: 'p1', title: 'My Cell', command, children: []},
    },
    opts,
  )
  jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
  jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})
  return store
}

const makeSelectWinner = returnValue => jest.fn().mockResolvedValue(returnValue)
const okForkStore = () => buildStore({r1: {id: 'r1', title: 'Result', children: []}})

beforeEach(() => {
  jest.clearAllMocks()
  MockOwnershipResolver.mockReturnValue(new Map([['r1', []]]))
  mockRunForks.mockResolvedValue([])
  MockForkJudge.mockImplementation(() => ({
    selectWinner: makeSelectWinner(null),
  }))
})

describe('resolveElectCell — input guard: :n= absent or invalid', () => {
  it('rejects trailing criterion text visibly and never starts forks', async () => {
    const store = makeStore('/elect :n=3 must cite sources')
    const node = store.getNode('r1')

    await resolveElectCell(node, store, new Map())

    expect(store.importer.createErrorNode).toHaveBeenCalledWith(
      expect.stringContaining('add a sibling /validate cell'),
      'r1',
    )
    expect(node.title).toBe('My Cell [✗ !]')
    expect(mockRunForks).not.toHaveBeenCalled()
  })

  it('keeps empty trailing whitespace on the normal elect path', async () => {
    const store = makeStore('/elect :n=3   ')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(mockRunForks).toHaveBeenCalledTimes(1)
  })

  it('writes "requires :n=N" error and skips runForks when :n= is absent', async () => {
    const store = makeStore('/elect')
    const node = store.getNode('r1')

    await resolveElectCell(node, store, new Map())

    expect(store.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('/elect requires :n=N'), 'r1')
    expect(mockRunForks).not.toHaveBeenCalled()
  })

  it.each([
    ['/elect :n=1', 1],
    ['/elect :n=0', 0],
  ])('writes "is a no-op" error and skips runForks for %s', async (command, rawN) => {
    const store = makeStore(command)
    const node = store.getNode('r1')

    await resolveElectCell(node, store, new Map())

    expect(store.importer.createErrorNode).toHaveBeenCalledWith(
      expect.stringContaining(`/elect :n=${rawN} is a no-op`),
      'r1',
    )
    expect(mockRunForks).not.toHaveBeenCalled()
  })

  it('marks title with [✗ !] suffix when :n= is absent — failure visible on cell and via error child node', async () => {
    const store = makeStore('/elect')
    const node = store.getNode('r1')

    await resolveElectCell(node, store, new Map())

    expect(node.title).toBe('My Cell [✗ !]')
  })

  it('replaces any pre-existing reliability suffix with [✗ !] when :n= is absent', async () => {
    const store = makeStore('/elect')
    const node = store.getNode('r1')
    node.title = 'My Cell [✓ 2/3]'

    await resolveElectCell(node, store, new Map())

    expect(node.title).toBe('My Cell [✗ !]')
  })

  it('saves node to output when :n= is absent', async () => {
    const store = makeStore('/elect')
    const node = store.getNode('r1')

    await resolveElectCell(node, store, new Map())

    expect(store.saveNodeToOutput).toHaveBeenCalledWith('r1')
  })
})

describe('resolveElectCell — input guard: fork cost exceeds :limit=', () => {
  it('writes error node containing cost and limit values', async () => {
    const store = makeStore('/elect :n=3 :limit=0')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('exceeds limit'), 'r1')
  })

  it('skips runForks when cost exceeds limit', async () => {
    const store = makeStore('/elect :n=3 :limit=0')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(mockRunForks).not.toHaveBeenCalled()
  })

  it('marks title with [✗ !] suffix when cost exceeds :limit= — failure visible on cell and via error child node', async () => {
    const store = makeStore('/elect :n=3 :limit=0')
    const node = store.getNode('r1')

    await resolveElectCell(node, store, new Map())

    expect(node.title).toBe('My Cell [✗ !]')
  })

  it('replaces any pre-existing reliability suffix with [✗ !] when cost exceeds :limit=', async () => {
    const store = makeStore('/elect :n=3 :limit=0')
    const node = store.getNode('r1')
    node.title = 'My Cell [✓ +1]'

    await resolveElectCell(node, store, new Map())

    expect(node.title).toBe('My Cell [✗ !]')
  })
})

describe('resolveElectCell — memoMap lifecycle', () => {
  it('sets memoMap to in-progress before runForks is invoked', async () => {
    const store = makeStore()
    const memoMap = new Map()
    let capturedState

    mockRunForks.mockImplementation(async () => {
      capturedState = memoMap.get('r1')
      return []
    })

    await resolveElectCell(store.getNode('r1'), store, memoMap)

    expect(capturedState).toBe('in-progress')
  })

  it('sets memoMap to null when all forks fail in strict mode', async () => {
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'runtime-failed', forkStore: null}])

    const store = makeStore()
    const memoMap = new Map()

    await resolveElectCell(store.getNode('r1'), store, memoMap)

    expect(memoMap.get('r1')).toBeNull()
  })

  it('sets memoMap to winner forkStore on success', async () => {
    const winner = okForkStore()
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winner}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
      }),
    }))

    const store = makeStore()
    const memoMap = new Map()

    await resolveElectCell(store.getNode('r1'), store, memoMap)

    expect(memoMap.get('r1')).toBe(winner)
  })

  it('sets memoMap to null when verdict carries winnerForkIndex: null', async () => {
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'criteria-failed', forkStore: okForkStore()}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: null,
        selectionLayer: 'none',
      }),
    }))

    const store = makeStore()
    const memoMap = new Map()

    await resolveElectCell(store.getNode('r1'), store, memoMap)

    expect(memoMap.get('r1')).toBeNull()
  })
})

describe('resolveElectCell — runForks invocation parameters', () => {
  it('passes n, electNode, store, memoMap, and null signal to runForks', async () => {
    const store = makeStore('/elect :n=5')
    const node = store.getNode('r1')
    const memoMap = new Map()
    let capturedArgs

    mockRunForks.mockImplementation(async args => {
      capturedArgs = args
      return []
    })

    await resolveElectCell(node, store, memoMap)

    expect(capturedArgs).toMatchObject({
      n: 5,
      electNode: node,
      store,
      memoMap,
      signal: null,
    })
  })

  it('passes AbortSignal through to runForks', async () => {
    const store = makeStore()
    const ac = new AbortController()
    let capturedSignal

    mockRunForks.mockImplementation(async ({signal}) => {
      capturedSignal = signal
      return []
    })

    await resolveElectCell(store.getNode('r1'), store, new Map(), ac.signal)

    expect(capturedSignal).toBe(ac.signal)
  })
})

describe('resolveElectCell — ForkJudge instantiation and selectWinner parameters', () => {
  it('constructs ForkJudge with store._userId and store._workflowId', async () => {
    const store = makeStore('/elect :n=2', {
      userId: 'alice',
      workflowId: 'wf99',
    })
    const node = store.getNode('r1')
    const winner = okForkStore()
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winner}])

    let constructorArgs
    MockForkJudge.mockImplementation((...args) => {
      constructorArgs = args
      return {
        selectWinner: makeSelectWinner({
          winnerForkIndex: 0,
          selectionLayer: 'primary',
        }),
      }
    })

    await resolveElectCell(node, store, new Map())

    expect(constructorArgs[0]).toBe('alice')
    expect(constructorArgs[1]).toBe('wf99')
  })

  it('passes electNode.parent as parentNodeId to selectWinner so judge reads the working cell content', async () => {
    const store = makeStore()
    const winner = okForkStore()
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winner}])

    let capturedParentNodeId
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn(async ({parentNodeId}) => {
        capturedParentNodeId = parentNodeId
        return {winnerForkIndex: 0, selectionLayer: 'primary'}
      }),
    }))

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(capturedParentNodeId).toBe('p1')
  })

  it('passes AbortSignal through to selectWinner', async () => {
    const store = makeStore()
    const winner = okForkStore()
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winner}])

    const ac = new AbortController()
    let capturedSignal

    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn(async ({signal}) => {
        capturedSignal = signal
        return {winnerForkIndex: 0, selectionLayer: 'primary'}
      }),
    }))

    await resolveElectCell(store.getNode('r1'), store, new Map(), ac.signal)

    expect(capturedSignal).toBe(ac.signal)
  })

  it('passes ownedValidates from OwnershipResolver to selectWinner', async () => {
    const validateNode = {
      id: 'v1',
      command: '/validate must include numbers',
      children: [],
    }
    MockOwnershipResolver.mockReturnValue(new Map([['r1', [validateNode]]]))

    const winner = okForkStore()
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winner}])

    let capturedValidateNodes
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn(async ({validateNodes}) => {
        capturedValidateNodes = validateNodes
        return {winnerForkIndex: 0, selectionLayer: 'primary'}
      }),
    }))

    const store = makeStore()
    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(capturedValidateNodes).toEqual([validateNode])
  })

  it('passes empty array to selectWinner when elect owns no validates', async () => {
    MockOwnershipResolver.mockReturnValue(new Map())

    const winner = okForkStore()
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winner}])

    let capturedValidateNodes
    MockForkJudge.mockImplementation(() => ({
      selectWinner: jest.fn(async ({validateNodes}) => {
        capturedValidateNodes = validateNodes
        return {winnerForkIndex: 0, selectionLayer: 'primary'}
      }),
    }))

    const store = makeStore()
    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(capturedValidateNodes).toEqual([])
  })
})

describe('resolveElectCell — all forks fail (strict mode)', () => {
  const allFailForks = n =>
    Array.from({length: n}, (_, i) => ({
      forkIndex: i,
      status: 'runtime-failed',
      forkStore: null,
    }))

  beforeEach(() => {
    mockRunForks.mockResolvedValue(allFailForks(3))
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner(null),
    }))
  })

  it('writes error node to the elect cell', async () => {
    const store = makeStore()

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('all 3 fork(s) failed'), 'r1')
  })

  it('saves node to output after writing error', async () => {
    const store = makeStore()

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store.saveNodeToOutput).toHaveBeenCalledWith('r1')
  })

  it('does not call StoreFork.applyCandidate', async () => {
    const store = makeStore()

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(StoreFork.applyCandidate).not.toHaveBeenCalled()
  })

  it('suffix shows [✗ 0/N] when all forks fail at runtime', async () => {
    const store = makeStore('/elect :n=3')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe('My Cell [✗ 0/3]')
  })

  it('verdict {winnerForkIndex: null} triggers the same error path as a null verdict', async () => {
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: null,
        selectionLayer: 'none',
      }),
    }))
    const store = makeStore()
    const memoMap = new Map()

    await resolveElectCell(store.getNode('r1'), store, memoMap)

    expect(store.importer.createErrorNode).toHaveBeenCalled()
    expect(memoMap.get('r1')).toBeNull()
    expect(StoreFork.applyCandidate).not.toHaveBeenCalled()
  })

  it('reliabilityMetadata is not written when no winner is selected (null verdict from judge)', async () => {
    const store = makeStore()

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.reliabilityMetadata).toBeUndefined()
  })
})

describe('resolveElectCell — all forks gate-filtered (allGateFiltered)', () => {
  const okForks = n =>
    Array.from({length: n}, (_, i) => ({
      forkIndex: i,
      status: 'ok',
      forkStore: okForkStore(),
    }))

  const gateFilteredVerdict = {
    winnerForkIndex: null,
    selectionLayer: 'none',
    mode: 'strict',
    noSignal: false,
    tiebreakUsed: false,
    allGateFiltered: true,
    failureCause: 'structural-gate',
    remediationHint: 'revise-prompt',
    perCriterionVerdict: [],
    judgeQualityWarnings: [{condition: 'allGateFiltered', severity: 'high'}],
  }

  beforeEach(() => {
    mockRunForks.mockResolvedValue(okForks(3))
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner(gateFilteredVerdict),
    }))
  })

  it.each([2, 3, 5])('suffix shows [✗ 0/%i] when all fork content fails the structural gate', async n => {
    mockRunForks.mockResolvedValue(okForks(n))
    const store = makeStore(`/elect :n=${n}`)

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe(`My Cell [✗ 0/${n}]`)
  })

  it('reliabilityMetadata is written and carries the allGateFiltered quality warning', async () => {
    const store = makeStore('/elect :n=3')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.reliabilityMetadata).toBeDefined()
    expect(store._nodes.r1.reliabilityMetadata.judgeQualityWarnings).toEqual([
      {condition: 'allGateFiltered', severity: 'high'},
    ])
    expect(store._nodes.r1.reliabilityMetadata).toEqual(
      expect.objectContaining({
        failureCause: 'structural-gate',
        remediationHint: 'revise-prompt',
        allGateFiltered: true,
      }),
    )
  })

  it('error node message names empty/refusal output — does not suggest :fallback (inapplicable here)', async () => {
    const store = makeStore('/elect :n=3')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    const [msg] = store.importer.createErrorNode.mock.calls[0]
    expect(msg).toContain('empty or refusal output')
    expect(msg).not.toContain(':fallback')
  })

  it.each([2, 3, 5])(
    'reliabilityMetadata.eligible counts ok-status forks regardless of gate filtering (n=%i)',
    async n => {
      mockRunForks.mockResolvedValue(okForks(n))
      const store = makeStore(`/elect :n=${n}`)

      await resolveElectCell(store.getNode('r1'), store, new Map())

      expect(store._nodes.r1.reliabilityMetadata.eligible).toBe(n)
      expect(store._nodes.r1.reliabilityMetadata.total).toBe(n)
    },
  )
})

describe('resolveElectCell — winner selected', () => {
  let winner

  beforeEach(() => {
    winner = okForkStore()
    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winner},
      {forkIndex: 1, status: 'ok', forkStore: okForkStore()},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
      }),
    }))
  })

  it('calls StoreFork.applyCandidate with winner forkStore and elect cell id', async () => {
    const store = makeStore()

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(StoreFork.applyCandidate).toHaveBeenCalledWith(store, winner, 'r1')
  })

  it('exposes the selected parent output as elect-owned prompt output', async () => {
    const winnerStore = buildStore({
      p1: {
        id: 'p1',
        children: ['r1', 'winner-output'],
        prompts: ['winner-output'],
      },
      r1: {id: 'r1', parent: 'p1', command: '/elect :n=3', children: []},
      'winner-output': {
        id: 'winner-output',
        parent: 'p1',
        title: 'selected winner',
        children: [],
      },
    })
    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winnerStore},
      {forkIndex: 1, status: 'ok', forkStore: okForkStore()},
    ])
    const store = makeStore()

    await resolveElectCell(store.getNode('r1'), store, new Map())

    const copiedPromptIds = store.getNode('r1').prompts
    expect(copiedPromptIds).toHaveLength(1)
    expect(copiedPromptIds).not.toContain('winner-output')
    expect(store.getNode(copiedPromptIds[0])).toEqual(
      expect.objectContaining({
        parent: 'r1',
        title: 'selected winner',
      }),
    )
  })

  it('saves node to output after applying winner', async () => {
    const store = makeStore()

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store.saveNodeToOutput).toHaveBeenCalledWith('r1')
  })

  it('strips pre-existing reliability suffix from title before appending new one', async () => {
    const store = makeStore()
    store._nodes.r1.title = 'My Cell [✓ 1/2]'

    await resolveElectCell(store.getNode('r1'), store, new Map())

    const title = store._nodes.r1.title
    expect(title).not.toMatch(/\[✓ 1\/2\]/)
    expect(title).toMatch(/My Cell/)
  })

  it('does not write an error node', async () => {
    const store = makeStore()

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store.importer.createErrorNode).not.toHaveBeenCalled()
  })

  it('writes reliabilityMetadata to the winner node with full verdict shape', async () => {
    const perCriterionVerdict = [
      {
        criterionId: 'v1',
        criterion: 'must include numbers',
        forkRankings: [],
      },
    ]
    const judgeInput = {
      candidateCount: 2,
      perForkBudgetChars: 1000,
      degradedInput: true,
      resolvedJudgeFamilies: ['OpenAI'],
    }
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
        mode: 'strict',
        perCriterionVerdict,
        noSignal: false,
        judgeInput,
      }),
    }))

    const store = makeStore('/elect :n=2')
    await resolveElectCell(store.getNode('r1'), store, new Map())

    const meta = store._nodes.r1.reliabilityMetadata
    expect(meta).toMatchObject({
      winnerForkIndex: 0,
      perCriterionVerdict,
      mode: 'strict',
      selectionLayer: 'primary',
      noSignal: false,
      eligible: 2,
      total: 2,
      judgeInput,
    })
  })

  it('propagates side-effect suppression evidence from fork result into elect metadata', async () => {
    const winner = okForkStore()
    mockRunForks.mockResolvedValue([
      {
        forkIndex: 0,
        status: 'ok',
        forkStore: winner,
        leafOutputs: [],
        suppressed: true,
        cause: 'side-effecting-alias',
        requestedN: 3,
      },
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
        mode: 'strict',
      }),
    }))

    const store = makeStore('/elect :n=3')
    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store.getNode('r1').reliabilityMetadata).toMatchObject({
      suppressed: true,
      cause: 'side-effecting-alias',
      requestedN: 3,
      total: 1,
      eligible: 1,
    })
  })

  it('suppressed /elect title suffix is [✓ 1/1] — never [✓ 1/N] which implies N−1 forks failed', async () => {
    const winner = okForkStore()
    mockRunForks.mockResolvedValue([
      {
        forkIndex: 0,
        status: 'ok',
        forkStore: winner,
        leafOutputs: [],
        suppressed: true,
        cause: 'side-effecting-alias',
        requestedN: 3,
      },
    ])
    const store = makeStore('/elect :n=3')
    store._nodes.r1.title = 'My Task'
    await resolveElectCell(store.getNode('r1'), store, new Map())
    expect(store.getNode('r1').title).toMatch(/\[✓ 1\/1\]/)
    expect(store.getNode('r1').title).not.toMatch(/\[✓ 1\/3\]/)
  })

  it('suppressed /elect calls emitter.electComplete with winnerForkIndex=0 and total=1', async () => {
    const makeEmitter = () => ({
      forksStarted: jest.fn(),
      forkSettled: jest.fn(),
      electComplete: jest.fn(),
    })
    const winner = okForkStore()
    mockRunForks.mockResolvedValue([
      {
        forkIndex: 0,
        status: 'ok',
        forkStore: winner,
        leafOutputs: [],
        suppressed: true,
        cause: 'side-effecting-alias',
        requestedN: 3,
      },
    ])
    const store = makeStore('/elect :n=3')
    const emitter = makeEmitter()
    await resolveElectCell(store.getNode('r1'), store, new Map(), null, emitter)
    expect(emitter.electComplete).toHaveBeenCalledWith('r1', 0, 1)
  })

  it('suppressed /elect sets memoMap to forkStore so downstream cells resolve against fork output', async () => {
    const winner = okForkStore()
    mockRunForks.mockResolvedValue([
      {
        forkIndex: 0,
        status: 'ok',
        forkStore: winner,
        leafOutputs: [],
        suppressed: true,
        cause: 'side-effecting-alias',
        requestedN: 3,
      },
    ])
    const store = makeStore('/elect :n=3')
    const memoMap = new Map()
    await resolveElectCell(store.getNode('r1'), store, memoMap)
    expect(memoMap.get('r1')).toBe(winner)
  })

  it.each([['side-effecting-alias', 'side-effecting-alias', 3]])(
    'suppression cause %s is forwarded to elect node metadata',
    async (_, cause, requestedN) => {
      const winner = okForkStore()
      mockRunForks.mockResolvedValue([
        {
          forkIndex: 0,
          status: 'ok',
          forkStore: winner,
          leafOutputs: [],
          suppressed: true,
          cause,
          requestedN,
        },
      ])
      const store = makeStore('/elect :n=3')
      await resolveElectCell(store.getNode('r1'), store, new Map())
      expect(store.getNode('r1').reliabilityMetadata.cause).toBe(cause)
      expect(store.getNode('r1').reliabilityMetadata.suppressed).toBe(true)
    },
  )

  it('suppressed /elect with forkStore:null — title, metadata, emitter, and memoMap still set; store operations skipped gracefully', async () => {
    // forkStore can be null when the fork never materialised (e.g. SubtreeForkRunner
    // collapsed to effectiveN=1 and the fork store was not allocated).
    mockRunForks.mockResolvedValue([
      {
        forkIndex: 0,
        status: 'ok',
        forkStore: null,
        leafOutputs: [],
        suppressed: true,
        cause: 'side-effecting-alias',
        requestedN: 2,
      },
    ])
    const store = makeStore('/elect :n=2')
    store._nodes.r1.title = 'Bare Task'
    const emitter = {
      forksStarted: jest.fn(),
      forkSettled: jest.fn(),
      electComplete: jest.fn(),
    }
    const memoMap = new Map()

    await resolveElectCell(store.getNode('r1'), store, memoMap, null, emitter)

    expect(store.getNode('r1').title).toMatch(/\[✓ 1\/1\]/)
    expect(store.getNode('r1').reliabilityMetadata).toMatchObject({
      mode: 'suppressed',
      suppressed: true,
      total: 1,
      eligible: 1,
    })
    expect(emitter.electComplete).toHaveBeenCalledWith('r1', 0, 1)
    expect(memoMap.get('r1')).toBeNull()
  })

  it('suppressed /elect whose single run fails reports collapsed count and no-winner status', async () => {
    const makeEmitter = () => ({
      forksStarted: jest.fn(),
      forkSettled: jest.fn(),
      electComplete: jest.fn(),
    })
    mockRunForks.mockResolvedValue([
      {
        forkIndex: 0,
        status: 'criteria-failed',
        forkStore: null,
        leafOutputs: [],
        suppressed: true,
        cause: 'side-effecting-alias',
        requestedN: 3,
      },
    ])
    const store = makeStore('/elect :n=3')
    const emitter = makeEmitter()
    await resolveElectCell(store.getNode('r1'), store, new Map(), null, emitter)

    expect(store._nodes.r1.title).toMatch(/\[✗ 0\/1\]/)
    expect(store._nodes.r1.title).not.toMatch(/3/)
    expect(emitter.electComplete).toHaveBeenCalledWith('r1', null, 1)
    expect(store._nodes.r1.reliabilityMetadata).toMatchObject({
      mode: 'suppressed',
      suppressed: true,
      cause: 'side-effecting-alias',
      eligible: 0,
      total: 1,
    })
    expect(store._nodes.r1.reliabilityMetadata.failureCause).toBeDefined()
    expect(store._nodes.r1.reliabilityMetadata.remediationHint).toBeDefined()
  })

  it('forksStarted uses effectiveN from computeEffectiveN, not the raw n', async () => {
    const makeEmitter = () => ({
      forksStarted: jest.fn(),
      forkSettled: jest.fn(),
      electComplete: jest.fn(),
    })
    mockComputeEffectiveN.mockReturnValueOnce(1)
    mockRunForks.mockResolvedValue([
      {
        forkIndex: 0,
        status: 'ok',
        forkStore: okForkStore(),
        leafOutputs: [],
        suppressed: true,
        cause: 'side-effecting-alias',
        requestedN: 3,
      },
    ])
    const store = makeStore('/elect :n=3')
    const emitter = makeEmitter()
    await resolveElectCell(store.getNode('r1'), store, new Map(), null, emitter)

    expect(emitter.forksStarted).toHaveBeenCalledWith('r1', 1)
    expect(emitter.forksStarted).not.toHaveBeenCalledWith('r1', 3)
  })

  it('genuine 1-of-3 partial success renders [✓ 1/3] — suppressed-path changes do not affect normal winner path', async () => {
    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winner},
      {
        forkIndex: 1,
        status: 'criteria-failed',
        forkStore: okForkStore(),
        leafOutputs: [],
      },
      {
        forkIndex: 2,
        status: 'runtime-failed',
        forkStore: null,
        reason: 'timeout',
        leafOutputs: [],
      },
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
        mode: 'strict',
      }),
    }))
    const store = makeStore('/elect :n=3')
    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toMatch(/\[✓ 1\/3\]/)
  })

  it.each([
    ['perCriterionVerdict', 'perCriterionVerdict', []],
    ['noSignal', 'noSignal', false],
    ['tiebreakUsed', 'tiebreakUsed', false],
    ['judgeInput', 'judgeInput', undefined],
    ['judgeQualityWarnings', 'judgeQualityWarnings', []],
  ])('%s absent from verdict defaults to safe value in metadata', async (_, field, expected) => {
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
        mode: 'strict',
      }),
    }))

    const store = makeStore('/elect :n=2')
    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.reliabilityMetadata[field]).toStrictEqual(expected)
  })

  it('tiebreakUsed:true from verdict is stored in metadata', async () => {
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
        mode: 'strict',
        tiebreakUsed: true,
      }),
    }))

    const store = makeStore('/elect :n=2')
    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.reliabilityMetadata.tiebreakUsed).toBe(true)
  })

  it('eligible counts only ok-status forks, not criteria-failed or runtime-failed', async () => {
    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winner},
      {forkIndex: 1, status: 'ok', forkStore: okForkStore()},
      {forkIndex: 2, status: 'criteria-failed', forkStore: okForkStore()},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
        mode: 'strict',
      }),
    }))

    const store = makeStore('/elect :n=3')
    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.reliabilityMetadata.eligible).toBe(2)
    expect(store._nodes.r1.reliabilityMetadata.total).toBe(3)
  })
})

describe('resolveElectCell — fallback selection layer', () => {
  let fallbackStore

  beforeEach(() => {
    fallbackStore = okForkStore()
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'criteria-failed', forkStore: fallbackStore}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'fallback',
        mode: 'fallback',
      }),
    }))
  })

  it('applies winner from fallback layer (criteria-failed fork)', async () => {
    const store = makeStore('/elect :n=2 :fallback')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(StoreFork.applyCandidate).toHaveBeenCalledWith(store, fallbackStore, 'r1')
  })

  it('reliabilityMetadata records fallback selectionLayer and mode', async () => {
    const store = makeStore('/elect :n=2 :fallback')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.reliabilityMetadata).toMatchObject({
      selectionLayer: 'fallback',
      mode: 'fallback',
      winnerForkIndex: 0,
      eligible: 0,
      total: 2,
    })
  })
})

describe('resolveElectCell — validate sibling titles transferred from winner fork', () => {
  it('transfers winner fork validate title to main store', async () => {
    const validateNode = {
      id: 'v1',
      parent: 'p1',
      command: '/validate criterion',
      title: '/validate criterion',
      children: [],
    }
    const store = new Store({
      userId: 'user1',
      nodes: {
        p1: {id: 'p1', children: ['r1', 'v1']},
        r1: {
          id: 'r1',
          parent: 'p1',
          title: 'My Cell',
          command: '/elect :n=2',
          children: [],
        },
        v1: validateNode,
      },
    })
    jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
    jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    const winnerForkStore = new Store({
      userId: 'user1',
      nodes: {
        p1: {id: 'p1', children: ['r1', 'v1']},
        r1: {id: 'r1', parent: 'p1', title: 'My Cell', children: []},
        v1: {
          id: 'v1',
          parent: 'p1',
          command: '/validate criterion',
          title: '/validate criterion [✓]',
          children: [],
        },
      },
    })

    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winnerForkStore}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
        mode: 'strict',
        noSignal: false,
      }),
    }))
    MockOwnershipResolver.mockReturnValue(new Map([['r1', [store.getNode('v1')]]]))

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.v1.title).toBe('/validate criterion [✓]')
    expect(store.saveNodeToOutput).toHaveBeenCalledWith('v1')
  })

  it('does not overwrite validate title when node is absent from winner fork', async () => {
    const store = new Store({
      userId: 'user1',
      nodes: {
        p1: {id: 'p1', children: ['r1', 'v1']},
        r1: {
          id: 'r1',
          parent: 'p1',
          title: 'My Cell',
          command: '/elect :n=2',
          children: [],
        },
        v1: {
          id: 'v1',
          parent: 'p1',
          command: '/validate criterion',
          title: 'original title',
          children: [],
        },
      },
    })
    jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
    jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    const winnerForkStore = new Store({
      userId: 'user1',
      nodes: {
        p1: {id: 'p1', children: ['r1']},
        r1: {id: 'r1', parent: 'p1', title: 'My Cell', children: []},
      },
    })

    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winnerForkStore}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
        mode: 'strict',
        noSignal: false,
      }),
    }))
    MockOwnershipResolver.mockReturnValue(new Map([['r1', [store.getNode('v1')]]]))

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.v1.title).toBe('original title')
    expect(store.saveNodeToOutput).not.toHaveBeenCalledWith('v1')
  })

  it('does not transfer validate titles when there are no owned validates', async () => {
    const winner = okForkStore()
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winner}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
        mode: 'strict',
        noSignal: false,
      }),
    }))
    MockOwnershipResolver.mockReturnValue(new Map([['r1', []]]))

    const store = makeStore('/elect :n=2')
    await resolveElectCell(store.getNode('r1'), store, new Map())

    const nonElectCallArgs = store.saveNodeToOutput.mock.calls.filter(([id]) => id !== 'r1')
    expect(nonElectCallArgs).toHaveLength(0)
  })
})

describe('resolveElectCell — noSignal routing: strict mode emits warning, fallback mode suppresses warning', () => {
  it('primary layer — all forks ok but jurors excluded → [⚠ ∅] suffix, metadata noSignal:true', async () => {
    const winner = okForkStore()
    const forks = [
      {forkIndex: 0, status: 'ok', forkStore: winner},
      {forkIndex: 1, status: 'ok', forkStore: okForkStore()},
    ]
    const verdict = {
      winnerForkIndex: 0,
      selectionLayer: 'primary',
      mode: 'strict',
      noSignal: true,
    }
    mockRunForks.mockResolvedValue(forks)
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner(verdict),
    }))
    const store = makeStore('/elect :n=2')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe('My Cell [⚠ ∅]')
    expect(store._nodes.r1.reliabilityMetadata).toMatchObject({
      noSignal: true,
      selectionLayer: 'primary',
      mode: 'strict',
      winnerForkIndex: 0,
      eligible: 2,
      total: 2,
    })
  })

  it('primary layer — noSignal:false (jurors produced rankings) → normal eligible-fraction suffix, metadata noSignal:false', async () => {
    const winner = okForkStore()
    const forks = [
      {forkIndex: 0, status: 'ok', forkStore: winner},
      {forkIndex: 1, status: 'ok', forkStore: okForkStore()},
    ]
    const verdict = {
      winnerForkIndex: 0,
      selectionLayer: 'primary',
      mode: 'strict',
      noSignal: false,
    }
    mockRunForks.mockResolvedValue(forks)
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner(verdict),
    }))
    const store = makeStore('/elect :n=2')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe('My Cell [✓ 2/2]')
    expect(store._nodes.r1.reliabilityMetadata).toMatchObject({
      noSignal: false,
      eligible: 2,
      total: 2,
    })
  })

  it('primary layer — degradedInput:true (judge serialised truncated content) → ⚠ trailer on eligible-fraction suffix, metadata records degradedInput', async () => {
    const winner = okForkStore()
    const forks = [
      {forkIndex: 0, status: 'ok', forkStore: winner},
      {forkIndex: 1, status: 'ok', forkStore: okForkStore()},
    ]
    mockRunForks.mockResolvedValue(forks)
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
        mode: 'strict',
        noSignal: false,
        judgeInput: {
          candidateCount: 2,
          perForkBudgetChars: 100,
          degradedInput: true,
          resolvedJudgeFamilies: ['OpenAI'],
        },
      }),
    }))
    const store = makeStore('/elect :n=2')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe('My Cell [✓ 2/2 ⚠]')
    expect(store._nodes.r1.reliabilityMetadata).toMatchObject({
      eligible: 2,
      total: 2,
      judgeInput: {degradedInput: true},
    })
  })

  it('fallback layer — criteria-failed forks, jurors excluded → fallback suffix with deterministic tiebreak winner', async () => {
    const fallbackForkStore = okForkStore()
    const forks = [{forkIndex: 0, status: 'criteria-failed', forkStore: fallbackForkStore}]
    const verdict = {
      winnerForkIndex: 0,
      selectionLayer: 'fallback',
      mode: 'fallback',
      noSignal: true,
    }
    mockRunForks.mockResolvedValue(forks)
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner(verdict),
    }))
    const store = makeStore('/elect :n=2 :fallback')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe('My Cell [⚠ 0/2]')
    expect(store._nodes.r1.reliabilityMetadata).toMatchObject({
      noSignal: true,
      selectionLayer: 'fallback',
      mode: 'fallback',
      winnerForkIndex: 0,
      eligible: 0,
      total: 2,
    })
  })

  it('primary layer + mixed eligibility — noSignal fires on primary selection regardless of how many forks passed', async () => {
    const winner = okForkStore()
    const forks = [
      {forkIndex: 0, status: 'ok', forkStore: winner},
      {forkIndex: 1, status: 'criteria-failed', forkStore: okForkStore()},
    ]
    const verdict = {
      winnerForkIndex: 0,
      selectionLayer: 'primary',
      mode: 'strict',
      noSignal: true,
    }
    mockRunForks.mockResolvedValue(forks)
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner(verdict),
    }))
    const store = makeStore('/elect :n=2')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe('My Cell [⚠ ∅]')
    expect(store._nodes.r1.reliabilityMetadata).toMatchObject({
      noSignal: true,
      selectionLayer: 'primary',
      mode: 'strict',
      winnerForkIndex: 0,
      eligible: 1,
      total: 2,
    })
  })

  it('primary layer + :fallback flag + noSignal:true — noSignal suppressed → eligible-fraction suffix, metadata noSignal:true', async () => {
    const winner = okForkStore()
    const forks = [
      {forkIndex: 0, status: 'ok', forkStore: winner},
      {forkIndex: 1, status: 'ok', forkStore: okForkStore()},
    ]
    const verdict = {
      winnerForkIndex: 0,
      selectionLayer: 'primary',
      mode: 'strict',
      noSignal: true,
    }
    mockRunForks.mockResolvedValue(forks)
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner(verdict),
    }))
    const store = makeStore('/elect :n=2 :fallback')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe('My Cell [✓ 2/2]')
    expect(store._nodes.r1.reliabilityMetadata).toMatchObject({
      noSignal: true,
      selectionLayer: 'primary',
      mode: 'strict',
      winnerForkIndex: 0,
      eligible: 2,
      total: 2,
    })
  })
})

describe('resolveElectCell — ForkProgressEmitter integration', () => {
  const makeEmitter = () => ({
    forksStarted: jest.fn(),
    forkSettled: jest.fn(),
    electComplete: jest.fn(),
  })

  const twoOkForks = () => [
    {forkStore: okForkStore(), forkIndex: 0, status: 'ok'},
    {forkStore: okForkStore(), forkIndex: 1, status: 'ok'},
  ]

  beforeEach(() => {
    MockOwnershipResolver.mockReturnValue(new Map([['r1', []]]))
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        perCriterionVerdict: [],
        mode: 'strict',
        selectionLayer: 'primary',
        noSignal: false,
        tiebreakUsed: false,
        judgeInput: {},
        judgeQualityWarnings: [],
      }),
    }))
  })

  it('calls emitter.forksStarted with electNodeId and n before forks run', async () => {
    mockRunForks.mockResolvedValue(twoOkForks())
    const store = makeStore('/elect :n=2')
    const emitter = makeEmitter()

    await resolveElectCell(store.getNode('r1'), store, new Map(), null, emitter)

    expect(emitter.forksStarted).toHaveBeenCalledWith('r1', 2)
  })

  it('calls emitter.electComplete with winner index on success', async () => {
    mockRunForks.mockResolvedValue(twoOkForks())
    const store = makeStore('/elect :n=2')
    const emitter = makeEmitter()

    await resolveElectCell(store.getNode('r1'), store, new Map(), null, emitter)

    expect(emitter.electComplete).toHaveBeenCalledWith('r1', 0, 2, expect.any(Object))
  })

  it('calls emitter.electComplete with null winner when all forks fail in strict mode', async () => {
    mockRunForks.mockResolvedValue([
      {
        forkStore: null,
        forkIndex: 0,
        status: 'runtime-failed',
        reason: 'err',
      },
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: null,
        perCriterionVerdict: [],
        mode: 'strict',
        selectionLayer: 'none',
        noSignal: false,
        tiebreakUsed: false,
      }),
    }))
    mockRunForks.mockResolvedValue([
      {
        forkStore: null,
        forkIndex: 0,
        status: 'runtime-failed',
        reason: 'err1',
      },
      {
        forkStore: null,
        forkIndex: 1,
        status: 'runtime-failed',
        reason: 'err2',
      },
    ])
    const store2 = makeStore('/elect :n=2')
    const emitter = makeEmitter()

    await resolveElectCell(store2.getNode('r1'), store2, new Map(), null, emitter)

    expect(emitter.electComplete).toHaveBeenCalledWith('r1', null, 2)
  })

  it('does not call emitter on guard-rejected cells', async () => {
    const store = makeStore('/elect')
    const emitter = makeEmitter()

    await resolveElectCell(store.getNode('r1'), store, new Map(), null, emitter)

    expect(emitter.forksStarted).not.toHaveBeenCalled()
    expect(emitter.electComplete).not.toHaveBeenCalled()
  })

  it('wires onForkSettled to emitter.forkSettled — called once per settled fork', async () => {
    const forks = twoOkForks()
    mockRunForks.mockImplementation(async ({onForkSettled}) => {
      onForkSettled?.(forks[0])
      onForkSettled?.(forks[1])
      return forks
    })
    const store = makeStore('/elect :n=2')
    const emitter = makeEmitter()

    await resolveElectCell(store.getNode('r1'), store, new Map(), null, emitter)

    expect(emitter.forkSettled).toHaveBeenCalledTimes(2)
    expect(emitter.forkSettled).toHaveBeenCalledWith('r1', forks[0])
    expect(emitter.forkSettled).toHaveBeenCalledWith('r1', forks[1])
  })

  it('does not call emitter when fork cost exceeds :limit= guard', async () => {
    const store = makeStore('/elect :n=3 :limit=0')
    const emitter = makeEmitter()

    await resolveElectCell(store.getNode('r1'), store, new Map(), null, emitter)

    expect(emitter.forksStarted).not.toHaveBeenCalled()
    expect(emitter.electComplete).not.toHaveBeenCalled()
  })
})

describe('resolveElectCell — discardedForks in reliabilityMetadata', () => {
  beforeEach(() => {
    MockOwnershipResolver.mockReturnValue(new Map([['r1', []]]))
  })

  it('includes non-winner forks in discardedForks', async () => {
    const winnerStore = okForkStore()
    const loserStore = buildStore({
      r1: {id: 'r1', title: 'Loser', children: []},
    })
    mockRunForks.mockResolvedValue([
      {forkStore: winnerStore, forkIndex: 0, status: 'ok'},
      {forkStore: loserStore, forkIndex: 1, status: 'ok'},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        perCriterionVerdict: [],
        mode: 'strict',
        selectionLayer: 'primary',
        noSignal: false,
        tiebreakUsed: false,
        judgeInput: {},
        judgeQualityWarnings: [],
      }),
    }))
    const store = makeStore('/elect :n=2')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    const node = store.getNode('r1')
    expect(node.reliabilityMetadata.discardedForks).toEqual([{forkIndex: 1, status: 'ok'}])
  })

  it('records status and failedAt for criteria-failed discarded forks', async () => {
    const winnerStore = okForkStore()
    const failedStore = buildStore({
      r1: {id: 'r1', title: 'Failed', children: []},
    })
    mockRunForks.mockResolvedValue([
      {forkStore: winnerStore, forkIndex: 0, status: 'ok'},
      {
        forkStore: failedStore,
        forkIndex: 1,
        status: 'criteria-failed',
        failedAt: 'must include numbers',
        attempts: 3,
      },
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        perCriterionVerdict: [],
        mode: 'strict',
        selectionLayer: 'primary',
        noSignal: false,
        tiebreakUsed: false,
        judgeInput: {},
        judgeQualityWarnings: [],
      }),
    }))
    const store = makeStore('/elect :n=2')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    const discarded = store.getNode('r1').reliabilityMetadata.discardedForks
    expect(discarded[0]).toMatchObject({
      forkIndex: 1,
      status: 'criteria-failed',
      failedAt: 'must include numbers',
      attempts: 3,
    })
  })

  it('discardedForks is empty when only one fork ran and it won', async () => {
    const winnerStore = okForkStore()
    mockRunForks.mockResolvedValue([{forkStore: winnerStore, forkIndex: 0, status: 'ok'}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        perCriterionVerdict: [],
        mode: 'strict',
        selectionLayer: 'primary',
        noSignal: false,
        tiebreakUsed: false,
        judgeInput: {},
        judgeQualityWarnings: [],
      }),
    }))
    const store = makeStore('/elect :n=2')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store.getNode('r1').reliabilityMetadata.discardedForks).toEqual([])
  })

  it('runtime-failed discarded fork carries reason and does not include failedAt', async () => {
    const winnerStore = okForkStore()
    mockRunForks.mockResolvedValue([
      {forkStore: winnerStore, forkIndex: 0, status: 'ok'},
      {
        forkStore: null,
        forkIndex: 1,
        status: 'runtime-failed',
        reason: 'LLM provider error',
      },
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        perCriterionVerdict: [],
        mode: 'strict',
        selectionLayer: 'primary',
        noSignal: false,
        tiebreakUsed: false,
        judgeInput: {},
        judgeQualityWarnings: [],
      }),
    }))
    const store = makeStore('/elect :n=2')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    const discarded = store.getNode('r1').reliabilityMetadata.discardedForks
    expect(discarded[0]).toMatchObject({
      forkIndex: 1,
      status: 'runtime-failed',
      reason: 'LLM provider error',
    })
    expect(discarded[0]).not.toHaveProperty('failedAt')
  })

  it('winner forkIndex is never present in discardedForks', async () => {
    const winnerStore = okForkStore()
    const loser1 = buildStore({r1: {id: 'r1', title: 'L1', children: []}})
    const loser2 = buildStore({r1: {id: 'r1', title: 'L2', children: []}})
    mockRunForks.mockResolvedValue([
      {forkStore: winnerStore, forkIndex: 1, status: 'ok'},
      {forkStore: loser1, forkIndex: 0, status: 'ok'},
      {forkStore: loser2, forkIndex: 2, status: 'ok'},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 1,
        perCriterionVerdict: [],
        mode: 'strict',
        selectionLayer: 'primary',
        noSignal: false,
        tiebreakUsed: false,
        judgeInput: {},
        judgeQualityWarnings: [],
      }),
    }))
    const store = makeStore('/elect :n=3')

    await resolveElectCell(store.getNode('r1'), store, new Map())

    const discarded = store.getNode('r1').reliabilityMetadata.discardedForks
    expect(discarded.map(f => f.forkIndex)).not.toContain(1)
    expect(discarded).toHaveLength(2)
  })

  describe('resolveElectCell — null-guard: winner fork has no store', () => {
    it('creates error node and returns early when judge returns index pointing to runtime-failed fork', async () => {
      const store = makeStore('/elect :n=2')
      const memoMap = new Map()
      mockRunForks.mockResolvedValue([
        {
          forkIndex: 0,
          status: 'runtime-failed',
          forkStore: null,
          reason: 'LLM error',
          leafOutputs: [],
        },
        {
          forkIndex: 1,
          status: 'runtime-failed',
          forkStore: null,
          reason: 'LLM error',
          leafOutputs: [],
        },
      ])
      MockForkJudge.mockImplementation(() => ({
        selectWinner: makeSelectWinner({
          winnerForkIndex: 0,
          perCriterionVerdict: [],
          mode: 'strict',
          selectionLayer: 'primary',
          noSignal: false,
          tiebreakUsed: false,
          judgeInput: {
            candidateCount: 0,
            perForkBudgetChars: 0,
            degradedInput: false,
            resolvedJudgeFamilies: [],
          },
          judgeQualityWarnings: [],
        }),
      }))

      await resolveElectCell(store.getNode('r1'), store, memoMap)

      expect(require('./StoreFork').applyCandidate).not.toHaveBeenCalled()
      expect(store.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('internal error'), 'r1')
      expect(memoMap.get('r1')).toBeNull()
    })

    it('proceeds normally when winner fork has a valid forkStore', async () => {
      const store = makeStore('/elect :n=2')
      const memoMap = new Map()
      const winnerStore = okForkStore()
      mockRunForks.mockResolvedValue([
        {forkStore: winnerStore, forkIndex: 0, status: 'ok', leafOutputs: []},
        {
          forkStore: okForkStore(),
          forkIndex: 1,
          status: 'ok',
          leafOutputs: [],
        },
      ])
      MockForkJudge.mockImplementation(() => ({
        selectWinner: makeSelectWinner({
          winnerForkIndex: 0,
          perCriterionVerdict: [],
          mode: 'strict',
          selectionLayer: 'primary',
          noSignal: false,
          tiebreakUsed: false,
          judgeInput: {
            candidateCount: 2,
            perForkBudgetChars: 1000,
            degradedInput: false,
            resolvedJudgeFamilies: ['OpenAI'],
          },
          judgeQualityWarnings: [],
        }),
      }))

      await resolveElectCell(store.getNode('r1'), store, memoMap)

      expect(require('./StoreFork').applyCandidate).toHaveBeenCalledWith(store, winnerStore, 'r1')
      expect(memoMap.get('r1')).toBe(winnerStore)
    })
  })
})

describe('resolveElectCell — verdict field propagation to reliabilityMetadata', () => {
  const makeRunWithVerdict = async verdictOverrides => {
    const store = makeStore('/elect :n=2')
    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: okForkStore()},
      {forkIndex: 1, status: 'ok', forkStore: okForkStore()},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        perCriterionVerdict: [],
        mode: 'strict',
        selectionLayer: 'primary',
        noSignal: false,
        tiebreakUsed: false,
        judgeInput: {},
        judgeQualityWarnings: [],
        ...verdictOverrides,
      }),
    }))
    await resolveElectCell(store.getNode('r1'), store, new Map())
    return store.getNode('r1').reliabilityMetadata
  }

  it.each([0, 1])('winnerForkIndex %i from verdict is stored in reliabilityMetadata unchanged', async idx => {
    const meta = await makeRunWithVerdict({winnerForkIndex: idx})
    expect(meta.winnerForkIndex).toBe(idx)
  })

  it.each([true, false])('tiebreakUsed: %s is propagated to reliabilityMetadata', async tiebreakUsed => {
    const meta = await makeRunWithVerdict({
      winnerForkIndex: 0,
      tiebreakUsed,
    })
    expect(meta.tiebreakUsed).toBe(tiebreakUsed)
  })

  it.each([true, false])('noSignal: %s is propagated to reliabilityMetadata', async noSignal => {
    const meta = await makeRunWithVerdict({winnerForkIndex: 0, noSignal})
    expect(meta.noSignal).toBe(noSignal)
  })

  it('two sequential calls with the same verdict produce the same winnerForkIndex in reliabilityMetadata', async () => {
    const meta1 = await makeRunWithVerdict({
      winnerForkIndex: 0,
      tiebreakUsed: true,
    })
    const meta2 = await makeRunWithVerdict({
      winnerForkIndex: 0,
      tiebreakUsed: true,
    })
    expect(meta1.winnerForkIndex).toBe(0)
    expect(meta2.winnerForkIndex).toBe(0)
  })
})
