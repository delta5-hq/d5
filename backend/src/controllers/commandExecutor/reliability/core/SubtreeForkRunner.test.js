import {runForks, computeEffectiveN} from './SubtreeForkRunner'
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
    parent: {
      id: 'parent',
      parent: 'root',
      command: '/chat do something',
      children: ['elect'],
    },
    elect: {
      id: 'elect',
      parent: 'parent',
      command: '/elect :n=3',
      children: [],
    },
  })

beforeEach(() => {
  mockRunCommand.mockReset()
  mockRunCommand.mockResolvedValue(undefined)
})

describe('runForks', () => {
  describe('missing parent', () => {
    it('throws when electNode has no parent field', async () => {
      const store = buildStore({
        elect: {id: 'elect', command: '/elect :n=2', children: []},
      })
      const memoMap = new Map()
      await expect(runForks({electNode: store.getNode('elect'), store, n: 2, memoMap})).rejects.toThrow(
        "[SubtreeForkRunner] electNode 'elect' has no parent in store",
      )
    })

    it('throws when parent id does not resolve in store', async () => {
      const store = buildStore({
        elect: {
          id: 'elect',
          parent: 'ghost',
          command: '/elect :n=2',
          children: [],
        },
      })
      const memoMap = new Map()
      await expect(runForks({electNode: store.getNode('elect'), store, n: 2, memoMap})).rejects.toThrow(
        "[SubtreeForkRunner] electNode 'elect' has no parent in store",
      )
    })
  })

  describe('fork count', () => {
    it('calls runCommand exactly N times for n=2', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })

      expect(mockRunCommand).toHaveBeenCalledTimes(2)
    })

    it('calls runCommand exactly N times for n=5', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 5,
        memoMap,
      })

      expect(mockRunCommand).toHaveBeenCalledTimes(5)
    })

    it('collapses side-effecting MCP alias parent to one execution with suppression evidence', async () => {
      const store = buildStore({
        root: {id: 'root', children: ['parent']},
        parent: {
          id: 'parent',
          parent: 'root',
          command: '/tool mutate',
          children: ['elect'],
        },
        elect: {
          id: 'elect',
          parent: 'parent',
          command: '/elect :n=3',
          children: [],
        },
      })
      store._aliases = {mcp: [{alias: '/tool'}], rpc: []}

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap: new Map(),
      })

      expect(mockRunCommand).toHaveBeenCalledTimes(1)
      expect(mockRunCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: 'mcp:tool',
          mcpAlias: expect.objectContaining({alias: '/tool'}),
        }),
        expect.anything(),
      )
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        status: 'ok',
        suppressed: true,
        cause: 'side-effecting-alias',
        requestedN: 3,
      })
    })

    it('collapses side-effecting RPC alias parent to one execution with suppression evidence', async () => {
      const store = buildStore({
        root: {id: 'root', children: ['parent']},
        parent: {
          id: 'parent',
          parent: 'root',
          command: '/ssh mutate',
          children: ['elect'],
        },
        elect: {
          id: 'elect',
          parent: 'parent',
          command: '/elect :n=3',
          children: [],
        },
      })
      store._aliases = {mcp: [], rpc: [{alias: '/ssh'}]}

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap: new Map(),
      })

      expect(mockRunCommand).toHaveBeenCalledTimes(1)
      expect(mockRunCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: 'rpc:ssh',
          rpcAlias: expect.objectContaining({alias: '/ssh'}),
        }),
        expect.anything(),
      )
      expect(results[0]).toMatchObject({suppressed: true, requestedN: 3})
    })

    it('collapses side-effecting /mcp fusion parent to one execution with suppression evidence', async () => {
      const store = buildStore({
        root: {id: 'root', children: ['parent']},
        parent: {
          id: 'parent',
          parent: 'root',
          command: '/mcp mutate',
          children: ['elect'],
        },
        elect: {
          id: 'elect',
          parent: 'parent',
          command: '/elect :n=3',
          children: [],
        },
      })

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap: new Map(),
      })

      expect(mockRunCommand).toHaveBeenCalledTimes(1)
      expect(mockRunCommand).toHaveBeenCalledWith(expect.objectContaining({queryType: 'mcp-fusion'}), expect.anything())
      expect(results[0]).toMatchObject({suppressed: true, requestedN: 3})
    })

    it('does not mark side-effect suppression when an external parent already executes once', async () => {
      const store = buildStore({
        root: {id: 'root', children: ['parent']},
        parent: {
          id: 'parent',
          parent: 'root',
          command: '/tool mutate',
          children: ['elect'],
        },
        elect: {
          id: 'elect',
          parent: 'parent',
          command: '/elect :n=1',
          children: [],
        },
      })
      store._aliases = {mcp: [{alias: '/tool'}], rpc: []}

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 1,
        memoMap: new Map(),
      })

      expect(mockRunCommand).toHaveBeenCalledTimes(1)
      expect(results).toHaveLength(1)
      expect(results[0].suppressed).toBeUndefined()
      expect(results[0].requestedN).toBeUndefined()
    })

    it('calls runCommand exactly 1 time for n=1', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 1,
        memoMap,
      })

      expect(mockRunCommand).toHaveBeenCalledTimes(1)
    })
  })

  describe('return shape', () => {
    it('returns exactly N results (one per fork, including failures)', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap,
      })

      expect(results).toHaveLength(3)
    })

    it('each ok ForkResult has forkStore, forkIndex, and status ok', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })

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

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap,
      })

      const indices = results.map(r => r.forkIndex).sort((a, b) => a - b)
      expect(indices).toEqual([0, 1, 2])
    })

    describe('leafOutputs in ForkResult', () => {
      it('ok result always carries leafOutputs array (empty when parent has no prompts)', async () => {
        const store = minimalTree()
        const memoMap = new Map()

        const results = await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 1,
          memoMap,
        })

        expect(results[0].leafOutputs).toEqual([])
      })

      it('ok result leafOutputs reflect content written to prompts by runCommand', async () => {
        const store = minimalTree()
        const memoMap = new Map()

        mockRunCommand.mockImplementation(async ({store: forkStore}) => {
          forkStore._nodes['out1'] = {
            id: 'out1',
            title: 'LLM response text',
            parent: 'parent',
          }
          forkStore._nodes.parent.prompts = ['out1']
        })

        const results = await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 1,
          memoMap,
        })

        expect(results[0].leafOutputs).toEqual([{nodeId: 'out1', content: 'LLM response text'}])
      })

      it('runtime-failed result always carries leafOutputs: [] (forkStore is null)', async () => {
        const store = minimalTree()
        const memoMap = new Map()
        mockRunCommand.mockRejectedValue(new Error('provider down'))

        const results = await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 1,
          memoMap,
        })

        expect(results[0].status).toBe('runtime-failed')
        expect(results[0].leafOutputs).toEqual([])
      })

      it('criteria-failed result carries leafOutputs from the partially-run fork store', async () => {
        const store = minimalTree()
        const memoMap = new Map()

        mockRunCommand.mockImplementation(async ({store: forkStore}) => {
          forkStore._nodes['out1'] = {
            id: 'out1',
            title: 'partial output',
            parent: 'parent',
          }
          forkStore._nodes.parent.prompts = ['out1']
          throw new CriteriaFailedError('criterion', 3)
        })

        const results = await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 1,
          memoMap,
        })

        expect(results[0].status).toBe('criteria-failed')
        expect(results[0].leafOutputs).toEqual([{nodeId: 'out1', content: 'partial output'}])
      })

      it('each fork has independent leafOutputs — content does not bleed between forks', async () => {
        const store = minimalTree()
        const memoMap = new Map()
        let forkCounter = 0

        mockRunCommand.mockImplementation(async ({store: forkStore}) => {
          const idx = forkCounter++
          const outId = `out${idx}`
          forkStore._nodes[outId] = {
            id: outId,
            title: `response from fork ${idx}`,
            parent: 'parent',
          }
          forkStore._nodes.parent.prompts = [outId]
        })

        const results = await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 3,
          memoMap,
        })

        const sorted = results.slice().sort((a, b) => a.forkIndex - b.forkIndex)
        sorted.forEach((r, i) => {
          expect(r.leafOutputs).toHaveLength(1)
          expect(r.leafOutputs[0].content).toContain(`fork ${i}`)
        })
      })
    })
  })

  describe('fork independence', () => {
    it('each fork receives an independent store (not the same reference)', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const receivedStores = []

      mockRunCommand.mockImplementation(async ({store: forkStore}) => {
        receivedStores.push(forkStore)
      })

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap,
      })

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

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })

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

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap,
      })

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

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })

      expect(receivedStores[0]._nodes.parent.title).toBe('mutated in fork 0')
      expect(receivedStores[1]._nodes.parent.title).toBeUndefined()
    })

    it('forks include nodes that are outside the elect subtree (full store snapshot)', async () => {
      const store = buildStore({
        root: {id: 'root', children: ['parent', 'sibling']},
        parent: {
          id: 'parent',
          parent: 'root',
          command: '/chat',
          children: ['elect'],
        },
        elect: {
          id: 'elect',
          parent: 'parent',
          command: '/elect :n=2',
          children: [],
        },
        sibling: {
          id: 'sibling',
          parent: 'root',
          command: '/chat step 3 output',
          children: [],
        },
      })
      const memoMap = new Map()
      const receivedStores = []

      mockRunCommand.mockImplementation(async ({store: forkStore}) => {
        receivedStores.push(forkStore)
      })

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })

      receivedStores.forEach(forkStore => {
        expect(forkStore._nodes['sibling']).toBeDefined()
        expect(forkStore._nodes['sibling'].command).toBe('/chat step 3 output')
      })
    })
  })

  describe('memoMap re-entrancy guard', () => {
    it('sets electNode.id in memoMap before any runCommand call', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const memoStateAtCallTime = []

      mockRunCommand.mockImplementation(async () => {
        memoStateAtCallTime.push(memoMap.has('elect'))
      })

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap,
      })

      expect(memoStateAtCallTime).toEqual([true, true, true])
    })

    it("sets electNode.id to 'in-progress' in memoMap", async () => {
      const store = minimalTree()
      const memoMap = new Map()

      mockRunCommand.mockImplementation(async () => {
        expect(memoMap.get('elect')).toBe('in-progress')
      })

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 1,
        memoMap,
      })
    })

    it('memoMap still contains electNode.id after runForks completes', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })

      expect(memoMap.has('elect')).toBe(true)
    })
  })

  describe('fork-local memoMap isolation', () => {
    it('each fork receives a distinct memoMap instance (not the shared outer map)', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const receivedMemoMaps = []

      mockRunCommand.mockImplementation(async ({memoMap: m}) => {
        receivedMemoMaps.push(m)
      })

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap,
      })

      expect(receivedMemoMaps).toHaveLength(3)
      receivedMemoMaps.forEach(m => expect(m).not.toBe(memoMap))
      expect(receivedMemoMaps[0]).not.toBe(receivedMemoMaps[1])
      expect(receivedMemoMaps[0]).not.toBe(receivedMemoMaps[2])
    })

    it('each fork memoMap contains electNode.id at call time', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      mockRunCommand.mockImplementation(async ({memoMap: m}) => {
        expect(m.has('elect')).toBe(true)
      })

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })
    })

    it('mutations to fork memoMap do not propagate to outer memoMap', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      let callCount = 0

      mockRunCommand.mockImplementation(async ({memoMap: m}) => {
        callCount++
        m.set(`fork-${callCount}-key`, 'fork-local-value')
      })

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })

      expect(memoMap.has('fork-1-key')).toBe(false)
      expect(memoMap.has('fork-2-key')).toBe(false)
    })
  })

  describe('cell passed to runCommand', () => {
    it('resolves cell from the fork store (not the source store reference)', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const receivedCells = []

      mockRunCommand.mockImplementation(async ({cell}) => {
        receivedCells.push(cell)
      })

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })

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

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })

      receivedCells.forEach(cell => {
        expect(cell.command).toBe('/chat do something')
      })
    })
  })

  describe('signal forwarding', () => {
    it('passes the signal to every runCommand call', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const ac = new AbortController()
      const receivedSignals = []

      mockRunCommand.mockImplementation(async ({signal}) => {
        receivedSignals.push(signal)
      })

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
        signal: ac.signal,
      })

      receivedSignals.forEach(s => expect(s).toBe(ac.signal))
    })

    it('passes null signal when not specified', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      const receivedSignals = []

      mockRunCommand.mockImplementation(async ({signal}) => {
        receivedSignals.push(signal)
      })

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 1,
        memoMap,
      })

      expect(receivedSignals[0]).toBeNull()
    })
  })

  describe('runtime-failed forks have status runtime-failed', () => {
    it('failed fork has status runtime-failed with reason', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      let callCount = 0

      mockRunCommand.mockImplementation(async () => {
        callCount++
        if (callCount === 2) throw new Error('LLM error')
      })

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap,
      })

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

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap,
      })

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

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap,
      })

      expect(results).toHaveLength(3)
      const okResults = results.filter(r => r.status === 'ok')
      const failedResults = results.filter(r => r.status === 'runtime-failed')
      expect(okResults).toHaveLength(2)
      expect(failedResults).toHaveLength(1)
    })
  })

  describe('criteria-failed forks have status criteria-failed', () => {
    it('fork that throws CriteriaFailedError gets status criteria-failed', async () => {
      const store = minimalTree()
      const memoMap = new Map()
      let callCount = 0

      mockRunCommand.mockImplementation(async () => {
        callCount++
        if (callCount === 2) throw new CriteriaFailedError('must include numbers', 3)
      })

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap,
      })

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

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })

      expect(results).toHaveLength(2)
      results.forEach(r => {
        expect(r.status).toBe('criteria-failed')
        expect(r.forkStore).not.toBeNull()
        expect(r.forkStore._nodes.parent.title).toBe('partial output')
      })
    })

    it('P0.5a: validate [✗ N attempts] suffix written to fork store survives CriteriaFailedError', async () => {
      const store = buildStore({
        root: {id: 'root', children: ['parent']},
        parent: {
          id: 'parent',
          parent: 'root',
          command: '/chat do task',
          children: ['elect'],
        },
        elect: {
          id: 'elect',
          parent: 'parent',
          command: '/elect :n=2 :fallback',
          children: ['validate'],
        },
        validate: {
          id: 'validate',
          parent: 'elect',
          command: '/validate criterion',
          children: [],
        },
      })
      const memoMap = new Map()

      mockRunCommand.mockImplementation(async ({store: forkStore}) => {
        // Simulate what runCommand's persistValidateSuffixes(false) writes before throwing
        forkStore._nodes.validate.title = '[✗ 3 attempts]'
        throw new CriteriaFailedError('criterion', 3)
      })

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })

      results.forEach(r => {
        expect(r.status).toBe('criteria-failed')
        expect(r.forkStore._nodes.validate.title).toBe('[✗ 3 attempts]')
      })
    })
  })

  describe('additive cost: sequential runForks calls do not compound fork counts', () => {
    it('running inner(n=3) then outer(n=2) produces 3+2=5 total runCommand calls', async () => {
      const store = buildStore({
        root: {id: 'root', children: ['innerParent', 'outerParent']},
        innerParent: {
          id: 'innerParent',
          parent: 'root',
          command: '/chat inner task',
          children: ['innerElect'],
        },
        innerElect: {
          id: 'innerElect',
          parent: 'innerParent',
          command: '/elect :n=3',
          children: [],
        },
        outerParent: {
          id: 'outerParent',
          parent: 'root',
          command: '/chat outer task',
          children: ['outerElect'],
        },
        outerElect: {
          id: 'outerElect',
          parent: 'outerParent',
          command: '/elect :n=2',
          children: [],
        },
      })

      const memoMap = new Map()

      await runForks({
        electNode: store.getNode('innerElect'),
        store,
        n: 3,
        memoMap,
      })
      await runForks({
        electNode: store.getNode('outerElect'),
        store,
        n: 2,
        memoMap,
      })

      expect(mockRunCommand).toHaveBeenCalledTimes(5)
    })

    it("outer forks receive memoMap with inner's id (preventing multiplicative re-execution)", async () => {
      const store = buildStore({
        root: {id: 'root', children: ['innerParent', 'outerParent']},
        innerParent: {
          id: 'innerParent',
          parent: 'root',
          command: '/chat inner task',
          children: ['innerElect'],
        },
        innerElect: {
          id: 'innerElect',
          parent: 'innerParent',
          command: '/elect :n=3',
          children: [],
        },
        outerParent: {
          id: 'outerParent',
          parent: 'root',
          command: '/chat outer task',
          children: ['outerElect'],
        },
        outerElect: {
          id: 'outerElect',
          parent: 'outerParent',
          command: '/elect :n=2',
          children: [],
        },
      })

      const memoMap = new Map()

      await runForks({
        electNode: store.getNode('innerElect'),
        store,
        n: 3,
        memoMap,
      })

      const outerMemoSnapshots = []
      mockRunCommand.mockImplementation(async ({memoMap: m}) => {
        outerMemoSnapshots.push(m.has('innerElect'))
      })

      await runForks({
        electNode: store.getNode('outerElect'),
        store,
        n: 2,
        memoMap,
      })

      expect(outerMemoSnapshots).toEqual([true, true])
    })
  })

  describe('parent command resolution', () => {
    it('falls back to parent title when command field is absent', async () => {
      const store = buildStore({
        root: {id: 'root', children: ['parent']},
        parent: {
          id: 'parent',
          parent: 'root',
          title: '/chat from title',
          children: ['elect'],
        },
        elect: {
          id: 'elect',
          parent: 'parent',
          command: '/elect :n=2',
          children: [],
        },
      })
      const memoMap = new Map()

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap,
      })

      expect(results).toHaveLength(2)
      expect(mockRunCommand).toHaveBeenCalledTimes(2)
    })
  })
})

describe('P0.5(c): early-termination — CriteriaFailedError stops fork execution immediately', () => {
  it('no post-error work is attempted after CriteriaFailedError is thrown', async () => {
    const store = minimalTree()
    const memoMap = new Map()
    let postErrorWorkAttempted = false

    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      forkStore._nodes.parent.title = 'partial-step-1'
      throw new CriteriaFailedError('must include numbers', 3)
      // eslint-disable-next-line no-unreachable
      postErrorWorkAttempted = true
    })

    const results = await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 1,
      memoMap,
    })

    expect(results[0].status).toBe('criteria-failed')
    expect(postErrorWorkAttempted).toBe(false)
  })

  it('sibling forks continue independently after one fork throws CriteriaFailedError', async () => {
    const store = minimalTree()
    const memoMap = new Map()
    const executedForks = []

    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      const forkIdx = executedForks.indexOf(forkStore)
      const idx = forkIdx === -1 ? executedForks.push(forkStore) - 1 : forkIdx
      if (idx === 1) throw new CriteriaFailedError('criterion', 3)
    })

    const results = await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap,
    })

    const failed = results.find(r => r.status === 'criteria-failed')
    const ok = results.filter(r => r.status === 'ok')
    expect(failed).toBeDefined()
    expect(ok).toHaveLength(2)
    // All 3 forks were attempted (Promise.allSettled runs all in parallel)
    expect(mockRunCommand).toHaveBeenCalledTimes(3)
  })
})

describe('onForkSettled callback', () => {
  it('is called once per fork as each settles', async () => {
    const store = minimalTree()
    const memoMap = new Map()
    const settled = []

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap,
      onForkSettled: result => settled.push(result),
    })

    expect(settled).toHaveLength(3)
  })

  it('receives the correct forkIndex for each call', async () => {
    const store = minimalTree()
    const memoMap = new Map()
    const indices = []

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap,
      onForkSettled: result => indices.push(result.forkIndex),
    })

    expect(indices.sort()).toEqual([0, 1, 2])
  })

  it('receives status ok for successful forks', async () => {
    const store = minimalTree()
    const memoMap = new Map()
    const statuses = []

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 2,
      memoMap,
      onForkSettled: result => statuses.push(result.status),
    })

    expect(statuses).toEqual(['ok', 'ok'])
  })

  it('receives status runtime-failed when runCommand throws', async () => {
    mockRunCommand.mockRejectedValueOnce(new Error('boom'))
    const store = minimalTree()
    const memoMap = new Map()
    const settled = []

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 2,
      memoMap,
      onForkSettled: result => settled.push(result),
    })

    const failed = settled.find(r => r.status === 'runtime-failed')
    expect(failed).toBeDefined()
    expect(failed.reason).toBe('boom')
  })

  it('receives status criteria-failed when runCommand throws CriteriaFailedError', async () => {
    mockRunCommand.mockRejectedValueOnce(new CriteriaFailedError('criterion text', 3))
    const store = minimalTree()
    const memoMap = new Map()
    const settled = []

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 2,
      memoMap,
      onForkSettled: result => settled.push(result),
    })

    const failed = settled.find(r => r.status === 'criteria-failed')
    expect(failed).toBeDefined()
    expect(failed.failedAt).toBe('criterion text')
  })

  it('is not required — defaults to null and behaves identically to no-callback call', async () => {
    const store = minimalTree()
    const memoMap = new Map()

    const results = await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 2,
      memoMap,
    })

    expect(results).toHaveLength(2)
    expect(results.every(r => r.status === 'ok')).toBe(true)
  })

  it('is called for all N forks regardless of individual success or failure', async () => {
    mockRunCommand.mockImplementationOnce(() => {
      throw new Error('fork 0 fails')
    })
    const store = minimalTree()
    const memoMap = new Map()
    const settled = []

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap,
      onForkSettled: result => settled.push(result.forkIndex),
    })

    expect(settled.sort()).toEqual([0, 1, 2])
  })

  it('criteria-failed result in callback includes attempts and failedAt', async () => {
    mockRunCommand.mockRejectedValueOnce(new CriteriaFailedError('must include numbers', 5))
    const store = minimalTree()
    const memoMap = new Map()
    const settled = []

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 2,
      memoMap,
      onForkSettled: result => settled.push(result),
    })

    const failed = settled.find(r => r.status === 'criteria-failed')
    expect(failed.failedAt).toBe('must include numbers')
    expect(failed.attempts).toBe(5)
  })

  it('runtime-failed result reason in callback is a string, not an Error object', async () => {
    mockRunCommand.mockRejectedValueOnce(new Error('network timeout'))
    const store = minimalTree()
    const memoMap = new Map()
    const settled = []

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 2,
      memoMap,
      onForkSettled: result => settled.push(result),
    })

    const failed = settled.find(r => r.status === 'runtime-failed')
    expect(typeof failed.reason).toBe('string')
    expect(failed.reason).toBe('network timeout')
  })

  it('a throwing callback does not prevent all fork results from being populated', async () => {
    const store = minimalTree()
    const memoMap = new Map()

    const results = await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap,
      onForkSettled: () => {
        throw new Error('callback threw')
      },
    })

    // The runForks contract: results array must be complete even if callback throws
    expect(results.filter(Boolean)).toHaveLength(3)
  })
})

describe('computeEffectiveN', () => {
  const buildStoreWithParent = (parentCommand, aliases = {mcp: [], rpc: []}) => {
    const store = buildStore({
      root: {id: 'root', children: ['parent']},
      parent: {
        id: 'parent',
        parent: 'root',
        command: parentCommand,
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=3',
        children: [],
      },
    })
    store._aliases = aliases
    return store
  }

  it('returns n for a non-side-effecting parent (chat)', () => {
    const store = buildStoreWithParent('/chat do something')
    expect(computeEffectiveN(store.getNode('elect'), store, 3)).toBe(3)
  })

  it('returns 1 for a side-effecting MCP-alias parent when n > 1', () => {
    const store = buildStoreWithParent('/tool mutate', {
      mcp: [{alias: '/tool'}],
      rpc: [],
    })
    expect(computeEffectiveN(store.getNode('elect'), store, 3)).toBe(1)
  })

  it('returns 1 for a side-effecting MCP-alias parent when n = 2 (minimum collapse threshold)', () => {
    const store = buildStoreWithParent('/tool mutate', {
      mcp: [{alias: '/tool'}],
      rpc: [],
    })
    expect(computeEffectiveN(store.getNode('elect'), store, 2)).toBe(1)
  })

  it('returns n unchanged when n = 1 even with a side-effecting parent — n=1 never needs collapse', () => {
    const store = buildStoreWithParent('/tool mutate', {
      mcp: [{alias: '/tool'}],
      rpc: [],
    })
    expect(computeEffectiveN(store.getNode('elect'), store, 1)).toBe(1)
  })

  it('returns n when parentNode is absent — no parent means no suppression signal', () => {
    const store = buildStore({
      elect: {id: 'elect', command: '/elect :n=3', children: []},
    })
    expect(computeEffectiveN(store.getNode('elect'), store, 5)).toBe(5)
  })

  it('returns 1 for a side-effecting RPC-alias parent when n > 1', () => {
    const store = buildStoreWithParent('/ssh run', {
      mcp: [],
      rpc: [{alias: '/ssh'}],
    })
    expect(computeEffectiveN(store.getNode('elect'), store, 4)).toBe(1)
  })

  it('returns 1 for an /mcp fusion parent when n > 1', () => {
    const store = buildStoreWithParent('/mcp some-op')
    expect(computeEffectiveN(store.getNode('elect'), store, 3)).toBe(1)
  })
})

describe('runForks — suppressed metadata propagates to failure shapes', () => {
  const buildSuppressedTree = (aliases = {mcp: [{alias: '/tool'}], rpc: []}) => {
    const store = buildStore({
      root: {id: 'root', children: ['parent']},
      parent: {
        id: 'parent',
        parent: 'root',
        command: '/tool run',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=3',
        children: [],
      },
    })
    store._aliases = aliases
    return store
  }

  it('criteria-failed result from a suppressed fork carries suppressed/cause/requestedN', async () => {
    const store = buildSuppressedTree()
    mockRunCommand.mockRejectedValue(new CriteriaFailedError('quality', [{content: 'x'}]))

    const results = await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap: new Map(),
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      status: 'criteria-failed',
      suppressed: true,
      cause: 'side-effecting-alias',
      requestedN: 3,
    })
  })

  it('runtime-failed result from a suppressed fork carries suppressed/cause/requestedN', async () => {
    const store = buildSuppressedTree()
    mockRunCommand.mockRejectedValue(new Error('network error'))

    const results = await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap: new Map(),
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      status: 'runtime-failed',
      suppressed: true,
      cause: 'side-effecting-alias',
      requestedN: 3,
    })
  })

  it('non-suppressed criteria-failed fork does NOT carry suppressed field', async () => {
    const store = minimalTree()
    mockRunCommand.mockRejectedValue(new CriteriaFailedError('quality', [{content: 'x'}]))

    const results = await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 2,
      memoMap: new Map(),
    })

    for (const r of results) {
      expect(r.suppressed).toBeUndefined()
      expect(r.requestedN).toBeUndefined()
    }
  })
})

describe('preExecuteSideEffectingElectChildren — pre-execution exclusion rules', () => {
  const mcpAlias = {
    alias: '/tool',
    serverUrl: 'http://mcp',
    transport: 'streamable-http',
    toolName: 'run',
  }

  it('post-processor child (/validate) is excluded from pre-execution even when side-effecting', async () => {
    // /validate is a post-processor; even hypothetically side-effecting, it must not run pre-fork
    const store = buildStore({
      root: {id: 'root', children: ['parent']},
      parent: {
        id: 'parent',
        parent: 'root',
        command: '/chat do',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=3',
        children: ['child'],
      },
      child: {
        id: 'child',
        parent: 'elect',
        command: '/validate quality',
        children: [],
      },
    })
    store._aliases = {mcp: [mcpAlias], rpc: []}

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap: new Map(),
    })

    // runCommand is called per fork (3 times for the parent chat) but NOT once pre-fork for /validate
    // The per-fork calls have queryType 'chat', not the child MCP queryType
    const preExecCalls = mockRunCommand.mock.calls.filter(([params]) => params.cell?.id === 'child')
    expect(preExecCalls).toHaveLength(0)
  })

  it('MCP-alias child whose subtree contains a nested /elect is excluded from pre-execution', async () => {
    // hasElectDescendant guard: running such a child pre-fork would double-execute the nested elect
    const store = buildStore({
      root: {id: 'root', children: ['parent']},
      parent: {
        id: 'parent',
        parent: 'root',
        command: '/chat do',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=3',
        children: ['mcpChild'],
      },
      mcpChild: {
        id: 'mcpChild',
        parent: 'elect',
        command: '/tool run',
        children: ['nestedElect'],
      },
      nestedElect: {
        id: 'nestedElect',
        parent: 'mcpChild',
        command: '/elect :n=2',
        children: [],
      },
    })
    store._aliases = {mcp: [mcpAlias], rpc: []}

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap: new Map(),
    })

    // mcpChild has a elect descendant: must NOT be pre-executed (would compound fork counts)
    const mcpChildCalls = mockRunCommand.mock.calls.filter(([params]) => params.cell?.id === 'mcpChild')
    expect(mcpChildCalls).toHaveLength(0)
  })

  it('child already in memoMap is skipped by pre-execution (idempotency guard)', async () => {
    const store = buildStore({
      root: {id: 'root', children: ['parent']},
      parent: {
        id: 'parent',
        parent: 'root',
        command: '/chat do',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=3',
        children: ['child'],
      },
      child: {
        id: 'child',
        parent: 'elect',
        command: '/tool run',
        children: [],
      },
    })
    store._aliases = {mcp: [mcpAlias], rpc: []}
    const memoMap = new Map([['child', 'already-set']])

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap,
    })

    // child is in memoMap already; pre-execution skips it
    const childCalls = mockRunCommand.mock.calls.filter(([params]) => params.cell?.id === 'child')
    expect(childCalls).toHaveLength(0)
  })
})

describe('runForks — pre-exec failure folds into results; never-throws contract', () => {
  const mcpAlias = {
    alias: '/tool',
    serverUrl: 'http://mcp',
    transport: 'streamable-http',
    toolName: 'run',
  }

  const buildPreExecTree = () => {
    const store = buildStore({
      root: {id: 'root', children: ['parent']},
      parent: {id: 'parent', parent: 'root', command: '/chat do', children: ['elect']},
      elect: {id: 'elect', parent: 'parent', command: '/elect :n=3', children: ['child']},
      child: {id: 'child', parent: 'elect', command: '/tool run', children: []},
    })
    store._aliases = {mcp: [mcpAlias], rpc: []}
    return store
  }

  it('does not reject when pre-exec child throws CriteriaFailedError — never-throws contract holds', async () => {
    mockRunCommand.mockImplementation(async ({cell}) => {
      if (cell?.id === 'child') throw new CriteriaFailedError('must-be-valid', 2)
    })
    const store = buildPreExecTree()
    await expect(runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})).resolves.toBeDefined()
  })

  it('returns exactly N results when pre-exec throws CriteriaFailedError — one result per requested fork', async () => {
    mockRunCommand.mockImplementation(async ({cell}) => {
      if (cell?.id === 'child') throw new CriteriaFailedError('must-be-valid', 2)
    })
    const store = buildPreExecTree()
    const results = await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})
    expect(results).toHaveLength(3)
  })

  it('each result carries status criteria-failed when pre-exec throws CriteriaFailedError', async () => {
    mockRunCommand.mockImplementation(async ({cell}) => {
      if (cell?.id === 'child') throw new CriteriaFailedError('must-be-valid', 2)
    })
    const store = buildPreExecTree()
    const results = await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})
    expect(results.every(r => r.status === 'criteria-failed')).toBe(true)
  })

  it('failedAt and attempts are taken from the CriteriaFailedError and present on every result', async () => {
    mockRunCommand.mockImplementation(async ({cell}) => {
      if (cell?.id === 'child') throw new CriteriaFailedError('must-be-valid', 2)
    })
    const store = buildPreExecTree()
    const results = await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})
    for (const r of results) {
      expect(r.failedAt).toBe('must-be-valid')
      expect(r.attempts).toBe(2)
    }
  })

  it('forkIndex is correct and unique across all N results', async () => {
    mockRunCommand.mockImplementation(async ({cell}) => {
      if (cell?.id === 'child') throw new CriteriaFailedError('criterion', 1)
    })
    const store = buildPreExecTree()
    const results = await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})
    const indices = results.map(r => r.forkIndex).sort((a, b) => a - b)
    expect(indices).toEqual([0, 1, 2])
  })

  it('forkStore is null on every result — no fork stores created when pre-exec fails', async () => {
    mockRunCommand.mockImplementation(async ({cell}) => {
      if (cell?.id === 'child') throw new CriteriaFailedError('criterion', 1)
    })
    const store = buildPreExecTree()
    const results = await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})
    expect(results.every(r => r.forkStore === null)).toBe(true)
  })

  it('onForkSettled is called once per result when pre-exec fails', async () => {
    mockRunCommand.mockImplementation(async ({cell}) => {
      if (cell?.id === 'child') throw new CriteriaFailedError('criterion', 1)
    })
    const store = buildPreExecTree()
    const settled = []
    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap: new Map(),
      onForkSettled: r => settled.push(r),
    })
    expect(settled).toHaveLength(3)
    expect(settled.every(r => r.status === 'criteria-failed')).toBe(true)
  })

  it('does not reject when pre-exec child throws a generic runtime error', async () => {
    mockRunCommand.mockImplementation(async ({cell}) => {
      if (cell?.id === 'child') throw new Error('network timeout')
    })
    const store = buildPreExecTree()
    await expect(runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})).resolves.toBeDefined()
  })

  it('returns N runtime-failed results when pre-exec throws a generic error', async () => {
    mockRunCommand.mockImplementation(async ({cell}) => {
      if (cell?.id === 'child') throw new Error('network timeout')
    })
    const store = buildPreExecTree()
    const results = await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})
    expect(results).toHaveLength(3)
    expect(results.every(r => r.status === 'runtime-failed')).toBe(true)
  })

  it('reason carries the error message on runtime-failed results', async () => {
    mockRunCommand.mockImplementation(async ({cell}) => {
      if (cell?.id === 'child') throw new Error('network timeout')
    })
    const store = buildPreExecTree()
    const results = await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})
    expect(results.every(r => r.reason === 'network timeout')).toBe(true)
  })

  it('fork-loop runCommand is NOT called after pre-exec failure — no wasted fork execution', async () => {
    let callCount = 0
    mockRunCommand.mockImplementation(async ({cell}) => {
      callCount++
      if (cell?.id === 'child') throw new CriteriaFailedError('criterion', 1)
    })
    const store = buildPreExecTree()
    await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})
    expect(callCount).toBe(1)
  })
})

describe('runForks — pre-exec shared-child result and per-fork dispatch', () => {
  const mcpAlias = {alias: '/tool', serverUrl: 'http://mcp', transport: 'streamable-http', toolName: 'run'}

  const buildPreExecWithChildTree = () => {
    const store = buildStore({
      root: {id: 'root', children: ['parent']},
      parent: {id: 'parent', parent: 'root', command: '/chat do', children: ['elect']},
      elect: {id: 'elect', parent: 'parent', command: '/elect :n=3', children: ['child']},
      child: {id: 'child', parent: 'elect', command: '/tool run', children: []},
    })
    store._aliases = {mcp: [mcpAlias], rpc: []}
    return store
  }

  it('each fork store contains the pre-executed side-effecting child output — positive per-store inspection', async () => {
    const store = buildPreExecWithChildTree()

    mockRunCommand.mockImplementation(async ({cell, store: executionStore}) => {
      if (cell.id === 'child') {
        executionStore._nodes['child_output'] = {id: 'child_output', title: 'tool result', parent: 'child'}
        executionStore._nodes['child'].title = 'executed'
      }
    })

    const results = await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})

    for (const result of results) {
      expect(result.forkStore._nodes['child_output']).toBeDefined()
      expect(result.forkStore._nodes['child_output'].title).toBe('tool result')
      expect(result.forkStore._nodes['child'].title).toBe('executed')
    }
  })

  it('non-side-effecting child dispatches once per fork — 3 executions for n=3', async () => {
    const store = buildStore({
      root: {id: 'root', children: ['parent']},
      parent: {id: 'parent', parent: 'root', command: '/chat do', children: ['elect']},
      elect: {id: 'elect', parent: 'parent', command: '/elect :n=3', children: ['child']},
      child: {id: 'child', parent: 'elect', command: '/chat explain', children: []},
    })
    store._aliases = {mcp: [], rpc: []}

    mockRunCommand.mockImplementation(async ({cell, store: forkStore, memoMap}) => {
      if (cell.id === 'parent') {
        const child = forkStore.getNode('child')
        if (child && !memoMap.has('child')) {
          await mockRunCommand({cell: child, store: forkStore, memoMap}, {})
        }
      }
    })

    await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})

    const childCalls = mockRunCommand.mock.calls.filter(([params]) => params.cell?.id === 'child')
    expect(childCalls).toHaveLength(3)
  })
})
