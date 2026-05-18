import {runForks} from './SubtreeForkRunner'
import {CriteriaFailedError} from './CriteriaFailedError'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../../commands/utils/runCommand', () => ({
  runCommand: jest.fn(),
}))

const {runCommand: mockRunCommand} = require('../../commands/utils/runCommand')

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

const minimalTree = () =>
  buildStore({
    root: {id: 'root', children: ['parent']},
    parent: {id: 'parent', parent: 'root', command: '/chat do something', children: ['refine']},
    refine: {id: 'refine', parent: 'parent', command: '/refine :n=3', children: []},
  })

beforeEach(() => {
  mockRunCommand.mockReset()
  mockRunCommand.mockResolvedValue(undefined)
})

describe('runForks', () => {
  // Error cases

  describe('missing parent', () => {
    it('throws when refineNode has no parent field', async () => {
      const store = buildStore({
        refine: {id: 'refine', command: '/refine :n=2', children: []},
      })
      const memoMap = new Map()
      await expect(runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})).rejects.toThrow(
        "[SubtreeForkRunner] refineNode 'refine' has no parent in store",
      )
    })

    it('throws when parent id does not resolve in store', async () => {
      const store = buildStore({
        refine: {id: 'refine', parent: 'ghost', command: '/refine :n=2', children: []},
      })
      const memoMap = new Map()
      await expect(runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})).rejects.toThrow(
        "[SubtreeForkRunner] refineNode 'refine' has no parent in store",
      )
    })
  })

  // Fork count

  describe('fork count', () => {
    it('calls runCommand exactly N times for n=2', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

      expect(mockRunCommand).toHaveBeenCalledTimes(2)
    })

    it('calls runCommand exactly N times for n=5', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      await runForks({refineNode: store.getNode('refine'), store, n: 5, memoMap})

      expect(mockRunCommand).toHaveBeenCalledTimes(5)
    })

    it('calls runCommand exactly 1 time for n=1', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      await runForks({refineNode: store.getNode('refine'), store, n: 1, memoMap})

      expect(mockRunCommand).toHaveBeenCalledTimes(1)
    })
  })

  // Return shape — now returns ALL N results with status

  describe('return shape', () => {
    it('returns exactly N results (one per fork, including failures)', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      const results = await runForks({refineNode: store.getNode('refine'), store, n: 3, memoMap})

      expect(results).toHaveLength(3)
    })

    it('each ok ForkResult has forkStore, forkIndex, and status ok', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      const results = await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

      results.forEach(r => {
        expect(r).toHaveProperty('forkStore')
        expect(r).toHaveProperty('forkIndex')
        expect(r).toHaveProperty('status', 'ok')
        expect(typeof r.forkIndex).toBe('number')
        expect(r.forkStore).toBeInstanceOf(Store)
      })
    })

    it('forkIndex values are stable (0, 1, 2 for n=3)', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      const results = await runForks({refineNode: store.getNode('refine'), store, n: 3, memoMap})

      const indices = results.map(r => r.forkIndex).sort((a, b) => a - b)
      expect(indices).toEqual([0, 1, 2])
    })
  })

  // Fork independence

  describe('fork independence', () => {
    it('each fork receives an independent store (not the same reference)', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const receivedStores = []

      mockRunCommand.mockImplementation(async ({store: forkStore}) => {
        receivedStores.push(forkStore)
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 3, memoMap})

      expect(receivedStores[0]).not.toBe(receivedStores[1])
      expect(receivedStores[0]).not.toBe(receivedStores[2])
      expect(receivedStores[1]).not.toBe(receivedStores[2])
    })

    it('forks start with the same node data as the source store', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const receivedStores = []

      mockRunCommand.mockImplementation(async ({store: forkStore}) => {
        receivedStores.push(forkStore)
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

      for (const forkStore of receivedStores) {
        expect(forkStore._nodes).toEqual(store._nodes)
      }
    })

    it('source store nodes are untouched after forks mutate their own stores', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      mockRunCommand.mockImplementation(async ({store: forkStore}) => {
        forkStore._nodes.parent.title = 'mutated in fork'
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 3, memoMap})

      expect(store._nodes.parent.title).toBeUndefined()
    })

    it('mutations in one fork do not affect other forks', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const receivedStores = []
      let callCount = 0

      mockRunCommand.mockImplementation(async ({store: forkStore}) => {
        receivedStores.push(forkStore)
        callCount++
        if (callCount === 1) {
          forkStore._nodes.parent.title = 'mutated in fork 0'
        }
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

      expect(receivedStores[0]._nodes.parent.title).toBe('mutated in fork 0')
      expect(receivedStores[1]._nodes.parent.title).toBeUndefined()
    })
  })

  // memoMap pre-seeding (re-entrancy guard)

  describe('memoMap re-entrancy guard', () => {
    it('sets refineNode.id in memoMap before any runCommand call', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const memoStateAtCallTime = []

      mockRunCommand.mockImplementation(async () => {
        memoStateAtCallTime.push(memoMap.has('refine'))
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 3, memoMap})

      expect(memoStateAtCallTime).toEqual([true, true, true])
    })

    it("sets refineNode.id to 'in-progress' in memoMap", async () => {
      const store = minimalTree()
      const memoMap = new Map()

      mockRunCommand.mockImplementation(async () => {
        expect(memoMap.get('refine')).toBe('in-progress')
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 1, memoMap})
    })

    it('memoMap still contains refineNode.id after runForks completes', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

      expect(memoMap.has('refine')).toBe(true)
    })
  })

  // Fork-local memoMaps — each fork gets an independent copy

  describe('fork-local memoMap isolation', () => {
    it('each fork receives a distinct memoMap instance (not the shared outer map)', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const receivedMemoMaps = []

      mockRunCommand.mockImplementation(async ({memoMap: m}) => {
        receivedMemoMaps.push(m)
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 3, memoMap})

      expect(receivedMemoMaps).toHaveLength(3)
      receivedMemoMaps.forEach(m => expect(m).not.toBe(memoMap))
      // Each fork's memoMap is a different Map instance
      expect(receivedMemoMaps[0]).not.toBe(receivedMemoMaps[1])
      expect(receivedMemoMaps[0]).not.toBe(receivedMemoMaps[2])
    })

    it('each fork memoMap contains refineNode.id at call time', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      mockRunCommand.mockImplementation(async ({memoMap: m}) => {
        expect(m.has('refine')).toBe(true)
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})
    })

    it('mutations to fork memoMap do not propagate to outer memoMap', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      let callCount = 0

      mockRunCommand.mockImplementation(async ({memoMap: m}) => {
        callCount++
        m.set(`fork-${callCount}-key`, 'fork-local-value')
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

      expect(memoMap.has('fork-1-key')).toBe(false)
      expect(memoMap.has('fork-2-key')).toBe(false)
    })
  })

  // Cell resolution in fork

  describe('cell passed to runCommand', () => {
    it('resolves cell from the fork store (not the source store reference)', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const receivedCells = []

      mockRunCommand.mockImplementation(async ({cell}) => {
        receivedCells.push(cell)
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

      receivedCells.forEach(cell => {
        expect(cell.id).toBe('parent')
      })
      expect(receivedCells[0]).not.toBe(store.getNode('parent'))
    })

    it('cell command is preserved from the source node', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const receivedCells = []

      mockRunCommand.mockImplementation(async ({cell}) => {
        receivedCells.push(cell)
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

      receivedCells.forEach(cell => {
        expect(cell.command).toBe('/chat do something')
      })
    })
  })

  // signal forwarding

  describe('signal forwarding', () => {
    it('passes the signal to every runCommand call', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const ac = new AbortController()
      const receivedSignals = []

      mockRunCommand.mockImplementation(async ({signal}) => {
        receivedSignals.push(signal)
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap, signal: ac.signal})

      receivedSignals.forEach(s => expect(s).toBe(ac.signal))
    })

    it('passes null signal when not specified', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const receivedSignals = []

      mockRunCommand.mockImplementation(async ({signal}) => {
        receivedSignals.push(signal)
      })

      await runForks({refineNode: store.getNode('refine'), store, n: 1, memoMap})

      expect(receivedSignals[0]).toBeNull()
    })
  })

  // Runtime-failed fork handling — now returns with status:'runtime-failed'

  describe('runtime-failed forks have status runtime-failed', () => {
    it('failed fork has status runtime-failed with reason', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      let callCount = 0

      mockRunCommand.mockImplementation(async () => {
        callCount++
        if (callCount === 2) throw new Error('LLM error')
      })

      const results = await runForks({refineNode: store.getNode('refine'), store, n: 3, memoMap})

      expect(results).toHaveLength(3)
      const failed = results.find(r => r.forkIndex === 1)
      expect(failed.status).toBe('runtime-failed')
      expect(failed.reason).toContain('LLM error')
      expect(failed.forkStore).toBeNull()
    })

    it('all forks runtime-failed returns all with status runtime-failed', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      mockRunCommand.mockRejectedValue(new Error('all fail'))

      const results = await runForks({refineNode: store.getNode('refine'), store, n: 3, memoMap})

      expect(results).toHaveLength(3)
      results.forEach(r => expect(r.status).toBe('runtime-failed'))
    })

    it('successful forks have status ok while failed fork has status runtime-failed', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      let callCount = 0

      mockRunCommand.mockImplementation(async () => {
        callCount++
        if (callCount === 1) throw new Error('first fork fails')
      })

      const results = await runForks({refineNode: store.getNode('refine'), store, n: 3, memoMap})

      expect(results).toHaveLength(3)
      const okResults = results.filter(r => r.status === 'ok')
      const failedResults = results.filter(r => r.status === 'runtime-failed')
      expect(okResults).toHaveLength(2)
      expect(failedResults).toHaveLength(1)
    })
  })

  // Criteria-failed fork handling

  describe('criteria-failed forks have status criteria-failed', () => {
    it('fork that throws CriteriaFailedError gets status criteria-failed', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      let callCount = 0

      mockRunCommand.mockImplementation(async () => {
        callCount++
        if (callCount === 2) throw new CriteriaFailedError('must include numbers', 3)
      })

      const results = await runForks({refineNode: store.getNode('refine'), store, n: 3, memoMap})

      expect(results).toHaveLength(3)
      const failed = results.find(r => r.forkIndex === 1)
      expect(failed.status).toBe('criteria-failed')
      expect(failed.failedAt).toBe('must include numbers')
      expect(failed.attempts).toBe(3)
      expect(failed.forkStore).toBeDefined()
      expect(failed.forkStore).toBeInstanceOf(Store)
    })

    it('criteria-failed fork retains its forkStore for fallback ranking', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      mockRunCommand.mockImplementation(async ({store: forkStore}) => {
        forkStore._nodes.parent.title = 'partial output'
        throw new CriteriaFailedError('criterion', 3)
      })

      const results = await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

      expect(results).toHaveLength(2)
      results.forEach(r => {
        expect(r.status).toBe('criteria-failed')
        expect(r.forkStore).not.toBeNull()
        expect(r.forkStore._nodes.parent.title).toBe('partial output')
      })
    })

    // P0.5a acceptance (part 2): validate [✗ N attempts] suffix written by runCommand into the
    // fork store is visible in the criteria-failed result, ready for ForkJudge and applyCandidate.
    it('P0.5a: validate [✗ N attempts] suffix written to fork store survives CriteriaFailedError', async () => {
      const store = buildStore({
        root: {id: 'root', children: ['parent']},
        parent: {id: 'parent', parent: 'root', command: '/chat do task', children: ['refine']},
        refine: {id: 'refine', parent: 'parent', command: '/refine :n=2 :fallback', children: ['validate']},
        validate: {id: 'validate', parent: 'refine', command: '/validate criterion', children: []},
      })
      const memoMap = new Map()

      mockRunCommand.mockImplementation(async ({store: forkStore}) => {
        // Simulate what runCommand's persistValidateSuffixes(false) writes before throwing
        forkStore._nodes.validate.title = '[✗ 3 attempts]'
        throw new CriteriaFailedError('criterion', 3)
      })

      const results = await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

      results.forEach(r => {
        expect(r.status).toBe('criteria-failed')
        expect(r.forkStore._nodes.validate.title).toBe('[✗ 3 attempts]')
      })
    })
  })

  // Additive cost: 2+3=5, not 2×3=6

  describe('additive cost: sequential runForks calls do not compound fork counts', () => {
    it('running inner(n=3) then outer(n=2) produces 3+2=5 total runCommand calls', async () => {
      const store = buildStore({
        root: {id: 'root', children: ['innerParent', 'outerParent']},
        innerParent: {id: 'innerParent', parent: 'root', command: '/chat inner task', children: ['innerRefine']},
        innerRefine: {id: 'innerRefine', parent: 'innerParent', command: '/refine :n=3', children: []},
        outerParent: {id: 'outerParent', parent: 'root', command: '/chat outer task', children: ['outerRefine']},
        outerRefine: {id: 'outerRefine', parent: 'outerParent', command: '/refine :n=2', children: []},
      })

      const memoMap = new Map()

      await runForks({refineNode: store.getNode('innerRefine'), store, n: 3, memoMap})
      await runForks({refineNode: store.getNode('outerRefine'), store, n: 2, memoMap})

      expect(mockRunCommand).toHaveBeenCalledTimes(5)
    })

    it("outer forks receive memoMap with inner's id (preventing multiplicative re-execution)", async () => {
      const store = buildStore({
        root: {id: 'root', children: ['innerParent', 'outerParent']},
        innerParent: {id: 'innerParent', parent: 'root', command: '/chat inner task', children: ['innerRefine']},
        innerRefine: {id: 'innerRefine', parent: 'innerParent', command: '/refine :n=3', children: []},
        outerParent: {id: 'outerParent', parent: 'root', command: '/chat outer task', children: ['outerRefine']},
        outerRefine: {id: 'outerRefine', parent: 'outerParent', command: '/refine :n=2', children: []},
      })

      const memoMap = new Map()

      await runForks({refineNode: store.getNode('innerRefine'), store, n: 3, memoMap})

      const outerMemoSnapshots = []
      mockRunCommand.mockImplementation(async ({memoMap: m}) => {
        outerMemoSnapshots.push(m.has('innerRefine'))
      })

      await runForks({refineNode: store.getNode('outerRefine'), store, n: 2, memoMap})

      expect(outerMemoSnapshots).toEqual([true, true])
    })
  })

  // title-fallback for parent node

  describe('parent command resolution', () => {
    it('falls back to parent title when command field is absent', async () => {
      const store = buildStore({
        root: {id: 'root', children: ['parent']},
        parent: {id: 'parent', parent: 'root', title: '/chat from title', children: ['refine']},
        refine: {id: 'refine', parent: 'parent', command: '/refine :n=2', children: []},
      })
      const memoMap = new Map()

      const results = await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

      expect(results).toHaveLength(2)
      expect(mockRunCommand).toHaveBeenCalledTimes(2)
    })
  })
})

describe('fork store isolation — each fork starts with a deep clone of source nodes', () => {
  it('each fork store contains all nodes from the source store at fork time', async () => {
    const store = buildStore({
      root: {id: 'root', children: ['parent']},
      parent: {id: 'parent', parent: 'root', command: '/chat', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', command: '/refine :n=2', children: []},
      step3: {id: 'step3', parent: 'root', command: '/chat step 3 output', children: []},
    })
    const memoMap = new Map()
    const receivedStores = []

    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      receivedStores.push(forkStore)
    })

    await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

    receivedStores.forEach(forkStore => {
      expect(forkStore._nodes['step3']).toBeDefined()
      expect(forkStore._nodes['step3'].command).toBe('/chat step 3 output')
    })
  })

  it('node written into one fork _nodes is NOT visible in a sibling fork', async () => {
    const store = buildStore({
      root: {id: 'root', children: ['parent']},
      parent: {id: 'parent', parent: 'root', command: '/chat', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', command: '/refine :n=3', children: []},
    })
    const memoMap = new Map()
    const receivedStores = []
    let callCount = 0

    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      receivedStores.push(forkStore)
      callCount++
      if (callCount === 1) {
        forkStore._nodes['fork0_output'] = {id: 'fork0_output', title: 'fork 0 result'}
      }
    })

    await runForks({refineNode: store.getNode('refine'), store, n: 3, memoMap})

    expect(receivedStores[0]._nodes['fork0_output']).toBeDefined()
    expect(receivedStores[1]._nodes['fork0_output']).toBeUndefined()
    expect(receivedStores[2]._nodes['fork0_output']).toBeUndefined()
  })

  it('node written into a fork _nodes is NOT visible in the source store', async () => {
    const store = buildStore({
      root: {id: 'root', children: ['parent']},
      parent: {id: 'parent', parent: 'root', command: '/chat', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', command: '/refine :n=2', children: []},
    })
    const memoMap = new Map()

    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      forkStore._nodes['fork_output'] = {id: 'fork_output', title: 'fork result'}
    })

    await runForks({refineNode: store.getNode('refine'), store, n: 2, memoMap})

    expect(store._nodes['fork_output']).toBeUndefined()
  })
})

// P0.5(c) acceptance: early-termination property
// When CriteriaFailedError is thrown inside a fork, no further work runs in that fork.
// The fork terminates at the point of failure; "steps" after the error are unreachable.
describe('P0.5(c): early-termination — CriteriaFailedError stops fork execution immediately', () => {
  it('no post-error work is attempted after CriteriaFailedError is thrown', async () => {
    const store = minimalTree()
    const memoMap = new Map()
    let postErrorWorkAttempted = false

    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      // Simulate partial work (step 1 of 5)
      forkStore._nodes.parent.title = 'partial-step-1'
      // Step 2 fails validation — fork terminates here
      throw new CriteriaFailedError('must include numbers', 3)
      // Steps 3-5 are unreachable after the throw:
      // eslint-disable-next-line no-unreachable
      postErrorWorkAttempted = true
    })

    const results = await runForks({refineNode: store.getNode('refine'), store, n: 1, memoMap})

    expect(results[0].status).toBe('criteria-failed')
    expect(postErrorWorkAttempted).toBe(false)
  })

  it('sibling forks continue independently after one fork throws CriteriaFailedError', async () => {
    const store = minimalTree()
    const memoMap = new Map()
    const executedForks = []

    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      // Identify which fork this is by its store reference
      const forkIdx = executedForks.indexOf(forkStore)
      const idx = forkIdx === -1 ? executedForks.push(forkStore) - 1 : forkIdx
      if (idx === 1) throw new CriteriaFailedError('criterion', 3)
    })

    const results = await runForks({refineNode: store.getNode('refine'), store, n: 3, memoMap})

    // Fork 1 fails; forks 0 and 2 succeed
    const failed = results.find(r => r.status === 'criteria-failed')
    const ok = results.filter(r => r.status === 'ok')
    expect(failed).toBeDefined()
    expect(ok).toHaveLength(2)
    // All 3 forks were attempted (Promise.allSettled runs all in parallel)
    expect(mockRunCommand).toHaveBeenCalledTimes(3)
  })
})
