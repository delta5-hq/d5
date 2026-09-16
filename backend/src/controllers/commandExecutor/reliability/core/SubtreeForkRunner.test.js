import {runForks} from './SubtreeForkRunner'
import {ForkJudge} from './ForkJudge'
import {CriteriaFailedError} from './CriteriaFailedError'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../../commands/utils/runCommand', () => ({
  foreachValidateTemplateExclusions: jest.fn().mockReturnValue([]),
  postProcessExistingOutput: jest.fn(),
  runCommand: jest.fn(),
}))

jest.mock('../../commands/utils/langchain/getLLM', () => ({
  Model: {OpenAI: 'OpenAI'},
  getIntegrationSettings: jest.fn().mockResolvedValue({openai: {apiKey: 'test'}}),
  getLLM: jest.fn(),
}))

const {
  postProcessExistingOutput: mockPostProcessExistingOutput,
  runCommand: mockRunCommand,
} = require('../../commands/utils/runCommand')
const {getLLM, getIntegrationSettings} = require('../../commands/utils/langchain/getLLM')

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

const treeWithParentOutput = () =>
  buildStore({
    root: {id: 'root', children: ['parent']},
    parent: {
      id: 'parent',
      parent: 'root',
      command: '/chat name one animal',
      children: ['out0', 'elect'],
      prompts: ['out0'],
    },
    out0: {
      id: 'out0',
      parent: 'parent',
      title: 'Ox',
      children: [],
    },
    elect: {
      id: 'elect',
      parent: 'parent',
      command: '/elect :n=3',
      children: [],
    },
  })

function replaceParentOutput(forkStore, title) {
  const outputId = `out-${title}`
  const parent = forkStore._nodes.parent
  for (const promptId of parent.prompts ?? []) {
    delete forkStore._nodes[promptId]
  }
  forkStore._nodes[outputId] = {
    id: outputId,
    parent: 'parent',
    title,
    children: [],
  }
  parent.children = [...(parent.children ?? []).filter(id => !(parent.prompts ?? []).includes(id)), outputId]
  parent.prompts = [outputId]
}

beforeEach(() => {
  mockPostProcessExistingOutput.mockReset()
  mockPostProcessExistingOutput.mockResolvedValue(undefined)
  mockRunCommand.mockReset()
  mockRunCommand.mockResolvedValue(undefined)
  getLLM.mockReset()
  getLLM.mockReturnValue({
    llm: {invoke: jest.fn().mockResolvedValue({content: '2,3,1'})},
  })
  getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'test'}})
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

    it('calls runCommand exactly N times for n=3 — all fresh forks, no source candidate shortcut', async () => {
      const store = minimalTree()
      const memoMap = new Map()

      await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap,
      })

      expect(mockRunCommand).toHaveBeenCalledTimes(3)
      expect(mockPostProcessExistingOutput).not.toHaveBeenCalled()
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
      expect(mockPostProcessExistingOutput).not.toHaveBeenCalled()
    })

    it('all N fresh forks generate independent outputs and are judged together', async () => {
      const store = minimalTree()
      const generated = ['Ox', 'Cat', 'Dog']

      mockRunCommand.mockImplementation(async ({store: forkStore}) => {
        replaceParentOutput(forkStore, generated.shift())
      })

      const forkResults = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 3,
        memoMap: new Map(),
      })
      const verdict = await new ForkJudge('user1', null, store).selectWinner({
        forks: forkResults,
        validateNodes: [],
        parentNodeId: 'parent',
        fallback: false,
      })

      expect(mockRunCommand).toHaveBeenCalledTimes(3)
      expect(forkResults.map(r => r.leafOutputs[0]?.content)).toEqual(['Ox', 'Cat', 'Dog'])
      expect(verdict.allGateFiltered).toBe(false)
    })

    it('fork 0 criteria failure carries fork-local evidence intact', async () => {
      const store = treeWithParentOutput()
      const settled = []

      mockRunCommand.mockImplementationOnce(async ({store: forkStore}) => {
        forkStore._nodes['source-partial'] = {
          id: 'source-partial',
          parent: 'parent',
          title: 'source candidate partial output',
          children: [],
        }
        forkStore._nodes.parent.prompts = ['source-partial']
        throw new CriteriaFailedError('source criterion', 4)
      })

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap: new Map(),
        onForkSettled: result => settled.push(result),
      })

      const failed = results.find(r => r.status === 'criteria-failed')
      expect(failed).toMatchObject({
        status: 'criteria-failed',
        failedAt: 'source criterion',
        attempts: 4,
        leafOutputs: [
          {
            nodeId: 'source-partial',
            content: 'source candidate partial output',
          },
        ],
      })
      expect(failed.forkStore).toBeInstanceOf(Store)
      expect(settled.find(r => r.status === 'criteria-failed')).toBe(failed)
      expect(results.filter(r => r.status === 'ok')).toHaveLength(1)
    })

    it('fork 0 runtime failure does not expose a stale fork store', async () => {
      const store = treeWithParentOutput()

      mockRunCommand.mockRejectedValueOnce(new Error('source provider down'))

      const results = await runForks({
        electNode: store.getNode('elect'),
        store,
        n: 2,
        memoMap: new Map(),
      })

      const failed = results.find(r => r.status === 'runtime-failed')
      expect(failed).toMatchObject({
        status: 'runtime-failed',
        reason: 'source provider down',
        leafOutputs: [],
      })
      expect(failed.forkStore).toBeNull()
      expect(results.filter(r => r.status === 'ok')).toHaveLength(1)
    })

    describe('admitSourceCandidate — candidate 0 from existing parent output', () => {
      it('admits existing output as candidate 0 and runs exactly N-1 fresh forks for n=3', async () => {
        const store = treeWithParentOutput()

        await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 3,
          memoMap: new Map(),
          admitSourceCandidate: true,
        })

        expect(mockPostProcessExistingOutput).toHaveBeenCalledTimes(1)
        expect(mockRunCommand).toHaveBeenCalledTimes(2)
      })

      it('total result count is still N when admitSourceCandidate is true', async () => {
        const store = treeWithParentOutput()

        const results = await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 3,
          memoMap: new Map(),
          admitSourceCandidate: true,
        })

        expect(results).toHaveLength(3)
      })

      it('candidate 0 uses postProcessExistingOutput (not runCommand), forks 1..N-1 use runCommand', async () => {
        const store = treeWithParentOutput()
        const callOrder = []

        mockPostProcessExistingOutput.mockImplementation(async () => {
          callOrder.push('postProcess')
        })
        mockRunCommand.mockImplementation(async () => {
          callOrder.push('runCommand')
        })

        await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 2,
          memoMap: new Map(),
          admitSourceCandidate: true,
        })

        expect(callOrder).toContain('postProcess')
        expect(callOrder).toContain('runCommand')
        expect(callOrder.filter(e => e === 'postProcess')).toHaveLength(1)
        expect(callOrder.filter(e => e === 'runCommand')).toHaveLength(1)
      })

      it('without admitSourceCandidate runs all N forks fresh (no postProcess)', async () => {
        const store = treeWithParentOutput()

        await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 3,
          memoMap: new Map(),
        })

        expect(mockPostProcessExistingOutput).not.toHaveBeenCalled()
        expect(mockRunCommand).toHaveBeenCalledTimes(3)
      })

      it('does not admit candidate 0 when the parent has no materialized output', async () => {
        const store = minimalTree()

        await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 3,
          memoMap: new Map(),
          admitSourceCandidate: true,
        })

        expect(mockPostProcessExistingOutput).not.toHaveBeenCalled()
        expect(mockRunCommand).toHaveBeenCalledTimes(3)
      })

      it('nested elect (admitSourceCandidate=false) still forks full N fresh candidates', async () => {
        const store = minimalTree()

        await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 3,
          memoMap: new Map(),
          admitSourceCandidate: false,
        })

        expect(mockPostProcessExistingOutput).not.toHaveBeenCalled()
        expect(mockRunCommand).toHaveBeenCalledTimes(3)
      })

      it('admits candidate 0 when elect has non-elect, non-validate children (runner does not gate on per-fork elect children)', async () => {
        const store = buildStore({
          root: {id: 'root', children: ['parent']},
          parent: {
            id: 'parent',
            parent: 'root',
            command: '/chat name one animal',
            children: ['out0', 'elect'],
            prompts: ['out0'],
          },
          out0: {id: 'out0', parent: 'parent', title: 'Ox', children: []},
          elect: {
            id: 'elect',
            parent: 'parent',
            command: '/elect :n=2',
            children: ['refine'],
          },
          refine: {id: 'refine', parent: 'elect', command: '/refine :n=2', children: []},
        })

        await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 2,
          memoMap: new Map(),
          admitSourceCandidate: true,
        })

        expect(mockPostProcessExistingOutput).toHaveBeenCalledTimes(1)
        expect(mockRunCommand).toHaveBeenCalledTimes(1)
      })

      it('commodity parent does not admit merged output as candidate 0', async () => {
        const store = buildStore({
          root: {id: 'root', children: ['parent']},
          parent: {
            id: 'parent',
            parent: 'root',
            command: '/chat :n=5',
            children: ['out0', 'out1', 'elect'],
            prompts: ['out0', 'out1'],
          },
          out0: {
            id: 'out0',
            parent: 'parent',
            title: 'merged 0',
            children: [],
          },
          out1: {
            id: 'out1',
            parent: 'parent',
            title: 'merged 1',
            children: [],
          },
          elect: {
            id: 'elect',
            parent: 'parent',
            command: '/elect :n=3',
            children: [],
          },
        })

        await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 3,
          memoMap: new Map(),
          admitSourceCandidate: true,
        })

        expect(mockPostProcessExistingOutput).not.toHaveBeenCalled()
        expect(mockRunCommand).toHaveBeenCalledTimes(3)
      })

      it('candidate 0 receives the foreachValidateTemplateExclusions ids', async () => {
        const {foreachValidateTemplateExclusions} = require('../../commands/utils/runCommand')
        const exclusionIds = ['tmpl-a', 'tmpl-b']
        foreachValidateTemplateExclusions.mockReturnValueOnce(exclusionIds)

        const store = treeWithParentOutput()

        await runForks({
          electNode: store.getNode('elect'),
          store,
          n: 2,
          memoMap: new Map(),
          admitSourceCandidate: true,
        })

        const [callArgs] = mockPostProcessExistingOutput.mock.calls
        expect(callArgs[0].ids).toEqual(exclusionIds)
      })
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

    it('criteria-failed fork carries the juror reason from CriteriaFailedError beside failedAt', async () => {
      const store = minimalTree()
      let callCount = 0
      mockRunCommand.mockImplementation(async () => {
        callCount++
        if (callCount === 2) throw new CriteriaFailedError('the reply is non-empty', 1, 'juror said: content is empty')
      })

      const results = await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})

      const failed = results.find(r => r.forkIndex === 1)
      expect(failed.status).toBe('criteria-failed')
      expect(failed.failedAt).toBe('the reply is non-empty')
      expect(failed.reason).toBe('juror said: content is empty')
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

describe('runForks — inline form: synthetic term parent pre-mounted by resolveElectCell', () => {
  // resolveElectCell mounts the synthetic parent and re-parents the elect node before calling runForks.
  // These tests replicate that pre-mount so runForks sees the same store state it receives in production.
  const withSyntheticParent = (termCommand = '/chatgpt proposal', aliases = {mcp: [], rpc: []}) => {
    const store = buildStore({
      'elect:term': {id: 'elect:term', command: termCommand, parent: null, children: ['elect'], prompts: []},
      elect: {id: 'elect', parent: 'elect:term', command: `/elect :n=3 ${termCommand}`, children: []},
    })
    store._aliases = aliases
    return store
  }

  it('resolves successfully when parent is the pre-mounted synthetic term parent', async () => {
    const store = withSyntheticParent()
    await expect(runForks({electNode: store.getNode('elect'), store, n: 2, memoMap: new Map()})).resolves.not.toThrow()
  })

  it('dispatches exactly N runCommand calls for n=3', async () => {
    const store = withSyntheticParent()
    await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})
    expect(mockRunCommand).toHaveBeenCalledTimes(3)
  })

  it('each fork receives the inline term queryType, not the elect queryType', async () => {
    const store = withSyntheticParent()
    await runForks({electNode: store.getNode('elect'), store, n: 2, memoMap: new Map()})
    for (const [params] of mockRunCommand.mock.calls) {
      expect(params.queryType).toBe('chat')
    }
  })

  it('each fork cell is the synthetic term-parent (id = electId + ":term", command = inline term)', async () => {
    const store = withSyntheticParent()
    const cellsSeen = []
    mockRunCommand.mockImplementation(async ({cell}) => {
      cellsSeen.push({id: cell.id, command: cell.command})
    })

    await runForks({electNode: store.getNode('elect'), store, n: 2, memoMap: new Map()})

    expect(cellsSeen).toHaveLength(2)
    for (const cell of cellsSeen) {
      expect(cell.id).toBe('elect:term')
      expect(cell.command).toBe('/chatgpt proposal')
    }
  })

  it('elect node command in the outer store is not mutated by fork execution', async () => {
    const store = withSyntheticParent()
    await runForks({electNode: store.getNode('elect'), store, n: 2, memoMap: new Map()})
    expect(store.getNode('elect').command).toBe('/elect :n=3 /chatgpt proposal')
  })

  it('returns N results, one per fork, each with status ok on success', async () => {
    const store = withSyntheticParent()
    const results = await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap: new Map()})

    expect(results).toHaveLength(3)
    for (const r of results) {
      expect(r.status).toBe('ok')
      expect(typeof r.forkIndex).toBe('number')
    }
  })

  it('marks electNode.id as in-progress in memoMap before any fork executes', async () => {
    const store = withSyntheticParent()
    const memoMap = new Map()
    const states = []

    mockRunCommand.mockImplementation(async () => {
      states.push(memoMap.get('elect'))
    })

    await runForks({electNode: store.getNode('elect'), store, n: 2, memoMap})

    expect(states).toEqual(['in-progress', 'in-progress'])
  })

  it('synthetic term-parent has parent: null and survives removeOrphanedNodes in each fork', async () => {
    const store = withSyntheticParent()
    const observations = []
    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      const termParent = forkStore._nodes['elect:term']
      observations.push({
        termParentHasNullParent: termParent?.parent === null,
        termParentSurvivesCleanup: (forkStore.removeOrphanedNodes(), 'elect:term' in forkStore._nodes),
      })
    })

    await runForks({electNode: store.getNode('elect'), store, n: 2, memoMap: new Map()})

    expect(observations).toHaveLength(2)
    for (const o of observations) {
      expect(o.termParentHasNullParent).toBe(true)
      expect(o.termParentSurvivesCleanup).toBe(true)
    }
  })

  it('each fork store contains the synthetic term parent', async () => {
    const store = withSyntheticParent()
    const forkNodeKeys = []
    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      forkNodeKeys.push(Object.keys(forkStore._nodes))
    })

    await runForks({electNode: store.getNode('elect'), store, n: 2, memoMap: new Map()})

    expect(forkNodeKeys).toHaveLength(2)
    for (const keys of forkNodeKeys) {
      expect(keys).toContain('elect:term')
    }
  })

  it('elect parent\u2194children invariant holds in each fork so elect survives orphan cleanup', async () => {
    const store = withSyntheticParent()
    const observations = []
    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      const electInFork = forkStore._nodes.elect
      const termInFork = forkStore._nodes['elect:term']
      const parentBeforeCleanup = electInFork?.parent
      const termChildrenBeforeCleanup = termInFork?.children?.includes('elect')
      forkStore.removeOrphanedNodes()
      observations.push({
        electParent: parentBeforeCleanup,
        termListsElect: termChildrenBeforeCleanup,
        electSurvivesCleanup: 'elect' in forkStore._nodes,
      })
    })

    await runForks({electNode: store.getNode('elect'), store, n: 2, memoMap: new Map()})

    expect(observations).toHaveLength(2)
    for (const obs of observations) {
      expect(obs.electParent).toBe('elect:term')
      expect(obs.termListsElect).toBe(true)
      expect(obs.electSurvivesCleanup).toBe(true)
    }
  })

  describe('fork-local memoMap isolation — inline term path', () => {
    it('each fork receives a distinct memoMap instance (not the shared outer map)', async () => {
      const store = withSyntheticParent()
      const memoMap = new Map()
      const receivedMemoMaps = []

      mockRunCommand.mockImplementation(async ({memoMap: m}) => {
        receivedMemoMaps.push(m)
      })

      await runForks({electNode: store.getNode('elect'), store, n: 3, memoMap})

      expect(receivedMemoMaps).toHaveLength(3)
      receivedMemoMaps.forEach(m => expect(m).not.toBe(memoMap))
      expect(receivedMemoMaps[0]).not.toBe(receivedMemoMaps[1])
      expect(receivedMemoMaps[0]).not.toBe(receivedMemoMaps[2])
    })

    it('mutations to one fork memoMap do not propagate to another fork or to the outer memoMap', async () => {
      const store = withSyntheticParent()
      const memoMap = new Map()
      let callCount = 0

      mockRunCommand.mockImplementation(async ({memoMap: m}) => {
        callCount++
        m.set(`fork-${callCount}-key`, 'fork-local-value')
      })

      await runForks({electNode: store.getNode('elect'), store, n: 2, memoMap})

      expect(memoMap.has('fork-1-key')).toBe(false)
      expect(memoMap.has('fork-2-key')).toBe(false)
    })
  })
})

describe('onForkSettled callback — inline term path', () => {
  const withSyntheticParent = () => {
    const store = buildStore({
      'elect:term': {id: 'elect:term', command: '/chatgpt proposal', parent: null, children: ['elect'], prompts: []},
      elect: {id: 'elect', parent: 'elect:term', command: '/elect :n=3 /chatgpt proposal', children: []},
    })
    store._aliases = {mcp: [], rpc: []}
    return store
  }

  it('calls onForkSettled N times for each fork in the inline term path', async () => {
    const store = withSyntheticParent()
    const settled = []

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap: new Map(),
      onForkSettled: result => settled.push(result),
    })

    expect(settled).toHaveLength(3)
  })

  it('receives the correct forkIndex for each call in the inline term path', async () => {
    const store = withSyntheticParent()
    const indices = []

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 3,
      memoMap: new Map(),
      onForkSettled: result => indices.push(result.forkIndex),
    })

    expect(indices.sort()).toEqual([0, 1, 2])
  })

  it('receives status ok for successful inline forks', async () => {
    const store = withSyntheticParent()
    const statuses = []

    await runForks({
      electNode: store.getNode('elect'),
      store,
      n: 2,
      memoMap: new Map(),
      onForkSettled: result => statuses.push(result.status),
    })

    expect(statuses).toEqual(['ok', 'ok'])
  })
})

describe('runForks — equivalence: inline form and postfix form run the same command N times', () => {
  it('same call count, same queryType, same fork count for n=3', async () => {
    const postfixStore = buildStore({
      parent: {id: 'parent', command: '/chatgpt proposal', children: ['elect']},
      elect: {id: 'elect', parent: 'parent', command: '/elect :n=3', children: []},
    })
    postfixStore._aliases = {mcp: [], rpc: []}

    await runForks({electNode: postfixStore.getNode('elect'), store: postfixStore, n: 3, memoMap: new Map()})

    const postfixCallCount = mockRunCommand.mock.calls.length
    const postfixQueryTypes = mockRunCommand.mock.calls.map(([p]) => p.queryType)
    mockRunCommand.mockClear()

    const inlineStore = buildStore({
      'elect:term': {id: 'elect:term', command: '/chatgpt proposal', parent: null, children: ['elect'], prompts: []},
      elect: {id: 'elect', parent: 'elect:term', command: '/elect :n=3 /chatgpt proposal', children: []},
    })
    inlineStore._aliases = {mcp: [], rpc: []}

    const inlineResults = await runForks({
      electNode: inlineStore.getNode('elect'),
      store: inlineStore,
      n: 3,
      memoMap: new Map(),
    })

    const inlineCallCount = mockRunCommand.mock.calls.length
    const inlineQueryTypes = mockRunCommand.mock.calls.map(([p]) => p.queryType)

    expect(inlineCallCount).toBe(postfixCallCount)
    expect(inlineQueryTypes).toEqual(postfixQueryTypes)
    expect(inlineResults).toHaveLength(3)
    expect(inlineResults.every(r => r.status === 'ok')).toBe(true)
  })

  it('outer store elect command is unchanged after inline forks complete', async () => {
    const store = buildStore({
      'elect:term': {id: 'elect:term', command: '/chatgpt proposal', parent: null, children: ['elect'], prompts: []},
      elect: {id: 'elect', parent: 'elect:term', command: '/elect :n=2 /chatgpt proposal', children: []},
    })
    store._aliases = {mcp: [], rpc: []}

    await runForks({electNode: store.getNode('elect'), store, n: 2, memoMap: new Map()})

    expect(store.getNode('elect').command).toBe('/elect :n=2 /chatgpt proposal')
  })

  it('forkResults carry the synthetic parent id as their content-source, not electNode.id or electNode.parent', async () => {
    const store = buildStore({
      'elect:term': {id: 'elect:term', command: '/chatgpt proposal', parent: null, children: ['elect'], prompts: []},
      elect: {id: 'elect', parent: 'elect:term', command: '/elect :n=2 /chatgpt proposal', children: []},
    })
    store._aliases = {mcp: [], rpc: []}

    const results = await runForks({electNode: store.getNode('elect'), store, n: 2, memoMap: new Map()})

    for (const r of results) {
      expect(r.forkStore._nodes['elect:term']).toBeDefined()
      expect(r.forkStore._nodes['elect:term'].command).toBe('/chatgpt proposal')
    }
  })
})

describe('runForks — nested: inline and postfix forms under a content ancestor inherit the same context', () => {
  const buildNestedPostfixStore = () =>
    buildStore({
      ancestor: {
        id: 'ancestor',
        parent: null,
        command: '/chat context',
        title: 'context',
        children: ['term'],
        prompts: [],
      },
      term: {
        id: 'term',
        parent: 'ancestor',
        command: '/chatgpt proposal',
        title: '/chatgpt proposal',
        children: ['elect'],
        prompts: [],
      },
      elect: {id: 'elect', parent: 'term', command: '/elect :n=2', children: []},
    })

  const buildNestedInlineStore = () =>
    buildStore({
      ancestor: {
        id: 'ancestor',
        parent: null,
        command: '/chat context',
        title: 'context',
        children: ['elect:term'],
        prompts: [],
      },
      'elect:term': {
        id: 'elect:term',
        parent: 'ancestor',
        command: '/chatgpt proposal',
        title: '/chatgpt proposal',
        children: ['elect'],
        prompts: [],
      },
      elect: {id: 'elect', parent: 'elect:term', command: '/elect :n=2 /chatgpt proposal', children: []},
    })

  it('inline form dispatches N runCommand calls with the same term command as postfix', async () => {
    const postfixStore = buildNestedPostfixStore()
    await runForks({electNode: postfixStore.getNode('elect'), store: postfixStore, n: 2, memoMap: new Map()})
    const postfixCount = mockRunCommand.mock.calls.length
    const postfixCommands = mockRunCommand.mock.calls.map(([p]) => p.cell?.command ?? p.queryType)
    mockRunCommand.mockClear()

    const inlineStore = buildNestedInlineStore()
    await runForks({electNode: inlineStore.getNode('elect'), store: inlineStore, n: 2, memoMap: new Map()})
    const inlineCount = mockRunCommand.mock.calls.length
    const inlineCommands = mockRunCommand.mock.calls.map(([p]) => p.cell?.command ?? p.queryType)

    expect(inlineCount).toBe(postfixCount)
    expect(inlineCommands).toEqual(postfixCommands)
  })

  it('inline term-parent is rooted at the ancestor and survives removeOrphanedNodes in each fork', async () => {
    const store = buildNestedInlineStore()
    const observations = []

    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      const termNode = forkStore._nodes['elect:term']
      forkStore.removeOrphanedNodes()
      observations.push({
        termParentIsAncestor: termNode?.parent === 'ancestor',
        termSurvivesCleanup: 'elect:term' in forkStore._nodes,
      })
    })

    await runForks({electNode: store.getNode('elect'), store, n: 2, memoMap: new Map()})

    expect(observations).toHaveLength(2)
    for (const o of observations) {
      expect(o.termParentIsAncestor).toBe(true)
      expect(o.termSurvivesCleanup).toBe(true)
    }
  })
})
