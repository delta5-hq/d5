import {ChatCommand} from '../ChatCommand'
import {SummarizeCommand} from '../SummarizeCommand'
import {MemorizeCommand} from '../MemorizeCommand'
import {OutlineCommand} from '../OutlineCommand'
import {runCommand} from './runCommand'
import Store from './Store'
import ProgressReporter from '../../ProgressReporter'

jest.useFakeTimers()
jest.mock('../../ProgressReporter', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      add: jest.fn(async label => label),
      remove: jest.fn(),
      dispose: jest.fn(),
      registerChild: jest.fn(),
    })),
  }
})

function buildNodes(nodeMap) {
  const store = new Store({userId: 'userId', nodes: nodeMap})
  return store
}

describe('runCommand - Post-process dispatch', () => {
  beforeEach(() => {
    jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({nodes: []})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  /*
   * Architectural invariants of postProcessNode that survive the legacy
   * /refine removal. Tests are anchored on /summarize, /memorize, /outline
   * (the surviving post-processors that all set flag=true and trigger the
   * same recursion / progress / sibling-independence machinery the legacy
   * /refine used to exercise).
   */
  describe('execution order', () => {
    it('runs post-process children by priority: summarize < memorize < outline', async () => {
      const executionOrder = []

      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt test',
        children: ['outline', 'memorize', 'summarize'],
        prompts: ['output1'],
      }
      const store = buildNodes({
        [root.id]: root,
        output1: {id: 'output1', parent: root.id, title: 'LLM response text'},
        summarize: {id: 'summarize', parent: root.id, command: '/summarize'},
        memorize: {id: 'memorize', parent: root.id, command: '/memorize'},
        outline: {id: 'outline', parent: root.id, command: '/outline --summarize'},
      })

      jest.spyOn(SummarizeCommand.prototype, 'run').mockImplementation(async () => {
        executionOrder.push('summarize')
      })
      jest.spyOn(MemorizeCommand.prototype, 'run').mockImplementation(async () => {
        executionOrder.push('memorize')
      })
      jest.spyOn(OutlineCommand.prototype, 'run').mockImplementation(async () => {
        executionOrder.push('outline')
        return true
      })

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(executionOrder).toEqual(['summarize', 'memorize', 'outline'])
    })

    it('sorts post-process children by priority using title field when command absent', async () => {
      const executionOrder = []

      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt test',
        children: ['outline', 'memorize', 'summarize'],
        prompts: ['output1'],
      }
      const store = buildNodes({
        [root.id]: root,
        output1: {id: 'output1', parent: root.id, title: 'LLM response'},
        summarize: {id: 'summarize', parent: root.id, title: '/summarize', command: undefined},
        memorize: {id: 'memorize', parent: root.id, title: '/memorize', command: undefined},
        outline: {id: 'outline', parent: root.id, title: '/outline --summarize', command: undefined},
      })

      jest.spyOn(SummarizeCommand.prototype, 'run').mockImplementation(async () => {
        executionOrder.push('summarize')
      })
      jest.spyOn(MemorizeCommand.prototype, 'run').mockImplementation(async () => {
        executionOrder.push('memorize')
      })
      jest.spyOn(OutlineCommand.prototype, 'run').mockImplementation(async () => {
        executionOrder.push('outline')
        return true
      })

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(executionOrder).toEqual(['summarize', 'memorize', 'outline'])
    })
  })

  describe('recursive post-processing', () => {
    it('processes children of a flag=true post-processor as sub-post-process commands', async () => {
      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt test',
        children: ['outerSummarize'],
        prompts: ['o1'],
      }
      const outerSummarize = {
        id: 'outerSummarize',
        parent: root.id,
        command: '/summarize',
        children: ['innerMemorize'],
      }
      const store = buildNodes({
        [root.id]: root,
        o1: {id: 'o1', parent: root.id, title: 'Text'},
        [outerSummarize.id]: outerSummarize,
        innerMemorize: {id: 'innerMemorize', parent: outerSummarize.id, command: '/memorize'},
      })

      jest.spyOn(SummarizeCommand.prototype, 'run').mockResolvedValue()
      const memorizeSpy = jest.spyOn(MemorizeCommand.prototype, 'run').mockResolvedValue()

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(memorizeSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('progress tracking', () => {
    it('reports SummarizeCommand.run to progress reporter', async () => {
      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt test',
        children: ['summarize'],
        prompts: ['o1'],
      }
      const store = buildNodes({
        [root.id]: root,
        o1: {id: 'o1', parent: root.id, title: 'Text'},
        summarize: {id: 'summarize', parent: root.id, command: '/summarize'},
      })
      jest.spyOn(SummarizeCommand.prototype, 'run').mockResolvedValue()

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      const postProcessReporter = ProgressReporter.mock.results.find(r =>
        r.value.add?.mock?.calls?.some(call => call[0] === 'SummarizeCommand.run'),
      )?.value

      expect(postProcessReporter).toBeDefined()
      expect(postProcessReporter.add).toHaveBeenCalledWith('SummarizeCommand.run')
      expect(postProcessReporter.remove).toHaveBeenCalled()
      expect(postProcessReporter.dispose).toHaveBeenCalled()
    })
  })

  describe('sibling independence', () => {
    it('executes multiple /summarize siblings of the same parent independently', async () => {
      const summarizeA = {id: 'summarizeA', parent: 'root', command: '/summarize first'}
      const summarizeB = {id: 'summarizeB', parent: 'root', command: '/summarize second'}
      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt test',
        children: ['summarizeA', 'summarizeB'],
        prompts: ['o1'],
      }
      const store = buildNodes({
        [root.id]: root,
        o1: {id: 'o1', parent: root.id, title: 'Original'},
        [summarizeA.id]: summarizeA,
        [summarizeB.id]: summarizeB,
      })

      const summarizeSpy = jest.spyOn(SummarizeCommand.prototype, 'run').mockResolvedValue()

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(summarizeSpy).toHaveBeenCalledTimes(2)
    })
  })

  /*
   * Legacy /refine (years-old transform) was removed in P0.1. The current
   * behaviour for any /refine cell is to emit a visible error node so users
   * discover the migration immediately. The new /refine :n=N best-of-N
   * mechanism arrives in P0.3-P0.11 and will replace this error path.
   */
  describe('legacy /refine — parse-time error (P0.1)', () => {
    it('emits a visible error node for any /refine cell', async () => {
      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt test',
        children: ['refine'],
        prompts: ['o1'],
      }
      const refineNode = {id: 'refine', parent: root.id, command: '/refine make concise'}
      const store = buildNodes({
        [root.id]: root,
        o1: {id: 'o1', parent: root.id, title: 'Text'},
        [refineNode.id]: refineNode,
      })

      const createErrorSpy = jest.spyOn(store.importer, 'createErrorNode')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(createErrorSpy).toHaveBeenCalledWith(expect.stringContaining('/refine requires :n=N'), refineNode.id)
      expect(refineNode.title).toMatch(/\[✗ invalid\]/)
    })

    it('does not recurse into /refine children (no flag=true)', async () => {
      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt test',
        children: ['refine'],
        prompts: ['o1'],
      }
      const refineNode = {
        id: 'refine',
        parent: root.id,
        command: '/refine x',
        children: ['nestedSummarize'],
      }
      const store = buildNodes({
        [root.id]: root,
        o1: {id: 'o1', parent: root.id, title: 'Text'},
        [refineNode.id]: refineNode,
        nestedSummarize: {id: 'nestedSummarize', parent: refineNode.id, command: '/summarize'},
      })

      const summarizeSpy = jest.spyOn(SummarizeCommand.prototype, 'run').mockResolvedValue()

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(summarizeSpy).not.toHaveBeenCalled()
    })
  })
})
