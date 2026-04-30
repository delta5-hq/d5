import {ChatCommand} from '../ChatCommand'
import {RefineCommand} from '../RefineCommand'
import {SummarizeCommand} from '../SummarizeCommand'
import {MemorizeCommand} from '../MemorizeCommand'
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

function buildRefineScenario({prompts, extraNodes = {}} = {}) {
  const root = {
    id: 'root',
    parent: 'root',
    command: '/chatgpt test',
    children: ['refine'],
    ...(prompts !== undefined ? {prompts} : {}),
  }
  const refineNode = {id: 'refine', parent: root.id, command: '/refine test'}

  return {
    root,
    refineNode,
    store: buildNodes({[root.id]: root, [refineNode.id]: refineNode, ...extraNodes}),
  }
}

describe('runCommand - Post-process dispatch', () => {
  beforeEach(() => {
    jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({nodes: []})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('execution order', () => {
    it('runs post-process children by priority: summarize < memorize < refine', async () => {
      const executionOrder = []

      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt test',
        children: ['refine', 'memorize', 'summarize'],
        prompts: ['output1'],
      }
      const store = buildNodes({
        [root.id]: root,
        output1: {id: 'output1', parent: root.id, title: 'LLM response text'},
        summarize: {id: 'summarize', parent: root.id, command: '/summarize'},
        memorize: {id: 'memorize', parent: root.id, command: '/memorize'},
        refine: {id: 'refine', parent: root.id, command: '/refine make it concise'},
      })

      jest.spyOn(SummarizeCommand.prototype, 'run').mockImplementation(async () => {
        executionOrder.push('summarize')
      })
      jest.spyOn(MemorizeCommand.prototype, 'run').mockImplementation(async () => {
        executionOrder.push('memorize')
      })
      jest.spyOn(RefineCommand.prototype, 'replyRefine').mockImplementation(async () => {
        executionOrder.push('refine')
        return 'refined'
      })

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(executionOrder).toEqual(['summarize', 'memorize', 'refine'])
    })

    it('sorts post-process children by priority using title field when command absent', async () => {
      const executionOrder = []

      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt test',
        children: ['refine', 'memorize', 'summarize'],
        prompts: ['output1'],
      }
      const store = buildNodes({
        [root.id]: root,
        output1: {id: 'output1', parent: root.id, title: 'LLM response'},
        summarize: {id: 'summarize', parent: root.id, title: '/summarize', command: undefined},
        memorize: {id: 'memorize', parent: root.id, title: '/memorize', command: undefined},
        refine: {id: 'refine', parent: root.id, title: '/refine concise', command: undefined},
      })

      jest.spyOn(SummarizeCommand.prototype, 'run').mockImplementation(async () => {
        executionOrder.push('summarize')
      })
      jest.spyOn(MemorizeCommand.prototype, 'run').mockImplementation(async () => {
        executionOrder.push('memorize')
      })
      jest.spyOn(RefineCommand.prototype, 'replyRefine').mockImplementation(async () => {
        executionOrder.push('refine')
        return 'refined'
      })

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(executionOrder).toEqual(['summarize', 'memorize', 'refine'])
    })
  })

  describe('parent output extraction', () => {
    it('passes single parent output title to replyRefine', async () => {
      const {root, refineNode, store} = buildRefineScenario({
        prompts: ['output1'],
        extraNodes: {output1: {id: 'output1', parent: 'root', title: 'Once upon a time'}},
      })
      const refineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('Refined')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(refineSpy).toHaveBeenCalledWith(refineNode, 'Once upon a time')
    })

    it('joins multiple parent output nodes with single newline', async () => {
      const {root, refineNode, store} = buildRefineScenario({
        prompts: ['o1', 'o2', 'o3'],
        extraNodes: {
          o1: {id: 'o1', parent: 'root', title: 'First'},
          o2: {id: 'o2', parent: 'root', title: 'Second'},
          o3: {id: 'o3', parent: 'root', title: 'Third'},
        },
      })
      const refineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('Combined')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(refineSpy).toHaveBeenCalledWith(refineNode, 'First\nSecond\nThird')
    })

    it.each([
      ['undefined', undefined],
      ['empty array', []],
    ])('passes empty string when parent prompts is %s', async (_label, prompts) => {
      const {root, refineNode, store} = buildRefineScenario({prompts})
      const refineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('Result')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(refineSpy).toHaveBeenCalledWith(refineNode, '')
    })

    it('excludes nodes not found in store from parent output', async () => {
      const {root, refineNode, store} = buildRefineScenario({
        prompts: ['exists', 'deleted'],
        extraNodes: {exists: {id: 'exists', parent: 'root', title: 'Content'}},
      })
      const refineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('Result')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(refineSpy).toHaveBeenCalledWith(refineNode, 'Content')
    })

    it('includes children from store._nodes in tree-serialized output', async () => {
      const {root, store} = buildRefineScenario({
        prompts: ['parent'],
        extraNodes: {
          parent: {id: 'parent', parent: 'root', title: 'Section', children: ['child']},
          child: {id: 'child', parent: 'parent', title: 'Sub-point', children: []},
        },
      })
      const refineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('Result')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      const received = refineSpy.mock.calls[0][1]
      expect(received).toContain('Section')
      expect(received).toContain('Sub-point')
    })

    it('dispatches /refine using title field when command field absent', async () => {
      const {root, refineNode, store} = buildRefineScenario({
        prompts: ['output1'],
        extraNodes: {output1: {id: 'output1', parent: 'root', title: 'Parent output'}},
      })
      refineNode.command = undefined
      refineNode.title = '/refine make concise'

      const refineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('refined')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(refineSpy).toHaveBeenCalledWith(expect.objectContaining({id: 'refine'}), 'Parent output')
    })

    it('prefers command over title when both fields are set', async () => {
      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt test',
        children: ['refine'],
        prompts: ['output1'],
      }
      const store = buildNodes({
        [root.id]: root,
        output1: {id: 'output1', parent: root.id, title: 'Parent output'},
        refine: {id: 'refine', parent: root.id, command: '/refine from command', title: '/summarize from title'},
      })

      const refineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('refined')
      const summarizeSpy = jest.spyOn(SummarizeCommand.prototype, 'run').mockResolvedValue()

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(refineSpy).toHaveBeenCalled()
      expect(summarizeSpy).not.toHaveBeenCalled()
    })

    it('ignores empty command field and uses title field', async () => {
      const {root, refineNode, store} = buildRefineScenario({
        prompts: ['output1'],
        extraNodes: {output1: {id: 'output1', parent: 'root', title: 'Parent output'}},
      })
      refineNode.command = ''
      refineNode.title = '/refine empty command field'

      const refineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('refined')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(refineSpy).toHaveBeenCalled()
    })

    it('skips dispatch when title is non-command text', async () => {
      const {root, refineNode, store} = buildRefineScenario({prompts: ['output1']})
      refineNode.command = undefined
      refineNode.title = 'regular text without slash command'

      const refineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(refineSpy).not.toHaveBeenCalled()
    })
  })

  describe('result handling', () => {
    it('creates nodes from replyRefine result via store.importer', async () => {
      const {root, refineNode, store} = buildRefineScenario({
        prompts: ['o1'],
        extraNodes: {o1: {id: 'o1', parent: 'root', title: 'Original'}},
      })
      jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('Improved text')
      const createNodesSpy = jest.spyOn(store.importer, 'createNodes')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(createNodesSpy).toHaveBeenCalledWith('Improved text', refineNode.id)
    })

    it.each([null, undefined])('does not create nodes when replyRefine returns %s', async falsyResult => {
      const {root, store} = buildRefineScenario({
        prompts: ['o1'],
        extraNodes: {o1: {id: 'o1', parent: 'root', title: 'Text'}},
      })
      jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue(falsyResult)
      const createNodesSpy = jest.spyOn(store.importer, 'createNodes')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(createNodesSpy).not.toHaveBeenCalled()
    })
  })

  describe('recursive post-processing', () => {
    it('processes children of /refine as sub-post-process commands', async () => {
      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt test',
        children: ['refine'],
        prompts: ['o1'],
      }
      const refineNode = {id: 'refine', parent: root.id, command: '/refine test', children: ['summarize']}
      const store = buildNodes({
        [root.id]: root,
        o1: {id: 'o1', parent: root.id, title: 'Text'},
        [refineNode.id]: refineNode,
        summarize: {id: 'summarize', parent: refineNode.id, command: '/summarize'},
      })

      jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('Refined')
      const summarizeSpy = jest.spyOn(SummarizeCommand.prototype, 'run').mockResolvedValue()

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(summarizeSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('progress tracking', () => {
    it('reports RefineCommand.replyRefine to progress reporter', async () => {
      const {root, store} = buildRefineScenario({
        prompts: ['o1'],
        extraNodes: {o1: {id: 'o1', parent: 'root', title: 'Text'}},
      })
      jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('Refined')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      const postProcessReporter = ProgressReporter.mock.results.find(r =>
        r.value.add?.mock?.calls?.some(call => call[0] === 'RefineCommand.replyRefine'),
      )?.value

      expect(postProcessReporter).toBeDefined()
      expect(postProcessReporter.add).toHaveBeenCalledWith('RefineCommand.replyRefine')
      expect(postProcessReporter.remove).toHaveBeenCalled()
      expect(postProcessReporter.dispose).toHaveBeenCalled()
    })
  })

  describe('sibling independence', () => {
    it('executes multiple /refine siblings against same parent output without chaining', async () => {
      const refineNode1 = {id: 'refine1', parent: 'root', command: '/refine first'}
      const refineNode2 = {id: 'refine2', parent: 'root', command: '/refine second'}
      const root = {
        id: 'root',
        parent: 'root',
        command: '/chatgpt test',
        children: ['refine1', 'refine2'],
        prompts: ['o1'],
      }
      const store = buildNodes({
        [root.id]: root,
        o1: {id: 'o1', parent: root.id, title: 'Original'},
        [refineNode1.id]: refineNode1,
        [refineNode2.id]: refineNode2,
      })

      const refineSpy = jest.spyOn(RefineCommand.prototype, 'replyRefine').mockResolvedValue('Refined')

      await runCommand({queryType: 'chat', cell: root, store, userId: 'userId'})

      expect(refineSpy).toHaveBeenCalledTimes(2)
      expect(refineSpy).toHaveBeenNthCalledWith(1, refineNode1, 'Original')
      expect(refineSpy).toHaveBeenNthCalledWith(2, refineNode2, 'Original')
    })
  })
})
