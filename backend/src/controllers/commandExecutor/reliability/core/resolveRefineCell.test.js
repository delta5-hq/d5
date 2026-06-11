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
  new Store({
    userId: opts.userId || 'user1',
    workflowId: opts.workflowId,
    nodes: nodeMap,
  })

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
  MockForkJudge.mockImplementation(() => ({
    selectWinner: makeSelectWinner(null),
  }))
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
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
      }),
    }))

    const store = makeStore()
    const memoMap = new Map()

    await resolveRefineCell(store.getNode('r1'), store, memoMap)

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

    expect(capturedArgs).toMatchObject({
      n: 5,
      refineNode: node,
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

    await resolveRefineCell(store.getNode('r1'), store, new Map(), ac.signal)

    expect(capturedSignal).toBe(ac.signal)
  })
})

describe('resolveRefineCell — ForkJudge instantiation and selectWinner parameters', () => {
  it('constructs ForkJudge with store._userId and store._workflowId', async () => {
    const store = makeStore('/refine :n=2', {
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
      selectWinner: makeSelectWinner({
        winnerForkIndex: null,
        selectionLayer: 'none',
      }),
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
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'primary',
      }),
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
      judgeInput,
    })
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

    const store = makeStore('/refine :n=2')
    await resolveRefineCell(store.getNode('r1'), store, new Map())

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

    const store = makeStore('/refine :n=2')
    await resolveRefineCell(store.getNode('r1'), store, new Map())

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
      selectWinner: makeSelectWinner({
        winnerForkIndex: 0,
        selectionLayer: 'fallback',
        mode: 'fallback',
      }),
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
        r1: {
          id: 'r1',
          parent: 'p1',
          title: 'My Cell',
          command: '/refine :n=2',
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

    await resolveRefineCell(store.getNode('r1'), store, new Map())

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
          command: '/refine :n=2',
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

    await resolveRefineCell(store.getNode('r1'), store, new Map())

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

    const store = makeStore('/refine :n=2')
    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const nonRefineCallArgs = store.saveNodeToOutput.mock.calls.filter(([id]) => id !== 'r1')
    expect(nonRefineCallArgs).toHaveLength(0)
  })
})

describe('resolveRefineCell — noSignal routing: strict mode emits warning, fallback mode suppresses warning', () => {
  it('primary layer — all forks ok but jurors excluded → [⚠ no judge signal] suffix, metadata noSignal:true', async () => {
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
    const store = makeStore('/refine :n=2')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe('My Cell [⚠ no judge signal]')
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
    const store = makeStore('/refine :n=2')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe('My Cell [✓ 2/2]')
    expect(store._nodes.r1.reliabilityMetadata).toMatchObject({
      noSignal: false,
      eligible: 2,
      total: 2,
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
    const store = makeStore('/refine :n=2 :fallback')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe('My Cell [⚠ fallback: 0/2 passed; chose fork-0]')
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
    const store = makeStore('/refine :n=2')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    expect(store._nodes.r1.title).toBe('My Cell [⚠ no judge signal]')
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
    const store = makeStore('/refine :n=2 :fallback')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

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

describe('resolveRefineCell — ForkProgressEmitter integration', () => {
  const makeEmitter = () => ({
    forksStarted: jest.fn(),
    forkSettled: jest.fn(),
    refineComplete: jest.fn(),
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

  it('calls emitter.forksStarted with refineNodeId and n before forks run', async () => {
    mockRunForks.mockResolvedValue(twoOkForks())
    const store = makeStore('/refine :n=2')
    const emitter = makeEmitter()

    await resolveRefineCell(store.getNode('r1'), store, new Map(), null, emitter)

    expect(emitter.forksStarted).toHaveBeenCalledWith('r1', 2)
  })

  it('calls emitter.refineComplete with winner index on success', async () => {
    mockRunForks.mockResolvedValue(twoOkForks())
    const store = makeStore('/refine :n=2')
    const emitter = makeEmitter()

    await resolveRefineCell(store.getNode('r1'), store, new Map(), null, emitter)

    expect(emitter.refineComplete).toHaveBeenCalledWith('r1', 0, 2)
  })

  it('calls emitter.refineComplete with null winner when all forks fail in strict mode', async () => {
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
    const store2 = makeStore('/refine :n=2')
    const emitter = makeEmitter()

    await resolveRefineCell(store2.getNode('r1'), store2, new Map(), null, emitter)

    expect(emitter.refineComplete).toHaveBeenCalledWith('r1', null, 2)
  })

  it('does not call emitter on guard-rejected cells', async () => {
    const store = makeStore('/refine')
    const emitter = makeEmitter()

    await resolveRefineCell(store.getNode('r1'), store, new Map(), null, emitter)

    expect(emitter.forksStarted).not.toHaveBeenCalled()
    expect(emitter.refineComplete).not.toHaveBeenCalled()
  })

  it('wires onForkSettled to emitter.forkSettled — called once per settled fork', async () => {
    const forks = twoOkForks()
    mockRunForks.mockImplementation(async ({onForkSettled}) => {
      onForkSettled?.(forks[0])
      onForkSettled?.(forks[1])
      return forks
    })
    const store = makeStore('/refine :n=2')
    const emitter = makeEmitter()

    await resolveRefineCell(store.getNode('r1'), store, new Map(), null, emitter)

    expect(emitter.forkSettled).toHaveBeenCalledTimes(2)
    expect(emitter.forkSettled).toHaveBeenCalledWith('r1', forks[0])
    expect(emitter.forkSettled).toHaveBeenCalledWith('r1', forks[1])
  })

  it('does not call emitter when fork cost exceeds :limit= guard', async () => {
    const store = makeStore('/refine :n=3 :limit=0')
    const emitter = makeEmitter()

    await resolveRefineCell(store.getNode('r1'), store, new Map(), null, emitter)

    expect(emitter.forksStarted).not.toHaveBeenCalled()
    expect(emitter.refineComplete).not.toHaveBeenCalled()
  })
})

describe('resolveRefineCell — discardedForks in reliabilityMetadata', () => {
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
    const store = makeStore('/refine :n=2')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

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
    const store = makeStore('/refine :n=2')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

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
    const store = makeStore('/refine :n=2')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

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
    const store = makeStore('/refine :n=2')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

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
    const store = makeStore('/refine :n=3')

    await resolveRefineCell(store.getNode('r1'), store, new Map())

    const discarded = store.getNode('r1').reliabilityMetadata.discardedForks
    expect(discarded.map(f => f.forkIndex)).not.toContain(1)
    expect(discarded).toHaveLength(2)
  })

  describe('resolveRefineCell — null-guard: winner fork has no store', () => {
    it('creates error node and returns early when judge returns index pointing to runtime-failed fork', async () => {
      const store = makeStore('/refine :n=2')
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

      await resolveRefineCell(store.getNode('r1'), store, memoMap)

      expect(require('./StoreFork').applyCandidate).not.toHaveBeenCalled()
      expect(store.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('internal error'), 'r1')
      expect(memoMap.get('r1')).toBeNull()
    })

    it('proceeds normally when winner fork has a valid forkStore', async () => {
      const store = makeStore('/refine :n=2')
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

      await resolveRefineCell(store.getNode('r1'), store, memoMap)

      expect(require('./StoreFork').applyCandidate).toHaveBeenCalledWith(store, winnerStore, 'r1')
      expect(memoMap.get('r1')).toBe(winnerStore)
    })
  })
})
