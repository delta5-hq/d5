import {resolveRefineCell} from './resolveRefineCell'
import StoreFork from './StoreFork'
import {ForkJudge} from './ForkJudge'
import OwnershipResolver from './OwnershipResolver'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('./SubtreeForkRunner', () => ({runForks: jest.fn()}))
jest.mock('./ForkJudge', () => ({ForkJudge: jest.fn()}))
jest.mock('./OwnershipResolver', () => jest.fn())
jest.mock('./StoreFork', () => ({applyCandidate: jest.fn()}))

const {runForks: mockRunForks} = require('./SubtreeForkRunner')
const MockForkJudge = ForkJudge
const MockOwnershipResolver = OwnershipResolver

const buildStore = (nodeMap, opts = {}) =>
  new Store({userId: opts.userId || 'user1', workflowId: opts.workflowId, nodes: nodeMap})

const makeStore = (command = '/refine :n=3', opts = {}) => {
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
  MockForkJudge.mockImplementation(() => ({selectWinner: makeSelectWinner(null)}))
})

describe('resolveRefineCell — input guard: :n= absent or invalid', () => {
  it('writes "requires :n=N" error and skips runForks when :n= is absent', async () => {
    const store = makeStore('/refine')
    const node = store.getNode('r1')

    await resolveRefineCell(node, store, new Map())

    expect(store.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('/refine requires :n=N'), 'r1')
    expect(mockRunForks).not.toHaveBeenCalled()
  })

  it.each([
    ['/refine :n=1', 1],
    ['/refine :n=0', 0],
  ])('writes "is a no-op" error and skips runForks for %s', async (command, rawN) => {
    const store = makeStore(command)
    const node = store.getNode('r1')

    await resolveRefineCell(node, store, new Map())

    expect(store.importer.createErrorNode).toHaveBeenCalledWith(
      expect.stringContaining(`/refine :n=${rawN} is a no-op`),
      'r1',
    )
    expect(mockRunForks).not.toHaveBeenCalled()
  })

  it('marks title with [✗ invalid] suffix when :n= is absent — failure visible on cell and via error child node', async () => {
    const store = makeStore('/refine')
    const node = store.getNode('r1')

    await resolveRefineCell(node, store, new Map())

    expect(node.title).toBe('My Cell [✗ invalid]')
  })

  it('replaces any pre-existing reliability suffix with [✗ invalid] when :n= is absent', async () => {
    const store = makeStore('/refine')
    const node = store.getNode('r1')
    node.title = 'My Cell [✓ 2/3]'

    await resolveRefineCell(node, store, new Map())

    expect(node.title).toBe('My Cell [✗ invalid]')
  })

  it('saves node to output when :n= is absent', async () => {
    const store = makeStore('/refine')
    const node = store.getNode('r1')

    await resolveRefineCell(node, store, new Map())

    expect(store.saveNodeToOutput).toHaveBeenCalledWith('r1')
  })
})

describe('resolveRefineCell — input guard: fork cost exceeds :limit=', () => {
  it('writes error node containing cost and limit values', async () => {
    const store = makeStore('/refine :n=3 :limit=0')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('exceeds limit'), 'r1')
  })

  it('skips runForks when cost exceeds limit', async () => {
    const store = makeStore('/refine :n=3 :limit=0')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(mockRunForks).not.toHaveBeenCalled()
  })

  it('marks title with [✗ invalid] suffix when cost exceeds :limit= — failure visible on cell and via error child node', async () => {
    const store = makeStore('/refine :n=3 :limit=0')
    const node = store.getNode('r1')

    await resolveRefineCell(node, store, new Map())

    expect(node.title).toBe('My Cell [✗ invalid]')
  })

  it('replaces any pre-existing reliability suffix with [✗ invalid] when cost exceeds :limit=', async () => {
    const store = makeStore('/refine :n=3 :limit=0')
    const node = store.getNode('r1')
    node.title = 'My Cell [✓ retry-1]'

    await resolveRefineCell(node, store, new Map())

    expect(node.title).toBe('My Cell [✗ invalid]')
  })
})

describe('resolveRefineCell — memoMap lifecycle', () => {
  it('sets memoMap to in-progress before runForks is invoked', async () => {
    const store = makeStore()
    const memoMap = new Map()
    let capturedState

    mockRunForks.mockImplementation(async () => {
      capturedState = memoMap.get('r1')
      return []
    })

    await resolveRefineCell(store.getNode('r1'), store, memoMap)

    expect(capturedState).toBe('in-progress')
  })

  it('sets memoMap to null when all forks fail in strict mode', async () => {
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'runtime-failed', forkStore: null}])

    const store = makeStore()
    const memoMap = new Map()

    await resolveRefineCell(store.getNode('r1'), store, memoMap)

    expect(memoMap.get('r1')).toBeNull()
  })

  it('sets memoMap to winner forkStore on success', async () => {
    const winner = okForkStore()
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winner}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({winnerForkIndex: 0, selectionLayer: 'primary'}),
    }))

    const store = makeStore()
    const memoMap = new Map()

    await resolveRefineCell(store.getNode('r1'), store, memoMap)

    expect(memoMap.get('r1')).toBe(winner)
  })

  it('sets memoMap to null when verdict carries winnerForkIndex: null', async () => {
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'criteria-failed', forkStore: okForkStore()}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({winnerForkIndex: null, selectionLayer: 'none'}),
    }))

    const store = makeStore()
    const memoMap = new Map()

    await resolveRefineCell(store.getNode('r1'), store, memoMap)

    expect(memoMap.get('r1')).toBeNull()
  })
})

describe('resolveRefineCell — runForks invocation parameters', () => {
  it('passes n, refineNode, store, memoMap, and null signal to runForks', async () => {
    const store = makeStore('/refine :n=5')
    const node = store.getNode('r1')
    const memoMap = new Map()
    let capturedArgs

    mockRunForks.mockImplementation(async args => {
      capturedArgs = args
      return []
    })

    await resolveRefineCell(node, store, memoMap)

    expect(capturedArgs).toMatchObject({n: 5, refineNode: node, store, memoMap, signal: null})
  })

  it('passes AbortSignal through to runForks', async () => {
    const store = makeStore()
    const ac = new AbortController()
    let capturedSignal

    mockRunForks.mockImplementation(async ({signal}) => {
      capturedSignal = signal
      return []
    })

    await resolveRefineCell(store.getNode('r1'), store, new Map(), ac.signal)

    expect(capturedSignal).toBe(ac.signal)
  })
})

describe('resolveRefineCell — ForkJudge instantiation and selectWinner parameters', () => {
  it('constructs ForkJudge with store._userId and store._workflowId', async () => {
    const store = makeStore('/refine :n=2', {userId: 'alice', workflowId: 'wf99'})
    const node = store.getNode('r1')
    const winner = okForkStore()
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winner}])

    let constructorArgs
    MockForkJudge.mockImplementation((...args) => {
      constructorArgs = args
      return {selectWinner: makeSelectWinner({winnerForkIndex: 0, selectionLayer: 'primary'})}
    })

    await resolveRefineCell(node, store, new Map())

    expect(constructorArgs[0]).toBe('alice')
    expect(constructorArgs[1]).toBe('wf99')
  })

  it('passes refineNode.parent as parentNodeId to selectWinner so judge reads the working cell content', async () => {
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

    await resolveRefineCell(store.getNode('r1'), store, new Map())

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

    await resolveRefineCell(store.getNode('r1'), store, new Map(), ac.signal)

    expect(capturedSignal).toBe(ac.signal)
  })

  it('passes ownedValidates from OwnershipResolver to selectWinner', async () => {
    const validateNode = {id: 'v1', command: '/validate must include numbers', children: []}
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
    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(capturedValidateNodes).toEqual([validateNode])
  })

  it('passes empty array to selectWinner when refine owns no validates', async () => {
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
    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(capturedValidateNodes).toEqual([])
  })
})

describe('resolveRefineCell — all forks fail (strict mode)', () => {
  const allFailForks = n =>
    Array.from({length: n}, (_, i) => ({forkIndex: i, status: 'runtime-failed', forkStore: null}))

  beforeEach(() => {
    mockRunForks.mockResolvedValue(allFailForks(3))
    MockForkJudge.mockImplementation(() => ({selectWinner: makeSelectWinner(null)}))
  })

  it('writes error node to the refine cell', async () => {
    const store = makeStore()

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('all 3 fork(s) failed'), 'r1')
  })

  it('saves node to output after writing error', async () => {
    const store = makeStore()

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store.saveNodeToOutput).toHaveBeenCalledWith('r1')
  })

  it('does not call StoreFork.applyCandidate', async () => {
    const store = makeStore()

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(StoreFork.applyCandidate).not.toHaveBeenCalled()
  })

  it('verdict {winnerForkIndex: null} triggers the same error path as a null verdict', async () => {
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({winnerForkIndex: null, selectionLayer: 'none'}),
    }))
    const store = makeStore()
    const memoMap = new Map()

    await resolveRefineCell(store.getNode('r1'), store, memoMap)

    expect(store.importer.createErrorNode).toHaveBeenCalled()
    expect(memoMap.get('r1')).toBeNull()
    expect(StoreFork.applyCandidate).not.toHaveBeenCalled()
  })

  it('reliabilityMetadata is not written when no winner is selected', async () => {
    const store = makeStore()

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.reliabilityMetadata).toBeUndefined()
  })
})

describe('resolveRefineCell — winner selected', () => {
  let winner

  beforeEach(() => {
    winner = okForkStore()
    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winner},
      {forkIndex: 1, status: 'ok', forkStore: okForkStore()},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({winnerForkIndex: 0, selectionLayer: 'primary'}),
    }))
  })

  it('calls StoreFork.applyCandidate with winner forkStore and refine cell id', async () => {
    const store = makeStore()

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(StoreFork.applyCandidate).toHaveBeenCalledWith(store, winner, 'r1')
  })

  it('saves node to output after applying winner', async () => {
    const store = makeStore()

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store.saveNodeToOutput).toHaveBeenCalledWith('r1')
  })

  it('strips pre-existing reliability suffix from title before appending new one', async () => {
    const store = makeStore()
    store._nodes.r1.title = 'My Cell [✓ 1/2]'

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const title = store._nodes.r1.title
    expect(title).not.toMatch(/\[✓ 1\/2\]/)
    expect(title).toMatch(/My Cell/)
  })

  it('does not write an error node', async () => {
    const store = makeStore()

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store.importer.createErrorNode).not.toHaveBeenCalled()
  })

  it('writes reliabilityMetadata to the winner node with full verdict shape', async () => {
    const perCriterionVerdict = [{criterionId: 'v1', criterion: 'must include numbers', forkRankings: []}]
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
        mode: 'strict',
        perCriterionVerdict,
        noSignal: false,
      }),
    }))

    const store = makeStore('/refine :n=2')
    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const meta = store._nodes.r1.reliabilityMetadata
    expect(meta).toMatchObject({
      winnerForkIndex: 0,
      perCriterionVerdict,
      mode: 'strict',
      selectionLayer: 'primary',
      noSignal: false,
      eligible: 2,
      total: 2,
    })
  })

  it('perCriterionVerdict absent from verdict defaults to [] in metadata', async () => {
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({winnerForkIndex: 0, selectionLayer: 'primary', mode: 'strict'}),
    }))

    const store = makeStore('/refine :n=2')
    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.reliabilityMetadata.perCriterionVerdict).toEqual([])
  })

  it('noSignal absent from verdict defaults to false in metadata', async () => {
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({winnerForkIndex: 0, selectionLayer: 'primary', mode: 'strict'}),
    }))

    const store = makeStore('/refine :n=2')
    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.reliabilityMetadata.noSignal).toBe(false)
  })

  it('eligible counts only ok-status forks, not criteria-failed or runtime-failed', async () => {
    mockRunForks.mockResolvedValue([
      {forkIndex: 0, status: 'ok', forkStore: winner},
      {forkIndex: 1, status: 'ok', forkStore: okForkStore()},
      {forkIndex: 2, status: 'criteria-failed', forkStore: okForkStore()},
    ])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({winnerForkIndex: 0, selectionLayer: 'primary', mode: 'strict'}),
    }))

    const store = makeStore('/refine :n=3')
    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.reliabilityMetadata.eligible).toBe(2)
    expect(store._nodes.r1.reliabilityMetadata.total).toBe(3)
  })
})

describe('resolveRefineCell — fallback selection layer', () => {
  let fallbackStore

  beforeEach(() => {
    fallbackStore = okForkStore()
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'criteria-failed', forkStore: fallbackStore}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({winnerForkIndex: 0, selectionLayer: 'fallback', mode: 'fallback'}),
    }))
  })

  it('applies winner from fallback layer (criteria-failed fork)', async () => {
    const store = makeStore('/refine :n=2 :fallback')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(StoreFork.applyCandidate).toHaveBeenCalledWith(store, fallbackStore, 'r1')
  })

  it('reliabilityMetadata records fallback selectionLayer and mode', async () => {
    const store = makeStore('/refine :n=2 :fallback')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.reliabilityMetadata).toMatchObject({
      selectionLayer: 'fallback',
      mode: 'fallback',
      winnerForkIndex: 0,
      eligible: 0,
      total: 2,
    })
  })
})

describe('resolveRefineCell — validate sibling titles transferred from winner fork', () => {
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
        r1: {id: 'r1', parent: 'p1', title: 'My Cell', command: '/refine :n=2', children: []},
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
        v1: {id: 'v1', parent: 'p1', command: '/validate criterion', title: '/validate criterion [✓]', children: []},
      },
    })

    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winnerForkStore}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({winnerForkIndex: 0, selectionLayer: 'primary', mode: 'strict', noSignal: false}),
    }))
    MockOwnershipResolver.mockReturnValue(new Map([['r1', [store.getNode('v1')]]]))

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.v1.title).toBe('/validate criterion [✓]')
    expect(store.saveNodeToOutput).toHaveBeenCalledWith('v1')
  })

  it('does not overwrite validate title when node is absent from winner fork', async () => {
    const store = new Store({
      userId: 'user1',
      nodes: {
        p1: {id: 'p1', children: ['r1', 'v1']},
        r1: {id: 'r1', parent: 'p1', title: 'My Cell', command: '/refine :n=2', children: []},
        v1: {id: 'v1', parent: 'p1', command: '/validate criterion', title: 'original title', children: []},
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
      selectWinner: makeSelectWinner({winnerForkIndex: 0, selectionLayer: 'primary', mode: 'strict', noSignal: false}),
    }))
    MockOwnershipResolver.mockReturnValue(new Map([['r1', [store.getNode('v1')]]]))

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.v1.title).toBe('original title')
    expect(store.saveNodeToOutput).not.toHaveBeenCalledWith('v1')
  })

  it('does not transfer validate titles when there are no owned validates', async () => {
    const winner = okForkStore()
    mockRunForks.mockResolvedValue([{forkIndex: 0, status: 'ok', forkStore: winner}])
    MockForkJudge.mockImplementation(() => ({
      selectWinner: makeSelectWinner({winnerForkIndex: 0, selectionLayer: 'primary', mode: 'strict', noSignal: false}),
    }))
    MockOwnershipResolver.mockReturnValue(new Map([['r1', []]]))

    const store = makeStore('/refine :n=2')
    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const nonRefineCallArgs = store.saveNodeToOutput.mock.calls.filter(([id]) => id !== 'r1')
    expect(nonRefineCallArgs).toHaveLength(0)
  })
})

describe('resolveRefineCell — noSignal: all jurors excluded from quorum', () => {
  // noSignal:true means the judge was invoked but every juror was excluded from quorum
  // (unparseable response or invoke error). The suffix must be [⚠ no judge signal]
  // regardless of which candidate pool the winner was drawn from.
  it.each([
    [
      'primary layer — ok forks present, all jurors excluded',
      '/refine :n=2',
      [
        {forkIndex: 0, status: 'ok', forkStore: null},
        {forkIndex: 1, status: 'ok', forkStore: null},
      ],
      {winnerForkIndex: 0, selectionLayer: 'primary', mode: 'strict', noSignal: true},
    ],
    [
      'fallback layer — criteria-failed forks only, all jurors excluded',
      '/refine :n=2 :fallback',
      [{forkIndex: 0, status: 'criteria-failed', forkStore: null}],
      {winnerForkIndex: 0, selectionLayer: 'fallback', mode: 'fallback', noSignal: true},
    ],
  ])('%s — suffix is [⚠ no judge signal] and metadata records noSignal', async (_, command, forks, verdict) => {
    mockRunForks.mockResolvedValue(forks)
    MockForkJudge.mockImplementation(() => ({selectWinner: makeSelectWinner(verdict)}))
    const store = makeStore(command)

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe('My Cell [⚠ no judge signal]')
    expect(store._nodes.r1.reliabilityMetadata).toMatchObject({
      noSignal: true,
      selectionLayer: verdict.selectionLayer,
    })
  })
})
