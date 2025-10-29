import {ForeachCommand} from './ForeachCommand'
import {runCommand} from './utils/runCommand'
import Integration from '../../../models/Integration'
import {RefineDocumentsChain} from 'langchain/chains'
import {getLLM, Model} from './utils/langchain/getLLM'
import {REF_PREFIX} from '../constants'
import {translate} from './utils/translate'
import {createNodes} from './utils/createNodes'
import {ScholarCommand} from './ScholarCommand'
import {OutlineCommand} from './OutlineCommand'
import {WebCommand} from './WebCommand'
import {createDeepClone} from './utils/createDeepClone'
import {StepsCommand} from './StepsCommand'
import ProgressReporter from '../ProgressReporter'
import Store from './utils/Store'

jest.useFakeTimers()
jest.mock('./utils/langchain/getLLM', () => ({
  ...jest.requireActual('./utils/langchain/getLLM'),
  getLLM: jest.fn(),
}))

jest.mock('./StepsCommand')
jest.mock('./utils/runCommand')
jest.mock('./utils/translate')
jest.mock('./utils/createNodes')
jest.mock('./utils/createDeepClone')

jest.mock('../ProgressReporter', () => {
  class MockProgressReporter {
    title
    add = jest.fn(async label => label)
    remove = jest.fn()
    dispose = jest.fn()
    registerChild = jest.fn()

    constructor(opts, parent) {
      this.title = opts?.title
      if (parent) {
        parent.lastChild = this
      }
    }
  }

  return {
    __esModule: true,
    default: MockProgressReporter,
  }
})

const sourceRunCommand = jest.requireActual('./utils/runCommand').runCommand

describe('ForeachCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  let command

  beforeEach(() => {
    command = new ForeachCommand(userId, workflowId, mockStore)

    command.logError = jest.fn().mockImplementation(e => {
      throw e
    })
  })

  describe('getParentsTitles', () => {
    it('should return 3 titles', () => {
      const root = {id: 'root'}
      const parentNode3 = {id: 'p3', title: 'ParentNode3', parent: root.id}
      const parentNode2 = {id: 'p2', title: 'ParentNode2', parent: parentNode3.id}
      const parentNode1 = {id: 'p1', title: 'ParentNode1', parent: parentNode2.id}

      const node = {id: 'n', title: 'Node', parent: parentNode1.id}

      mockStore._nodes = {
        [root.id]: root,
        [parentNode3.id]: parentNode3,
        [parentNode2.id]: parentNode2,
        [parentNode1.id]: parentNode1,
        [node.id]: node,
      }

      const result = command.getParentsTitles(node)

      expect(result).toBe('ParentNode3, ParentNode2, ParentNode1')
    })

    it('should return 1 titles without commas', () => {
      const root = {id: 'root'}
      const parentNode3 = {id: 'p3', title: '\n\n\n\t    \n', parent: root.id}
      const parentNode2 = {id: 'p2', title: '          ', parent: parentNode3.id}
      const parentNode1 = {id: 'p1', title: 'ParentNode1', parent: parentNode2.id}

      const node = {id: 'n', title: 'Node', parent: parentNode1.id}

      mockStore._nodes = {
        [root.id]: root,
        [parentNode3.id]: parentNode3,
        [parentNode2.id]: parentNode2,
        [parentNode1.id]: parentNode1,
        [node.id]: node,
      }

      const result = command.getParentsTitles(node)

      expect(result).toBe('ParentNode1')
    })

    it('should skip rootNode', () => {
      const root = {id: 'root'}
      const parentNode2 = {id: 'p2', title: 'ParentNode2', parent: root.id}
      const parentNode1 = {id: 'p1', title: 'ParentNode1', parent: parentNode2.id}

      const node = {id: 'n', title: 'Node', parent: parentNode1.id}

      mockStore._nodes = {
        [root.id]: root,
        [parentNode2.id]: parentNode2,
        [parentNode1.id]: parentNode1,
        [node.id]: node,
      }

      const result = command.getParentsTitles(node)

      expect(result).toBe('ParentNode2, ParentNode1')
    })
  })

  describe('substituteParentsTitles', () => {
    it('should substitute parent titles correctly', () => {
      const root = {id: 'root'}
      const parent = {id: 'parent', title: 'Parent Node', parent: root.id, childNodes: ['node']}
      const node = {id: 'node', title: 'Node', parent: parent.id, children: ['child']}
      const child = {id: 'child', title: 'Child', parent: node.id}

      const title = 'Child @@parents'

      mockStore._nodes = {
        [root.id]: root,
        [parent.id]: parent,
        [node.id]: node,
        [child.id]: child,
      }

      const result = command.substituteParentsTitles(title, child, 2)
      expect(result).toEqual('Child Node, Parent Node')
    })

    it('should substitute parent titles and exclude /command', () => {
      const root = {id: 'root'}
      const parent = {id: 'parent', title: '/chatgpt Parent Node', parent: root.id, childNodes: ['node']}
      const node = {id: 'node', title: 'Node', parent: parent.id, children: ['child']}
      const child = {id: 'child', title: 'Child', parent: node.id}

      const title = 'Child @@parents'

      mockStore._nodes = {
        [root.id]: root,
        [parent.id]: parent,
        [node.id]: node,
        [child.id]: child,
      }

      const result = command.substituteParentsTitles(title, child, 2)
      expect(result).toEqual('Child Node')
    })

    it('should substitute only first parent title', () => {
      const root = {id: 'root'}
      const parent = {id: 'parent', title: 'Parent Node', parent: root.id, childNodes: ['node']}
      const node = {id: 'node', title: 'Node', parent: parent.id, children: ['child']}
      const child = {id: 'child', title: 'Child', parent: node.id}

      const title = 'Child @@parents'

      mockStore._nodes = {
        [root.id]: root,
        [parent.id]: parent,
        [node.id]: node,
        [child.id]: child,
      }

      const result = command.substituteParentsTitles(title, child, 1)
      expect(result).toEqual('Child Node')
    })

    it('should not substitute empty parent title', () => {
      const root = {id: 'root'}
      const parent = {id: 'parent', title: 'Parent Node', parent: root.id, childNodes: ['node']}
      const node = {id: 'node', parent: parent.id, children: ['child']}
      const child = {id: 'child', title: 'Child', parent: node.id}

      const title = 'Child @@parents'

      mockStore._nodes = {
        [root.id]: root,
        [parent.id]: parent,
        [node.id]: node,
        [child.id]: child,
      }

      const result = command.substituteParentsTitles(title, child, 2)
      expect(result).toEqual('Child Parent Node')
    })
  })

  describe('getPrompt', () => {
    it('should substitute node.title to command', () => {
      const node = {id: 'node', title: 'Title'}
      const str = '@@'

      mockStore._nodes = {
        [node.id]: node,
      }

      const result = command.getPrompt(node, str)

      expect(result).toBe(node.title)
    })

    it('should substitute node.title to command and save references in node.title', () => {
      const node = {id: 'node', title: '@@ref2 Title @@ref1'}
      const str = '@@'

      mockStore._nodes = {
        [node.id]: node,
      }

      const result = command.getPrompt(node, str)

      expect(result).toBe(node.title)
    })

    it('should substitute node.title to command and save references in command', () => {
      const node = {id: 'node', title: 'Title'}
      const str = '@@ref2 @@ @@ref1'

      mockStore._nodes = {
        [node.id]: node,
      }

      const result = command.getPrompt(node, str)

      expect(result).toBe('@@ref2 Title @@ref1')
    })

    it('should not substitute node.title to command without @@', () => {
      const node = {id: 'node', title: 'Title'}
      const str = '/command'

      mockStore._nodes = {
        [node.id]: node,
      }

      const result = command.getPrompt(node, str)

      expect(result).toBe(str)
    })

    it('should substitute parents titles to command with @@@', () => {
      const root = {id: 'Root'}
      const parentNode3 = {id: 'p3', title: 'ParentNode3', parent: root.id}
      const parentNode2 = {id: 'p2', title: 'ParentNode2', parent: parentNode3.id}
      const parentNode1 = {id: 'p1', title: 'ParentNode1', parent: parentNode2.id}
      const node = {id: 'n', title: 'Title', parent: parentNode1.id}
      const str = 'prompt @@@'

      mockStore._nodes = {
        [root.id]: root,
        [parentNode3.id]: parentNode3,
        [parentNode2.id]: parentNode2,
        [parentNode1.id]: parentNode1,
        [node.id]: node,
      }

      const result = command.getPrompt(node, str)

      expect(result).toBe('prompt ParentNode3, ParentNode2, ParentNode1, Title')
    })

    it('should ignore parents with command', () => {
      const root = {id: 'Root'}
      const parentNode3 = {id: 'p3', title: 'ParentNode3', parent: root.id}
      const parentNode2 = {id: 'p2', title: '/chatgpt command', parent: parentNode3.id}
      const parentNode1 = {id: 'p1', title: 'ParentNode1', parent: parentNode2.id}
      const node = {id: 'n', title: 'Title', parent: parentNode1.id}
      const str = 'prompt @@@'

      mockStore._nodes = {
        [root.id]: root,
        [parentNode3.id]: parentNode3,
        [parentNode2.id]: parentNode2,
        [parentNode1.id]: parentNode1,
        [node.id]: node,
      }

      const result = command.getPrompt(node, str)

      expect(result).toBe('prompt ParentNode3, ParentNode1, Title')
    })

    it('should substitute node.title to command', () => {
      const node = {id: 'node', title: 'Title'}
      const str = '@@'

      mockStore._nodes = {
        [node.id]: node,
      }

      const result = command.getPrompt(node, str)

      expect(result).toBe(node.title)
    })
  })

  describe('findLeafs', () => {
    afterAll(() => {
      command.params.usePrompts = false
    })

    it('should not substitute titles without @@', () => {
      const child1 = {id: 'c1', title: 'Child1'}
      const child2 = {id: 'c2', title: 'Child2'}

      const parentNode = {id: 'p1', title: 'Parent Node', children: [child1.id, child2.id]}

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
        [parentNode.id]: parentNode,
      }

      const str = 'Command'

      const result = command.findLeafs(parentNode, str)
      expect(result.length).toEqual(2)
      expect(result[0].node).toEqual(child1)
      expect(result[1].node).toEqual(child2)
      expect(result[0].promptString).toEqual(str)
      expect(result[1].promptString).toEqual(str)
    })

    it('should find leaf nodes and substitute titles correctly', () => {
      const child1 = {id: 'c1', title: 'Child1'}
      const child2 = {id: 'c2', title: 'Child2'}

      const parentNode = {id: 'p1', title: 'Parent Node', children: [child1.id, child2.id]}

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
        [parentNode.id]: parentNode,
      }

      const str = 'Command @@'

      const result = command.findLeafs(parentNode, str)
      expect(result.length).toEqual(2)
      expect(result[0].node).toEqual(child1)
      expect(result[1].node).toEqual(child2)
      expect(result[0].promptString).toEqual(`Command ${child1.title}`)
      expect(result[1].promptString).toEqual(`Command ${child2.title}`)
    })

    it('should find leaf nodes with children and substitute titles correctly', () => {
      const child1 = {id: 'c1', title: 'Child1'}

      const subChild1 = {id: 'sc1', title: 'SubChild1'}
      const subSubChild1 = {id: 'ssс1', title: 'SubSubChild1'}
      const subChild2 = {id: 'sс2', title: 'SubChild2', children: [subSubChild1.id]}
      const child2 = {id: 'c2', title: 'Child2', children: [subChild1.id, subChild2.id]}

      const parentNode = {id: 'p', title: 'Parent Node', children: [child1.id, child2.id]}

      mockStore._nodes = {
        [subChild1.id]: subChild1,
        [subChild2.id]: subChild2,
        [subSubChild1.id]: subSubChild1,
        [child1.id]: child1,
        [child2.id]: child2,
        [parentNode.id]: parentNode,
      }

      const result = command.findLeafs(parentNode, 'Command @@')

      expect(result.length).toEqual(3)
      expect(result[0].node).toEqual(child1)
      expect(result[1].node).toEqual(subChild1)
      expect(result[2].node).toEqual(subSubChild1)
      expect(result[0].promptString).toEqual(`Command ${child1.title}`)
      expect(result[1].promptString).toEqual(`Command ${subChild1.title}`)
      expect(result[2].promptString).toEqual(`Command ${subSubChild1.title}`)
    })

    it('should skip node with /foreach in title', () => {
      const child1 = {id: 'c1', title: 'Child1'}
      const child2 = {id: 'c2', title: '/foreach Child2'}

      const parentNode = {id: 'parent', title: 'Parent Node', children: [child1.id, child2.id]}

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
        [parentNode.id]: parentNode,
      }

      const result = command.findLeafs(parentNode, 'Command @@')

      expect(result.length).toEqual(1)
      expect(result[0].node).toEqual(child1)
      expect(result[0].promptString).toEqual(`Command ${child1.title}`)
    })

    it('should skip node with /foreach in command property', () => {
      const child1 = {id: 'c1', title: 'Child1'}
      const child2 = {id: 'c2', title: 'Child2', command: '/foreach Child2'}

      const parentNode = {id: 'parent', title: 'Parent Node', children: [child1.id, child2.id]}

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
        [parentNode.id]: parentNode,
      }

      const result = command.findLeafs(parentNode, 'Command @@')

      expect(result.length).toEqual(1)
      expect(result[0].node).toEqual(child1)
      expect(result[0].promptString).toEqual(`Command ${child1.title}`)
    })

    it('should substitute parent titles with @@parents param', () => {
      const subSubChild1 = {id: 'ssc1', title: 'SubSubChild1', parent: 'sc1'}
      const subChild1 = {id: 'sc1', title: 'SubChild2', parent: 'c1', children: [subSubChild1.id]}
      const child1 = {id: 'c1', title: 'Child1', parent: 'p1', children: [subChild1.id]}

      const parentNode = {id: 'p1', title: 'Parent Node', parent: 'root', children: [child1.id]}

      mockStore._nodes = {
        [subChild1.id]: subChild1,
        [subSubChild1.id]: subSubChild1,
        [child1.id]: child1,
        [parentNode.id]: parentNode,
      }

      const result = command.findLeafs(parentNode, 'Command @@ with context of @@parents')

      expect(result.length).toEqual(1)
      expect(result[0].node).toEqual(subSubChild1)
      expect(result[0].promptString).toEqual(
        `Command ${subSubChild1.title} with context of ${subChild1.title}, ${child1.title}, ${parentNode.title} --parents=0`,
      )
    })

    it('should skip nodes if usePrompts is true', () => {
      const child1 = {id: 'c1', title: 'Child1'}
      const child2 = {id: 'c2', title: 'Child2'}

      const parentNode = {
        id: 'p',
        title: 'Parent Node',
        children: [child1.id, child2.id],
      }

      command.params.usePrompts = true

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
      }

      const result = command.findLeafs(parentNode, 'Command @@')
      expect(result.length).toEqual(0)
    })

    it('should use only nodes that was created from prompt', () => {
      const child1 = {id: 'c1', title: 'Child1'}
      const child2 = {id: 'c2', title: 'Child2'}

      const parentNode = {
        id: 'p',
        title: '/chatgpt Parent Node',
        children: [child1.id, child2.id],
        prompts: [child1.id, child2.id],
      }

      command.params.usePrompts = true

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
      }

      const result = command.findLeafs(parentNode, 'Command @@')
      expect(result.length).toEqual(2)
      expect(result[0].node).toEqual(child1)
      expect(result[1].node).toEqual(child2)
      expect(result[0].promptString).toEqual(`Command ${child1.title}`)
      expect(result[1].promptString).toEqual(`Command ${child2.title}`)
    })

    it('should use only nodes with files', () => {
      const child1 = {id: 'c1', file: 'id', title: 'Child1'}
      const child2 = {id: 'c2', title: 'Child2', children: []}

      const parentNode = {
        id: 'p',
        title: '/chatgpt Parent Node',
        children: [child1.id, child2.id],
        prompts: [child1.id, child2.id],
      }

      command.params.usePrompts = false

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
      }

      const result = command.findLeafs(parentNode, 'Command @@', true)

      expect(result.length).toEqual(1)
      expect(result[0].node).toEqual(child1)
      expect(result[0].promptString).toEqual(`Command ${child1.title}`)
    })
  })

  describe('run', () => {
    afterEach(() => {
      runCommand.mockImplementation(() => jest.fn())
      jest.clearAllMocks()
    })

    it('should use yandex credentials', async () => {
      // Setup:
      //
      // parentNode
      //   /foreach /summarize prompt @@ --lang=ru (child3)
      //   Child1
      //
      // Result: Uses Yandex model for translation with Russian language

      jest.clearAllMocks()
      runCommand.mockImplementation(sourceRunCommand)

      const settings = {
        openai: {apiKey: 'apiKey', model: 'model'},
        yandex: {apiKey: 'apiKey', folder_id: 'folder_id', model: 'model'},
      }

      jest.spyOn(Integration, 'findOne').mockReturnValue({
        lean: jest.fn().mockReturnValue(settings),
      })

      jest.spyOn(RefineDocumentsChain.prototype, 'call').mockReturnValue({
        output_text: 'translated response',
      })

      getLLM.mockImplementation(() => ({llm: {}, chunkSize: 2000}))
      translate.mockReturnValue('response')
      createNodes.mockReturnValue([])

      const child1 = {id: 'c1', title: 'Child1', parent: 'p'}
      const foreachNode = {
        id: 'c3',
        command: '/foreach /summarize prompt @@ --lang=ru',
        parent: 'p',
      }
      const parentNode = {
        id: 'p',
        parent: 'root',
        title: 'ParentNode',
        children: [child1.id, foreachNode.id],
      }

      mockStore._nodes = {
        [child1.id]: child1,
        [foreachNode.id]: foreachNode,
        [parentNode.id]: parentNode,
      }

      await command.run(foreachNode)

      expect(getLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          settings,
          type: Model.YandexGPT,
        }),
      )
    })

    it('should use openai credentials', async () => {
      // Setup:
      //
      // parentNode
      //   /foreach /summarize prompt @@ (child3)
      //   Child1
      //
      // Result: Uses OpenAI model for default operations

      jest.clearAllMocks()
      runCommand.mockImplementation(sourceRunCommand)

      const settings = {
        openai: {apiKey: 'apiKey', model: 'model'},
        yandex: {apiKey: 'apiKey', folder_id: 'folder_id', model: 'model'},
      }

      jest.spyOn(Integration, 'findOne').mockReturnValue({
        lean: jest.fn().mockReturnValue(settings),
      })

      jest.spyOn(RefineDocumentsChain.prototype, 'call').mockReturnValue({
        output_text: 'response',
      })

      getLLM.mockImplementation(() => ({llm: {}, chunkSize: 2000}))
      translate.mockReturnValue('response')
      createNodes.mockReturnValue([])

      const child1 = {id: 'c1', title: 'Child1', parent: 'p'}
      const foreachNode = {
        id: 'c3',
        command: '/foreach /summarize prompt @@',
        parent: 'p',
      }
      const parentNode = {
        id: 'p',
        parent: 'root',
        title: 'ParentNode',
        children: [child1.id, foreachNode.id],
      }

      mockStore._nodes = {
        [child1.id]: child1,
        [foreachNode.id]: foreachNode,
        [parentNode.id]: parentNode,
      }

      await command.run(foreachNode)

      expect(getLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          settings,
          type: Model.OpenAI,
        }),
      )
    })

    it('should use correct prompt and not cut it with scholar', async () => {
      const child1 = {
        id: 'c1',
        title: 'c1',
        command: '/foreach /scholar some prompt @@ --lang=ru --citation',
        parent: 'p',
      }
      const child2 = {id: 'c2', title: 'yandexgpt response on your question', parent: 'p'}
      const parent = {
        id: 'p',
        title: 'prompt',
        command: '/yandexgpt prompt',
        children: [child1.id, child2.id],
        prompts: [child2.id],
        parent: 'id',
      }

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
        [parent.id]: parent,
      }

      runCommand.mockImplementation(sourceRunCommand)
      const scholarSpy = jest.spyOn(ScholarCommand.prototype, 'createResponseScholar').mockReturnValue('response')

      await command.run(child1)

      expect(scholarSpy).toHaveBeenCalledWith(
        expect.anything(),
        'some prompt yandexgpt response on your question',
        expect.anything(),
      )
    })

    it('should use correct prompt and not cut it with scholar', async () => {
      const child1 = {
        id: 'c1',
        title: 'c1',
        command: '/foreach /scholar some prompt @@ --lang=ru --citation',
        parent: 'p',
      }
      const child2 = {id: 'c2', title: 'yandexgpt response on your question', parent: 'p'}
      const parent = {
        id: 'p',
        title: 'prompt',
        command: '/yandexgpt prompt',
        children: [child1.id, child2.id],
        prompts: [child2.id],
        parent: 'id',
      }

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
        [parent.id]: parent,
      }

      runCommand.mockImplementation(sourceRunCommand)
      const scholarSpy = jest.spyOn(ScholarCommand.prototype, 'createResponseScholar').mockReturnValue('response')

      await command.run(child1)

      expect(scholarSpy).toHaveBeenCalledWith(
        expect.anything(),
        'some prompt yandexgpt response on your question',
        expect.anything(),
      )
    })

    it('should use correct prompt and not cut it with outline', async () => {
      const child1 = {
        id: 'c1',
        title: 'c1',
        command: '/foreach /outline some prompt @@ --lang=ru --citation',
        parent: 'p',
      }
      const child2 = {id: 'c2', title: 'yandexgpt response on your question', parent: 'p'}
      const parent = {
        id: 'p',
        title: 'prompt',
        command: '/yandexgpt prompt',
        children: [child1.id, child2.id],
        prompts: [child2.id],
        parent: 'id',
      }

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
        [parent.id]: parent,
      }

      runCommand.mockImplementation(sourceRunCommand)
      const outlineSpy = jest.spyOn(OutlineCommand.prototype, 'createResponseOutline').mockReturnValue('response')

      await command.run(child1)

      expect(outlineSpy).toHaveBeenCalledWith(
        expect.anything(),
        'some prompt yandexgpt response on your question',
        expect.anything(),
      )
    })

    it('should use correct prompt and not cut it with web', async () => {
      const child1 = {id: 'c1', title: 'c1', command: '/foreach /web some prompt @@ --lang=ru --citation', parent: 'p'}
      const child2 = {id: 'c2', title: 'yandexgpt response on your question', parent: 'p'}
      const parent = {
        id: 'p',
        title: 'prompt',
        command: '/yandexgpt prompt',
        children: [child1.id, child2.id],
        prompts: [child2.id],
        parent: 'id',
      }

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
        [parent.id]: parent,
      }

      runCommand.mockImplementation(sourceRunCommand)
      const webSpy = jest.spyOn(WebCommand.prototype, 'createResponseWeb').mockReturnValue('response')

      await command.run(child1)

      expect(webSpy).toHaveBeenCalledWith(
        expect.anything(),
        'some prompt yandexgpt response on your question',
        expect.anything(),
      )
    })

    it('should execute prompts', async () => {
      const child1 = {id: 'c1', title: 'Child1'}
      const child2 = {id: 'c2', title: 'Child2'}
      const child3 = {id: 'c3', command: '/foreach /chatgpt prompt', parent: 'p'}
      const parentNode = {id: 'p', parent: 'root', title: 'ParentNode', children: [child1.id, child2.id, child3.id]}

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
        [child3.id]: child3,
        [parentNode.id]: parentNode,
      }

      runCommand
        .mockResolvedValueOnce({nodes: [{id: 'node1', command: '/chatgpt prompt'}]})
        .mockResolvedValueOnce({nodes: [{id: 'node2', command: '/chatgpt prompt'}]})

      await command.run(child3)

      const callArgs1 = runCommand.mock.calls[0][0]
      expect(callArgs1).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'c1',
            command: '/chatgpt prompt',
          }),
        }),
      )

      const callArgs2 = runCommand.mock.calls[1][0]
      expect(callArgs2).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'c2',
            command: '/chatgpt prompt',
          }),
        }),
      )
    })

    it('should execute prompts when @@ specified', async () => {
      const child1 = {id: 'c1', title: 'Child1'}
      const child2 = {id: 'c2', title: 'Child2'}
      const child3 = {id: 'c3', command: '/foreach /chatgpt prompt @@', parent: 'p'}
      const parentNode = {id: 'p', parent: 'root', title: 'ParentNode', children: [child1.id, child2.id, child3.id]}

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
        [child3.id]: child3,
        [parentNode.id]: parentNode,
      }

      await command.run(child3)

      const result = mockStore.getOutput()

      // Assert that runCommand was called with exact command strings
      const callArgs1 = runCommand.mock.calls[0][0]
      expect(callArgs1).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'c1',
            command: '/chatgpt prompt Child1',
          }),
        }),
      )

      const callArgs2 = runCommand.mock.calls[1][0]
      expect(callArgs2).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'c2',
            command: '/chatgpt prompt Child2',
          }),
        }),
      )

      // Verify the result contains exactly the nodes returned from runCommand
      expect(result).toEqual({
        edges: expect.anything(),
        nodes: [
          {id: 'c1', command: '/chatgpt prompt Child1', title: 'Child1'},
          {id: 'c2', command: '/chatgpt prompt Child2', title: 'Child2'},
        ],
      })
    })

    it('should execute prompts sequentially', async () => {
      const child1 = {id: 'c1', title: 'Child1'}
      const child3 = {id: 'c3', command: '/foreach /chatgpt "@@" --parallel=no', parent: 'p'}
      const parentNode = {id: 'p', parent: 'root', title: 'ParentNode', children: [child1.id, child3.id]}

      mockStore._nodes = {
        [child1.id]: child1,
        [child3.id]: child3,
        [parentNode.id]: parentNode,
      }

      await command.run(child3)
      const result = mockStore.getOutput()

      const callArgs = runCommand.mock.calls[0][0]
      expect(callArgs).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'c1',
            command: '/chatgpt "Child1" --parallel=no',
          }),
        }),
        expect.anything(),
      )

      // Verify the result contains exactly the node returned from runCommand
      expect(result).toEqual({
        edges: [],
        nodes: [{id: 'c1', title: 'Child1', command: '/chatgpt "Child1" --parallel=no'}],
      })
    })

    it('should execute prompts sequentially №2', async () => {
      const subChild = {id: 'sc', title: 'SubChild', parent: 'c'}
      const child = {id: 'c', title: 'Child', parent: 'p', children: [subChild.id]}
      const child3 = {id: 'c3', command: '/foreach /chatgpt "@@@" --parallel=no', parent: 'p'}
      const parentNode = {id: 'p', parent: 'root', title: 'ParentNode', children: [child.id, child3.id]}

      mockStore._nodes = {
        [child.id]: child,
        [subChild.id]: subChild,
        [child3.id]: child3,
        [parentNode.id]: parentNode,
      }

      await command.run(child3)
      const result = mockStore.getOutput()

      const callArgs = runCommand.mock.calls[0][0]
      expect(callArgs).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'sc',
            command: '/chatgpt "ParentNode, Child, SubChild" --parallel=no',
          }),
        }),
        expect.anything(),
      )

      // Verify the result contains exactly the node returned from runCommand
      expect(result).toEqual({
        edges: [],
        nodes: [
          {id: 'sc', title: 'SubChild', parent: 'c', command: '/chatgpt "ParentNode, Child, SubChild" --parallel=no'},
        ],
      })
    })

    it('should execute prompts in parallel', async () => {
      const child1 = {id: 'c1', title: 'Child1'}
      const child3 = {id: 'c3', command: '/foreach /chatgpt prompt @@ --parallel=yes', parent: 'p'}
      const parentNode = {id: 'p', parent: 'root', title: 'ParentNode', children: [child1.id, child3.id]}

      mockStore._nodes = {
        [child1.id]: child1,
        [child3.id]: child3,
        [parentNode.id]: parentNode,
      }

      await command.run(child3)
      const result = mockStore.getOutput()

      const callArgs = runCommand.mock.calls[0][0]
      expect(callArgs).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'c1',
            command: '/chatgpt prompt Child1 --parallel=yes',
          }),
        }),
      )

      // Verify the result contains exactly the node returned from runCommand
      expect(result).toEqual({
        edges: [],
        nodes: [{id: 'c1', title: 'Child1', command: '/chatgpt prompt Child1 --parallel=yes'}],
      })
    })

    it('should execute foreach with steps', async () => {
      // Setup:
      //
      // root
      //   /foreach /steps
      //     /chatgpt child1 @@
      //     #1 /chatgpt child2 @@
      //   node1
      //   node2
      //
      // Result:
      //
      // root
      //   /foreach /steps
      //     /chatgpt child1 @@
      //     #1 /chatgpt child2 @@
      //   /steps node1
      //     /chatgpt child1 node1
      //     #1 /chatgpt child2 node1
      //   /steps node2
      //     /chatgpt child1 node2
      //     #1 /chatgpt child2 node2

      jest.clearAllMocks()

      const foreachChild1 = {id: 'c1', title: '/chatgpt child1 @@'}
      const foreachChild2 = {id: 'c2', title: '#1 /chatgpt child2 @@'}
      const foreachNode = {
        id: 'foreach',
        command: '/foreach /steps',
        children: [foreachChild1.id, foreachChild2.id],
        parent: 'root',
      }

      const node1 = {id: 'n1', title: 'node1', parent: 'root'}
      const node2 = {id: 'n2', title: 'node2', parent: 'root'}
      const root = {
        id: 'root',
        children: [foreachNode.id, node1.id, node2.id],
      }

      mockStore._nodes = {
        [foreachChild1.id]: foreachChild1,
        [foreachChild2.id]: foreachChild2,
        [foreachNode.id]: foreachNode,
        [node1.id]: node1,
        [node2.id]: node2,
        [root.id]: root,
      }

      const stepsCommandInstance = {
        findMatchingNodes: jest.fn().mockReturnValue({
          nodesByOrder: {1: [{node: foreachChild2, promptString: '#1 /chatgpt child2 @@'}]},
          nodesWithoutOrder: [{node: foreachChild1, promptString: '/chatgpt child1 @@'}],
        }),
      }
      jest.spyOn(require('./StepsCommand'), 'StepsCommand').mockImplementation(() => stepsCommandInstance)

      await command.run(foreachNode)
      const {nodes: result} = mockStore.getOutput()

      const callArgs1 = runCommand.mock.calls[0][0]
      expect(callArgs1).toEqual(
        expect.objectContaining({
          queryType: 'steps',
          cell: expect.objectContaining({
            id: 'n1',
            title: 'node1',
            command: '/steps node1',
          }),
        }),
      )

      const callArgs2 = runCommand.mock.calls[1][0]
      expect(callArgs2).toEqual(
        expect.objectContaining({
          queryType: 'steps',
          cell: expect.objectContaining({
            id: 'n2',
            title: 'node2',
            command: '/steps node2',
          }),
        }),
      )

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({command: '/chatgpt child1 node1'}),
          expect.objectContaining({command: '#1 /chatgpt child2 node1'}),
          expect.objectContaining({command: '/chatgpt child1 node2'}),
          expect.objectContaining({command: '#1 /chatgpt child2 node2'}),
        ]),
      )
    })

    it('should execute nested foreach with steps and references', async () => {
      // Setup:
      //
      // root
      //   @namereq use only russian names
      //   @greetingreq use only russian greeting
      //   /steps
      //     Dog story
      //       /chatgpt give me a list of 2 dog names (@@namereq)
      //         /foreach /steps
      //           #0 /chatgpt say hello to @@ (@@greetingreq)
      //           #2 /chatgpt say "you're a good dog" to @@
      //         1. Boris
      //         2. Misha
      //     /chatgpt give me a list of 2 cat names (@@namereq)
      //       /foreach /steps
      //         #0 /chatgpt say hello to @@ (@@greetingreq)
      //         #2 /chatgpt say "you're a good cat" to @@
      //       1. Vasya
      //       2. Murka
      //
      // Result:
      //
      // Nested foreach commands create appropriate steps nodes with reference substitution

      jest.clearAllMocks()
      runCommand.mockImplementation(sourceRunCommand)

      // Create node structure matching the example
      const nameReqNode = {id: 'nameReq', title: '@namereq use only russian names', parent: 'root'}
      const greetingReqNode = {id: 'greetingReq', title: '@greetingreq use only russian greeting', parent: 'root'}

      // Dog branch
      const dogForeachChild0 = {
        id: 'dogForeachChild0',
        title: '#0 /chatgpt say hello to @@ (@@greetingreq)',
        parent: 'dogForeach',
      }
      const dogForeachChild2 = {
        id: 'dogForeachChild2',
        title: '#2 /chatgpt say "you\'re a good dog" to @@',
        parent: 'dogForeach',
      }

      const dogForeachNode = {
        id: 'dogForeach',
        command: '/foreach /steps',
        children: [dogForeachChild0.id, dogForeachChild2.id],
        parent: 'dogList',
      }

      const borisDog = {id: 'boris', title: '1. Boris', parent: 'dogList'}
      const mishaDog = {id: 'misha', title: '2. Misha', parent: 'dogList'}

      const dogList = {
        id: 'dogList',
        title: '/chatgpt give me a list of 2 dog names (@@namereq)',
        children: [dogForeachNode.id, borisDog.id, mishaDog.id],
        parent: 'dogStory',
      }

      const dogStory = {
        id: 'dogStory',
        title: 'Dog story',
        children: [dogList.id],
        parent: 'steps',
      }

      // Cat branch
      const catForeachChild0 = {
        id: 'catForeachChild0',
        title: '#0 /chatgpt say hello to @@ (@@greetingreq)',
        parent: 'catForeach',
      }
      const catForeachChild2 = {
        id: 'catForeachChild2',
        title: '#2 /chatgpt say "you\'re a good cat" to @@',
        parent: 'catForeach',
      }

      const catForeachNode = {
        id: 'catForeach',
        command: '/foreach /steps',
        children: [catForeachChild0.id, catForeachChild2.id],
        parent: 'catList',
      }

      const vasyaCat = {id: 'vasya', title: '1. Vasya', parent: 'catList'}
      const murkaCat = {id: 'murka', title: '2. Murka', parent: 'catList'}

      const catList = {
        id: 'catList',
        title: '/chatgpt give me a list of 2 cat names (@@namereq)',
        children: [catForeachNode.id, vasyaCat.id, murkaCat.id],
        parent: 'steps',
      }

      // Steps and root
      const stepsNode = {
        id: 'steps',
        command: '/steps',
        children: [dogStory.id, catList.id],
        parent: 'root',
      }

      const rootNode = {
        id: 'root',
        children: [nameReqNode.id, greetingReqNode.id, stepsNode.id],
      }

      mockStore._nodes = {
        [nameReqNode.id]: nameReqNode,
        [greetingReqNode.id]: greetingReqNode,
        [dogForeachChild0.id]: dogForeachChild0,
        [dogForeachChild2.id]: dogForeachChild2,
        [dogForeachNode.id]: dogForeachNode,
        [borisDog.id]: borisDog,
        [mishaDog.id]: mishaDog,
        [dogList.id]: dogList,
        [dogStory.id]: dogStory,
        [catForeachChild0.id]: catForeachChild0,
        [catForeachChild2.id]: catForeachChild2,
        [catForeachNode.id]: catForeachNode,
        [vasyaCat.id]: vasyaCat,
        [murkaCat.id]: murkaCat,
        [catList.id]: catList,
        [stepsNode.id]: stepsNode,
        [rootNode.id]: rootNode,
      }

      // Mock StepsCommand for dog and cat foreach nodes
      const stepsCommandInstance = {
        findMatchingNodes: jest.fn().mockImplementation(node => {
          if (node.id === dogForeachNode.id) {
            return {
              nodesByOrder: {
                0: [{node: dogForeachChild0, promptString: dogForeachChild0.title}],
                2: [{node: dogForeachChild2, promptString: dogForeachChild2.title}],
              },
              nodesWithoutOrder: [],
            }
          } else if (node.id === catForeachNode.id) {
            return {
              nodesByOrder: {
                0: [{node: catForeachChild0, promptString: catForeachChild0.title}],
                2: [{node: catForeachChild2, promptString: catForeachChild2.title}],
              },
              nodesWithoutOrder: [],
            }
          }
          return {nodesByOrder: {}, nodesWithoutOrder: []}
        }),
      }

      jest.spyOn(require('./StepsCommand'), 'StepsCommand').mockImplementation(() => stepsCommandInstance)

      // Mock generated nodes
      const borisResults = [
        {
          id: 'borisNode0',
          command: '#0 /chatgpt say hello to 1. Boris (use only russian greeting)',
          parent: 'borisSteps',
        },
        {id: 'borisNode2', command: '#2 /chatgpt say "you\'re a good dog" to 1. Boris', parent: 'borisSteps'},
      ]

      const mishaResults = [
        {
          id: 'mishaNode0',
          command: '#0 /chatgpt say hello to 2. Misha (use only russian greeting)',
          parent: 'mishaSteps',
        },
        {id: 'mishaNode2', command: '#2 /chatgpt say "you\'re a good dog" to 2. Misha', parent: 'mishaSteps'},
      ]

      const vasyaResults = [
        {
          id: 'vasyaNode0',
          command: '#0 /chatgpt say hello to 1. Vasya (use only russian greeting)',
          parent: 'vasyaSteps',
        },
        {id: 'vasyaNode2', command: '#2 /chatgpt say "you\'re a good cat" to 1. Vasya', parent: 'vasyaSteps'},
      ]

      const murkaResults = [
        {
          id: 'murkaNode0',
          command: '#0 /chatgpt say hello to 2. Murka (use only russian greeting)',
          parent: 'murkaSteps',
        },
        {id: 'murkaNode2', command: '#2 /chatgpt say "you\'re a good cat" to 2. Murka', parent: 'murkaSteps'},
      ]

      // Set up runCommand mock
      runCommand.mockImplementation(({cell, queryType}) => {
        if (queryType === 'steps') {
          if (cell.id === borisDog.id) {
            borisResults.map(node => mockStore.createNode(node))
          } else if (cell.id === mishaDog.id) {
            mishaResults.map(node => mockStore.createNode(node))
          } else if (cell.id === vasyaCat.id) {
            vasyaResults.map(node => mockStore.createNode(node))
          } else if (cell.id === murkaCat.id) {
            murkaResults.map(node => mockStore.createNode(node))
          }
        }
      })

      // Run foreach on both dog and cat nodes
      await command.run(dogForeachNode)
      const dogResult = mockStore.getOutput()

      await command.run(catForeachNode)
      const catResult = mockStore.getOutput()

      // Verify runCommand was called for each leaf node
      const callArgs1 = runCommand.mock.calls[0][0]
      expect(callArgs1).toEqual(
        expect.objectContaining({
          queryType: 'steps',
          cell: expect.objectContaining({id: borisDog.id}),
        }),
      )

      const callArgs2 = runCommand.mock.calls[1][0]
      expect(callArgs2).toEqual(
        expect.objectContaining({
          queryType: 'steps',
          cell: expect.objectContaining({id: mishaDog.id}),
        }),
      )

      const callArgs3 = runCommand.mock.calls[2][0]
      expect(callArgs3).toEqual(
        expect.objectContaining({
          queryType: 'steps',
          cell: expect.objectContaining({id: vasyaCat.id}),
        }),
      )

      const callArgs4 = runCommand.mock.calls[3][0]
      expect(callArgs4).toEqual(
        expect.objectContaining({
          queryType: 'steps',
          cell: expect.objectContaining({id: murkaCat.id}),
        }),
      )

      // Verify all nodes were created with proper substitution
      expect(dogResult.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({command: '#0 /chatgpt say hello to 1. Boris (use only russian greeting)'}),
          expect.objectContaining({command: '#2 /chatgpt say "you\'re a good dog" to 1. Boris'}),
          expect.objectContaining({command: '#0 /chatgpt say hello to 2. Misha (use only russian greeting)'}),
          expect.objectContaining({command: '#2 /chatgpt say "you\'re a good dog" to 2. Misha'}),
        ]),
      )

      expect(catResult.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({command: '#0 /chatgpt say hello to 1. Vasya (use only russian greeting)'}),
          expect.objectContaining({command: '#2 /chatgpt say "you\'re a good cat" to 1. Vasya'}),
          expect.objectContaining({command: '#0 /chatgpt say hello to 2. Murka (use only russian greeting)'}),
          expect.objectContaining({command: '#2 /chatgpt say "you\'re a good cat" to 2. Murka'}),
        ]),
      )
    })

    it('should execute foreach with steps on outline command with proper substitution', async () => {
      // Setup:
      //
      // parentNode
      //   @subject5877 Экономическая безопасность предприятия в области управленческого консалтинга
      //   /outline --scholar=xxs search for @@subject5877 --min_year=2021 --citation --lang=ru
      //     /foreach /outline search for @@ в контексте @@parents --scholar=xxs --min_year=2021 --lang=ru --citation --parallel=yes
      //     Экономическая безопасность предприятия в области управленческого консалтинга
      //       Гибкие адаптивные стратегии управления рисками
      //         Постоянный мониторинг внешней среды
      //
      // Result:
      //
      // parentNode
      //   @subject5877 Экономическая безопасность предприятия в области управленческого консалтинга
      //   /outline --scholar=xxs search for @@subject5877 --min_year=2021 --citation --lang=ru
      //     /foreach /outline search for @@ в контексте @@parents --scholar=xxs --min_year=2021 --lang=ru --citation --parallel=yes
      //     Экономическая безопасность предприятия в области управленческого консалтинга
      //       Гибкие адаптивные стратегии управления рисками
      //         /outline search for Постоянный мониторинг внешней среды в контексте Гибкие адаптивные стратегии управления рисками, Экономическая безопасность предприятия в области управленческого консалтинга --scholar=xxs --min_year=2021 --lang=ru --citation --parallel=yes --parents=0

      const subject = {
        id: 'subject',
        title: '@subject5877 Экономическая безопасность предприятия в области управленческого консалтинга',
        parent: 'parent',
      }
      const o1 = {
        id: 'o1',
        command: '/outline --scholar=xxs search for @@subject5877 --min_year=2021 --citation --lang=ru',
        parent: 'parent',
        children: ['f1', 'n1'],
      }
      const f1 = {
        id: 'f1',
        command:
          '/foreach /outline search for @@ в контексте @@parents --scholar=xxs --min_year=2021 --lang=ru --citation --parallel=yes',
        parent: 'o1',
        children: [],
      }
      const n1 = {
        id: 'n1',
        title: 'Экономическая безопасность предприятия в области управленческого консалтинга',
        parent: 'o1',
        children: ['n2'],
      }
      const n2 = {id: 'n2', title: 'Гибкие адаптивные стратегии управления рисками', parent: 'n1', children: ['n3']}
      const n3 = {id: 'n3', title: 'Постоянный мониторинг внешней среды', parent: 'n2'}
      const parentNode = {id: 'parent', children: ['subject', 'o1']}

      mockStore._nodes = {
        subject,
        o1,
        f1,
        n1,
        n2,
        n3,
        parent: parentNode,
      }

      const expectedCommand =
        '/outline search for Постоянный мониторинг внешней среды в контексте Гибкие адаптивные стратегии управления рисками, Экономическая безопасность предприятия в области управленческого консалтинга --scholar=xxs --min_year=2021 --lang=ru --citation --parallel=yes --parents=0'

      runCommand.mockResolvedValueOnce({nodes: [{id: 'newNode', command: expectedCommand}]})

      await command.run(f1)
      const result = mockStore.getOutput()

      const callArgs = runCommand.mock.calls[0][0]
      expect(callArgs).toEqual(
        expect.objectContaining({
          queryType: 'outline',
          cell: expect.objectContaining({
            id: 'n3',
            command: expectedCommand,
          }),
        }),
      )

      expect(result.nodes).toEqual(expect.arrayContaining([expect.objectContaining({command: expectedCommand})]))
    })

    it('should handle multiple web queries with correct substitution', async () => {
      // Input:
      //
      // parentNode
      //   @subject Экономическая безопасность консалтинга
      //   /chatgpt Give me 5 search queries for @@subject
      //     /foreach /web search for @@ on wikipedia --parallel=no --xxs --lang=ru
      //     1. "Экономическая безопасность в консалтинговых компаниях"
      //     2. "Как обеспечить экономическую безопасность в сфере консалтинга?"
      //
      // Output:
      //
      // parentNode
      //   @subject Экономическая безопасность консалтинга
      //   /chatgpt Give me 5 search queries for @@subject
      //     /foreach /web search for @@ on wikipedia --parallel=no --xxs --lang=ru
      //     /web search for 1. "Экономическая безопасность в консалтинговых компаниях" on wikipedia --parallel=no --xxs --lang=ru
      //     /web search for 2. "Как обеспечить экономическую безопасность в сфере консалтинга?" on wikipedia --parallel=no --xxs --lang=ru

      const subject = {id: 'subject', title: '@subject Экономическая безопасность консалтинга', parent: 'parent'}
      const chatgptNode = {
        id: 'cg',
        command: '/chatgpt Give me 5 search queries for @@subject',
        parent: 'parent',
        children: ['f1', 'q1', 'q2'],
      }
      const foreachNode = {
        id: 'f1',
        command: '/foreach /web search for @@ on wikipedia --parallel=no --xxs --lang=ru',
        parent: 'cg',
        children: [],
      }
      const query1 = {id: 'q1', title: '1. "Экономическая безопасность в консалтинговых компаниях"', parent: 'cg'}
      const query2 = {
        id: 'q2',
        title: '2. "Как обеспечить экономическую безопасность в сфере консалтинга?"',
        parent: 'cg',
      }
      const parentNode = {id: 'parent', children: ['subject', 'cg']}
      mockStore._nodes = {subject, cg: chatgptNode, f1: foreachNode, q1: query1, q2: query2, parent: parentNode}
      const expectedCommand1 =
        '/web search for 1. "Экономическая безопасность в консалтинговых компаниях" on wikipedia --parallel=no --xxs --lang=ru'
      const expectedCommand2 =
        '/web search for 2. "Как обеспечить экономическую безопасность в сфере консалтинга?" on wikipedia --parallel=no --xxs --lang=ru'

      runCommand
        .mockResolvedValueOnce({nodes: [{id: 'node1', command: expectedCommand1}]})
        .mockResolvedValueOnce({nodes: [{id: 'node2', command: expectedCommand2}]})

      await command.run(foreachNode)
      const result = mockStore.getOutput()

      const callArgs1 = runCommand.mock.calls[0][0]
      expect(callArgs1).toEqual(
        expect.objectContaining({
          queryType: 'web',
          cell: expect.objectContaining({id: 'q1', command: expectedCommand1}),
        }),
        expect.anything(),
      )

      const callArgs2 = runCommand.mock.calls[1][0]
      expect(callArgs2).toEqual(
        expect.objectContaining({
          queryType: 'web',
          cell: expect.objectContaining({id: 'q2', command: expectedCommand2}),
        }),
        expect.anything(),
      )
      expect(result.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({command: expectedCommand1}),
          expect.objectContaining({command: expectedCommand2}),
        ]),
      )
    })

    it('should handle color references with correct substitution', async () => {
      // Input:
      //
      // @color red
      // Entity
      //   Animal
      //     Cat
      //   Human
      //     Bob
      //   /foreach /chatgpt write 5 words about  @@@ with color of @@color
      //
      // Output:
      //
      // @color red
      // Entity
      //   Animal
      //     /chatgpt write 5 words about  Entity, Animal, Cat with color of @@color
      //   Human
      //     /chatgpt write 5 words about  Entity, Human, Bob with color of @@color
      //   /foreach /chatgpt write 5 words about  @@@ with color of @@color

      const colorNode = {id: 'color', title: '@color red', parent: 'root'}
      const catNode = {id: 'cat', title: 'Cat', parent: 'animal'}
      const animalNode = {id: 'animal', title: 'Animal', parent: 'entity', children: [catNode.id]}
      const bobNode = {id: 'bob', title: 'Bob', parent: 'human'}
      const humanNode = {id: 'human', title: 'Human', parent: 'entity', children: [bobNode.id]}
      const foreachNode = {
        id: 'foreach',
        command: '/foreach /chatgpt write 5 words about  @@@ with color of @@color',
        parent: 'entity',
      }
      const entityNode = {
        id: 'entity',
        title: 'Entity',
        parent: 'root',
        children: [animalNode.id, humanNode.id, foreachNode.id],
      }
      const rootNode = {id: 'root', children: [colorNode.id, entityNode.id]}
      mockStore._nodes = {
        [colorNode.id]: colorNode,
        [catNode.id]: catNode,
        [animalNode.id]: animalNode,
        [bobNode.id]: bobNode,
        [humanNode.id]: humanNode,
        [foreachNode.id]: foreachNode,
        [entityNode.id]: entityNode,
        [rootNode.id]: rootNode,
      }
      const expectedCommand1 = '/chatgpt write 5 words about  Entity, Animal, Cat with color of @@color'
      const expectedCommand2 = '/chatgpt write 5 words about  Entity, Human, Bob with color of @@color'
      runCommand
        .mockResolvedValueOnce({nodes: [{id: 'n1', command: expectedCommand1}]})
        .mockResolvedValueOnce({nodes: [{id: 'n2', command: expectedCommand2}]})

      await command.run(foreachNode)
      const result = mockStore.getOutput()

      const callArgs1 = runCommand.mock.calls[0][0]
      expect(callArgs1).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({id: 'cat', command: expectedCommand1}),
        }),
      )
      const callArgs2 = runCommand.mock.calls[1][0]
      expect(callArgs2).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({id: 'bob', command: expectedCommand2}),
        }),
      )
      expect(result.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({command: expectedCommand1}),
          expect.objectContaining({command: expectedCommand2}),
        ]),
      )
    })

    it('should execute foreach with steps using numeric references', async () => {
      // Input:
      //
      // /chatgpt say "2"
      //   /foreach /steps
      //     #10 /chatgpt say hi @@ times
      //     #20 /summarize what this text says? --parent=1
      //   2
      //
      // Output:
      //
      // /chatgpt say "2"
      //   /foreach /steps
      //     #10 /chatgpt say hi @@ times
      //     #20 /summarize what this text says? --parent=1
      //   /steps 2
      //     #10 /chatgpt say hi 2 times
      //     #20 /summarize what this text says? --parent=1

      const numericNode = {id: 'n', title: '2', parent: 'chatgpt'}
      const foreachChild10 = {id: 'c10', title: '#10 /chatgpt say hi @@ times', parent: 'foreach'}
      const foreachChild20 = {id: 'c20', title: '#20 /summarize what this text says? --parent=1', parent: 'foreach'}
      const foreachNode = {
        id: 'foreach',
        command: '/foreach /steps',
        children: [foreachChild10.id, foreachChild20.id],
        parent: 'chatgpt',
      }
      const chatgptNode = {
        id: 'chatgpt',
        command: '/chatgpt say "2"',
        children: [foreachNode.id, numericNode.id],
        parent: 'root',
      }
      const rootNode = {id: 'root', children: [chatgptNode.id]}

      mockStore._nodes = {
        [numericNode.id]: numericNode,
        [foreachChild10.id]: foreachChild10,
        [foreachChild20.id]: foreachChild20,
        [foreachNode.id]: foreachNode,
        [chatgptNode.id]: chatgptNode,
        [rootNode.id]: rootNode,
      }

      jest.spyOn(require('./StepsCommand'), 'StepsCommand').mockImplementation(() => ({
        findMatchingNodes: jest.fn().mockReturnValue({
          nodesByOrder: {
            10: [{node: foreachChild10, promptString: foreachChild10.title}],
            20: [{node: foreachChild20, promptString: foreachChild20.title}],
          },
          nodesWithoutOrder: [],
        }),
      }))

      const resultNodes = [
        {id: 'result10', command: '#10 /chatgpt say hi 2 times'},
        {id: 'result20', command: '#20 /summarize what this text says? --parent=1'},
      ]

      runCommand.mockResolvedValueOnce({nodes: resultNodes})

      await command.run(foreachNode)
      const result = mockStore.getOutput()

      const callArgs = runCommand.mock.calls[0][0]
      expect(callArgs).toEqual(
        expect.objectContaining({
          queryType: 'steps',
          cell: expect.objectContaining({
            id: 'n',
            title: '2',
            command: '/steps 2',
          }),
        }),
      )

      expect(result.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({command: '#10 /chatgpt say hi 2 times'}),
          expect.objectContaining({command: '#20 /summarize what this text says? --parent=1'}),
        ]),
      )
    })

    it('should recursively process hierarchy with parent references', async () => {
      // Input:
      //
      // parentNode
      //   /foreach /chatgpt say hello to "@@@"
      //   Foreach Test
      //     Item A
      //       Sub item 1
      //         Sub sub item 1
      //       Sub item 2
      //     Item B
      //
      // Output:
      //
      // parentNode
      //   /foreach /chatgpt say hello to "@@@"
      //   Foreach Test
      //     Item A
      //       Sub item 1
      //         /chatgpt say hello to "Foreach Test, Item A, Sub item 1, Sub sub item 1"
      //       /chatgpt say hello to "Foreach Test, Item A, Sub item 2"
      //     /chatgpt say hello to "Foreach Test, Item B"

      jest.clearAllMocks()

      const subSubItem1 = {id: 'ssi1', title: 'Sub sub item 1', parent: 'si1'}
      const subItem1 = {id: 'si1', title: 'Sub item 1', parent: 'itemA', children: [subSubItem1.id]}
      const subItem2 = {id: 'si2', title: 'Sub item 2', parent: 'itemA'}
      const itemA = {id: 'itemA', title: 'Item A', parent: 'foreachTest', children: [subItem1.id, subItem2.id]}
      const itemB = {id: 'itemB', title: 'Item B', parent: 'foreachTest'}
      const foreachTest = {id: 'foreachTest', title: 'Foreach Test', parent: 'parent', children: [itemA.id, itemB.id]}
      const foreachNode = {id: 'foreach', command: '/foreach /chatgpt say hello to "@@@"', parent: 'parent'}
      const parentNode = {id: 'parent', children: [foreachNode.id, foreachTest.id], parent: 'root'}

      mockStore._nodes = {
        [subSubItem1.id]: subSubItem1,
        [subItem1.id]: subItem1,
        [subItem2.id]: subItem2,
        [itemA.id]: itemA,
        [itemB.id]: itemB,
        [foreachTest.id]: foreachTest,
        [foreachNode.id]: foreachNode,
        [parentNode.id]: parentNode,
      }

      runCommand
        .mockResolvedValueOnce({
          nodes: [{id: 'result1', command: '/chatgpt say hello to "Foreach Test, Item A, Sub item 1, Sub sub item 1"'}],
        })
        .mockResolvedValueOnce({
          nodes: [{id: 'result2', command: '/chatgpt say hello to "Foreach Test, Item A, Sub item 2"'}],
        })
        .mockResolvedValueOnce({nodes: [{id: 'result3', command: '/chatgpt say hello to "Foreach Test, Item B"'}]})

      await command.run(foreachNode)
      const result = mockStore.getOutput()

      const callArgs1 = runCommand.mock.calls[0][0]
      expect(callArgs1).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'ssi1',
            command: '/chatgpt say hello to "Foreach Test, Item A, Sub item 1, Sub sub item 1"',
          }),
        }),
      )

      const callArgs2 = runCommand.mock.calls[1][0]
      expect(callArgs2).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'si2',
            command: '/chatgpt say hello to "Foreach Test, Item A, Sub item 2"',
          }),
        }),
      )

      const callArgs3 = runCommand.mock.calls[2][0]
      expect(callArgs3).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'itemB',
            command: '/chatgpt say hello to "Foreach Test, Item B"',
          }),
        }),
      )

      expect(result.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command: '/chatgpt say hello to "Foreach Test, Item A, Sub item 1, Sub sub item 1"',
          }),
          expect.objectContaining({command: '/chatgpt say hello to "Foreach Test, Item A, Sub item 2"'}),
          expect.objectContaining({command: '/chatgpt say hello to "Foreach Test, Item B"'}),
        ]),
      )
    })

    it('should correctly apply foreach command to dog breed list with parent references', async () => {
      // Input:
      //
      // /chatgpt give me list of 2 dog breeds, no explanations
      //   /foreach /chatgpt for @@@ give me list of 2 dog names, no explanations
      //   /foreach /chatgpt for @@@ give me list of 2 dog toys, no explanations
      //   1. Labrador Retriever
      //   2. German Shepherd
      //
      // Output:
      //
      // /chatgpt give me list of 2 dog breeds, no explanations
      //   /foreach /chatgpt for @@@ give me list of 2 dog names, no explanations
      //   /foreach /chatgpt for @@@ give me list of 2 dog toys, no explanations
      //   /chatgpt for , 1. Labrador Retriever give me list of 2 dog names, no explanations
      //   /chatgpt for , 2. German Shepherd give me list of 2 dog names, no explanations

      jest.clearAllMocks()

      const labrador = {id: 'lab', title: '1. Labrador Retriever', parent: 'parent'}
      const shepherd = {id: 'shepherd', title: '2. German Shepherd', parent: 'parent'}
      const foreachNames = {
        id: 'foreachNames',
        command: '/foreach /chatgpt for @@@ give me list of 2 dog names, no explanations',
        parent: 'parent',
      }
      const foreachToys = {
        id: 'foreachToys',
        command: '/foreach /chatgpt for @@@ give me list of 2 dog toys, no explanations',
        parent: 'parent',
      }
      const parentNode = {
        id: 'parent',
        command: '/chatgpt give me list of 2 dog breeds, no explanations',
        parent: 'root',
        children: [foreachNames.id, foreachToys.id, labrador.id, shepherd.id],
      }

      mockStore._nodes = {
        [labrador.id]: labrador,
        [shepherd.id]: shepherd,
        [foreachNames.id]: foreachNames,
        [foreachToys.id]: foreachToys,
        [parentNode.id]: parentNode,
      }

      const expectedCommand1 = '/chatgpt for , 1. Labrador Retriever give me list of 2 dog names, no explanations'
      const expectedCommand2 = '/chatgpt for , 2. German Shepherd give me list of 2 dog names, no explanations'

      await command.run(foreachNames)
      const result = mockStore.getOutput()

      const callArgs1 = runCommand.mock.calls[0][0]
      expect(callArgs1).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'lab',
            command: expectedCommand1,
          }),
        }),
      )

      const callArgs2 = runCommand.mock.calls[1][0]
      expect(callArgs2).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'shepherd',
            command: expectedCommand2,
          }),
        }),
      )

      expect(result.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({command: expectedCommand1}),
          expect.objectContaining({command: expectedCommand2}),
        ]),
      )
    })

    it('should correctly apply nested foreach commands with complex parent references', async () => {
      // Input:
      //
      // /chatgpt give me list of 2 dog breeds, no explanations
      //   /foreach /chatgpt for @@@ give me list of 2 dog names, no explanations
      //   /foreach /chatgpt for @@@ give me list of 2 dog toys, no explanations
      //   /chatgpt for , 1. Labrador Retriever give me list of 2 dog names, no explanations
      //     1. Max
      //     2. Bella
      //   /chatgpt for , 2. German Shepherd give me list of 2 dog names, no explanations
      //     1. Max
      //     2. Kaiser
      //
      // Output:
      //
      // /chatgpt give me list of 2 dog breeds, no explanations
      //   /foreach /chatgpt for @@@ give me list of 2 dog names, no explanations
      //   /foreach /chatgpt for @@@ give me list of 2 dog toys, no explanations
      //   /chatgpt for , 1. Labrador Retriever give me list of 2 dog names, no explanations
      //     /chatgpt for , 1. Labrador Retriever, 1. Max   give me list of 2 dog toys, no explanations
      //     /chatgpt for , 1. Labrador Retriever, 2. Bella give me list of 2 dog toys, no explanations
      //   /chatgpt for , 2. German Shepherd give me list of 2 dog names, no explanations
      //     /chatgpt for , 2. German Shepherd, 1. Max   give me list of 2 dog toys, no explanations
      //     /chatgpt for , 2. German Shepherd, 2. Kaiser give me list of 2 dog toys, no explanations

      jest.clearAllMocks()

      const dogBreedNode = {
        id: 'dogBreed',
        command: '/chatgpt give me list of 2 dog breeds, no explanations',
        parent: 'root',
        children: ['foreachNames', 'foreachToys', 'labrador', 'shepherd'],
      }

      const foreachNamesNode = {
        id: 'foreachNames',
        command: '/foreach /chatgpt for @@@ give me list of 2 dog names, no explanations',
        parent: 'dogBreed',
        children: [],
      }

      const foreachToysNode = {
        id: 'foreachToys',
        command: '/foreach /chatgpt for @@@ give me list of 2 dog toys, no explanations',
        parent: 'dogBreed',
        children: [],
      }

      // Setup Labrador branch
      const labradorNode = {
        id: 'labrador',
        title: '1. Labrador Retriever',
        command: '/chatgpt for , 1. Labrador Retriever give me list of 2 dog names, no explanations',
        parent: 'dogBreed',
        children: ['max1', 'bella'],
      }

      const maxLabrador = {
        id: 'max1',
        title: '1. Max',
        parent: 'labrador',
        children: [],
      }

      const bellaLabrador = {
        id: 'bella',
        title: '2. Bella',
        parent: 'labrador',
        children: [],
      }

      // Setup German Shepherd branch
      const shepherdNode = {
        id: 'shepherd',
        title: '2. German Shepherd',
        command: '/chatgpt for , 2. German Shepherd give me list of 2 dog names, no explanations',
        parent: 'dogBreed',
        children: ['max2', 'kaiser'],
      }

      const maxShepherd = {
        id: 'max2',
        title: '1. Max',
        parent: 'shepherd',
        children: [],
      }

      const kaiserShepherd = {
        id: 'kaiser',
        title: '2. Kaiser',
        parent: 'shepherd',
        children: [],
      }

      const rootNode = {
        id: 'root',
        children: [dogBreedNode.id],
      }

      mockStore._nodes = {
        [dogBreedNode.id]: dogBreedNode,
        [foreachNamesNode.id]: foreachNamesNode,
        [foreachToysNode.id]: foreachToysNode,
        [labradorNode.id]: labradorNode,
        [maxLabrador.id]: maxLabrador,
        [bellaLabrador.id]: bellaLabrador,
        [shepherdNode.id]: shepherdNode,
        [maxShepherd.id]: maxShepherd,
        [kaiserShepherd.id]: kaiserShepherd,
        [rootNode.id]: rootNode,
      }

      runCommand
        .mockImplementationOnce(() => {
          mockStore.createNode({
            id: 'toyResult1',
            command: '/chatgpt for , 1. Labrador Retriever, 1. Max give me list of 2 dog toys, no explanations',
          })
        })
        .mockImplementationOnce(() => {
          mockStore.createNode({
            id: 'toyResult2',
            command: '/chatgpt for , 1. Labrador Retriever, 2. Bella give me list of 2 dog toys, no explanations',
          })
        })
        .mockImplementationOnce(() => {
          mockStore.createNode({
            id: 'toyResult3',
            command: '/chatgpt for , 2. German Shepherd, 1. Max give me list of 2 dog toys, no explanations',
          })
        })
        .mockImplementationOnce(() => {
          mockStore.createNode({
            id: 'toyResult4',
            command: '/chatgpt for , 2. German Shepherd, 2. Kaiser give me list of 2 dog toys, no explanations',
          })
        })

      await command.run(foreachToysNode)
      const result = mockStore.getOutput()

      const callArgs1 = runCommand.mock.calls[0][0]
      expect(callArgs1).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'max1',
            command: '/chatgpt for 1. Labrador Retriever, 1. Max give me list of 2 dog toys, no explanations',
          }),
        }),
      )

      const callArgs2 = runCommand.mock.calls[1][0]
      expect(callArgs2).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'bella',
            command: '/chatgpt for 1. Labrador Retriever, 2. Bella give me list of 2 dog toys, no explanations',
          }),
        }),
      )

      const callArgs3 = runCommand.mock.calls[2][0]
      expect(callArgs3).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'max2',
            command: '/chatgpt for 2. German Shepherd, 1. Max give me list of 2 dog toys, no explanations',
          }),
        }),
      )

      const callArgs4 = runCommand.mock.calls[3][0]
      expect(callArgs4).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'kaiser',
            command: '/chatgpt for 2. German Shepherd, 2. Kaiser give me list of 2 dog toys, no explanations',
          }),
        }),
      )

      expect(result.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command: '/chatgpt for , 1. Labrador Retriever, 1. Max give me list of 2 dog toys, no explanations',
          }),
          expect.objectContaining({
            command: '/chatgpt for , 1. Labrador Retriever, 2. Bella give me list of 2 dog toys, no explanations',
          }),
          expect.objectContaining({
            command: '/chatgpt for , 2. German Shepherd, 1. Max give me list of 2 dog toys, no explanations',
          }),
          expect.objectContaining({
            command: '/chatgpt for , 2. German Shepherd, 2. Kaiser give me list of 2 dog toys, no explanations',
          }),
        ]),
      )
    })

    it('should apply steps to each citation entry in web search results', async () => {
      // Input:

      // /web ищи на сайте cyberleninka статьи на тему информацинный аспект экономической безопасности --citation
      //   /foreach /steps
      //     #5 /chatgpt кратко расшифруй название файла: @@
      //     #10 /summarize figure out author and title of this academic study --xxs
      //     #20 /summarize на основании научной работы опиши подход автора в этой научной работе
      //   Citations:
      //     https://cyberleninka.ru/article/n/informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa
      //       informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa.pdf
      //     https://cyberleninka.ru/article/n/informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii-1
      //       informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii.pdf

      // Output:

      // /web ищи на сайте cyberleninka статьи на тему информацинный аспект экономической безопасности --citation
      //   /foreach /steps
      //     #5 /chatgpt кратко расшифруй название файла: @@
      //     #10 /summarize figure out author and title of this academic study --xxs
      //     #20 /summarize на основании научной работы опиши подход автора в этой научной работе
      //   Citations:
      //     https://cyberleninka.ru/article/n/informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa
      //       /steps informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa.pdf
      //         #5 /chatgpt кратко расшифруй название файла: informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa.pdf
      //         #10 /summarize figure out author and title of this academic study --xxs
      //         #20 /summarize на основании научной работы опиши подход автора в этой научной работе
      //     https://cyberleninka.ru/article/n/informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii-1
      //       /steps informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii.pdf
      //         #5 /chatgpt кратко расшифруй название файла: informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii.pdf
      //         #10 /summarize figure out author and title of this academic study --xxs
      //         #20 /summarize на основании научной работы опиши подход автора в этой научной работе

      jest.clearAllMocks()

      // Step command definitions
      const step5 = {
        id: 'step5',
        title: '#5 /chatgpt кратко расшифруй название файла: @@',
        parent: 'foreachNode',
      }

      const step10 = {
        id: 'step10',
        title: '#10 /summarize figure out author and title of this academic study --xxs',
        parent: 'foreachNode',
      }

      const step20 = {
        id: 'step20',
        title: '#20 /summarize на основании научной работы опиши подход автора в этой научной работе',
        parent: 'foreachNode',
      }

      // The main foreach command
      const foreachNode = {
        id: 'foreachNode',
        command: '/foreach /steps',
        children: [step5.id, step10.id, step20.id],
        parent: 'webNode',
      }

      // Citation entries
      const citation1Url = {
        id: 'citation1Url',
        title:
          'https://cyberleninka.ru/article/n/informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa',
        parent: 'citations',
        children: ['citation1File'],
      }

      const citation1File = {
        id: 'citation1File',
        title:
          'informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa.pdf',
        parent: 'citation1Url',
        children: [],
      }

      const citation2Url = {
        id: 'citation2Url',
        title:
          'https://cyberleninka.ru/article/n/informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii-1',
        parent: 'citations',
        children: ['citation2File'],
      }

      const citation2File = {
        id: 'citation2File',
        title: 'informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii.pdf',
        parent: 'citation2Url',
        children: [],
      }

      const citationsNode = {
        id: 'citations',
        title: 'Citations:',
        parent: 'webNode',
        children: [citation1Url.id, citation2Url.id],
      }

      const webNode = {
        id: 'webNode',
        command:
          '/web ищи на сайте cyberleninka статьи на тему информацинный аспект экономической безопасности --citation',
        parent: 'root',
        children: [foreachNode.id, citationsNode.id],
      }

      const rootNode = {
        id: 'root',
        children: [webNode.id],
      }

      mockStore._nodes = {
        [step5.id]: step5,
        [step10.id]: step10,
        [step20.id]: step20,
        [foreachNode.id]: foreachNode,
        [citation1Url.id]: citation1Url,
        [citation1File.id]: citation1File,
        [citation2Url.id]: citation2Url,
        [citation2File.id]: citation2File,
        [citationsNode.id]: citationsNode,
        [webNode.id]: webNode,
        [rootNode.id]: rootNode,
      }

      const stepsCommandInstance = {
        findMatchingNodes: jest.fn().mockReturnValue({
          nodesByOrder: {
            5: [{node: step5, promptString: step5.title}],
            10: [{node: step10, promptString: step10.title}],
            20: [{node: step20, promptString: step20.title}],
          },
          nodesWithoutOrder: [],
        }),
      }
      jest.spyOn(require('./StepsCommand'), 'StepsCommand').mockImplementation(() => stepsCommandInstance)

      const expectedSteps1 = [
        {
          id: 'step1_5',
          command:
            '#5 /chatgpt кратко расшифруй название файла: informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa.pdf',
          parent: 'steps1',
        },
        {
          id: 'step1_10',
          command: '#10 /summarize figure out author and title of this academic study --xxs',
          parent: 'steps1',
        },
        {
          id: 'step1_20',
          command: '#20 /summarize на основании научной работы опиши подход автора в этой научной работе',
          parent: 'steps1',
        },
      ]

      const expectedSteps2 = [
        {
          id: 'step2_5',
          command:
            '#5 /chatgpt кратко расшифруй название файла: informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii.pdf',
          parent: 'steps2',
        },
        {
          id: 'step2_10',
          command: '#10 /summarize figure out author and title of this academic study --xxs',
          parent: 'steps2',
        },
        {
          id: 'step2_20',
          command: '#20 /summarize на основании научной работы опиши подход автора в этой научной работе',
          parent: 'steps2',
        },
      ]

      runCommand
        .mockImplementationOnce(() => {
          expectedSteps1.map(node => mockStore.createNode(node))
        })
        .mockImplementationOnce(() => {
          expectedSteps2.map(node => mockStore.createNode(node))
        })

      await command.run(foreachNode)
      const result = mockStore.getOutput()

      const callArgs1 = runCommand.mock.calls[0][0]
      expect(callArgs1).toEqual(
        expect.objectContaining({
          queryType: 'steps',
          cell: expect.objectContaining({
            id: 'citation1File',
            title:
              'informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa.pdf',
            command:
              '/steps informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa.pdf',
          }),
        }),
      )

      const callArgs2 = runCommand.mock.calls[1][0]
      expect(callArgs2).toEqual(
        expect.objectContaining({
          queryType: 'steps',
          cell: expect.objectContaining({
            id: 'citation2File',
            title: 'informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii.pdf',
            command: '/steps informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii.pdf',
          }),
        }),
      )

      // Verify all expected nodes are in the result
      expect(result.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command:
              '#5 /chatgpt кратко расшифруй название файла: informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa.pdf',
            parent: 'citation1File',
            title: '#5 /chatgpt кратко расшифруй название файла: @@',
          }),
          expect.objectContaining({
            command: '#10 /summarize figure out author and title of this academic study --xxs',
            parent: 'citation1File',
            title: '#10 /summarize figure out author and title of this academic study --xxs',
          }),
          expect.objectContaining({
            command: '#20 /summarize на основании научной работы опиши подход автора в этой научной работе',
            parent: 'citation1File',
            title: '#20 /summarize на основании научной работы опиши подход автора в этой научной работе',
          }),
          expect.objectContaining({
            command:
              '#5 /chatgpt кратко расшифруй название файла: informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii.pdf',
            parent: 'citation2File',
            title: '#5 /chatgpt кратко расшифруй название файла: @@',
          }),
          expect.objectContaining({
            command: '#10 /summarize figure out author and title of this academic study --xxs',
            parent: 'citation2File',
            title: '#10 /summarize figure out author and title of this academic study --xxs',
          }),
          expect.objectContaining({
            command: '#20 /summarize на основании научной работы опиши подход автора в этой научной работе',
            parent: 'citation2File',
            title: '#20 /summarize на основании научной работы опиши подход автора в этой научной работе',
          }),
          expect.objectContaining({
            command:
              '#5 /chatgpt кратко расшифруй название файла: informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa.pdf',
            parent: 'steps1',
          }),
          expect.objectContaining({
            command: '#10 /summarize figure out author and title of this academic study --xxs',
            parent: 'steps1',
          }),
          expect.objectContaining({
            command: '#20 /summarize на основании научной работы опиши подход автора в этой научной работе',
            parent: 'steps1',
          }),
          expect.objectContaining({
            command:
              '#5 /chatgpt кратко расшифруй название файла: informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii.pdf',
            parent: 'steps2',
          }),
          expect.objectContaining({
            command: '#10 /summarize figure out author and title of this academic study --xxs',
            parent: 'steps2',
          }),
          expect.objectContaining({
            command: '#20 /summarize на основании научной работы опиши подход автора в этой научной работе',
            parent: 'steps2',
          }),
        ]),
      )

      // Verify specific commands have been correctly substituted
      expect(result.nodes).toContainEqual(
        expect.objectContaining({
          command:
            '#5 /chatgpt кратко расшифруй название файла: informatsionnye-aspekty-obespecheniya-ekonomicheskoy-bezopasnosti-rossiyskoy-federatsii-v-usloviyah-krizisa.pdf',
        }),
      )

      expect(result.nodes).toContainEqual(
        expect.objectContaining({
          command:
            '#5 /chatgpt кратко расшифруй название файла: informatsionnaya-sostavlyayuschaya-ekonomicheskoy-bezopasnosti-rossii.pdf',
        }),
      )
    })

    it('should call findLeafs with useFile flag', async () => {
      const child1 = {id: 'c1', file: 'id', title: 'Child1'}
      const str = 'Command @@'
      const child3 = {id: 'c3', command: `/foreach --file ${str}`, parent: 'p'}
      const parentNode = {id: 'p', parent: 'root', title: 'ParentNode', children: [child1.id, child3.id]}

      mockStore._nodes = {
        [child1.id]: child1,
        [child3.id]: child3,
        [parentNode.id]: parentNode,
      }

      const leafs = [{node: child1, promptString: str.replace(REF_PREFIX, child1.title)}]

      const findLeafsSpy = jest.spyOn(command, 'findLeafs')
      jest.spyOn(command, 'executePrompts')

      findLeafsSpy.mockReturnValue(leafs)

      await command.run(child3)

      expect(findLeafsSpy).toHaveBeenCalledWith(parentNode, expect.anything(), true)
    })

    it('should execute deep nested foreach', async () => {
      // Setup:
      //
      //  root
      //  /foreach /steps №1
      //    /chatgpt create friend's name for @@ №1
      //      /foreach /chatgpt say hello to @@
      //  Dog
      // Result: Commands are executed for each dog and cat name with proper reference substitution

      const foreachNode2 = {
        id: 'foreachNode2',
        command: '/foreach /chatgpt say hello to @@',
        children: [],
      }

      const chatNode1 = {
        id: 'chatNode1',
        command: '/chatgpt write friend name for @@ №1',
        children: [foreachNode2.id],
      }
      foreachNode2.parent = chatNode1.id

      const foreachNode1 = {
        id: 'foreachNode1',
        command: '/foreach /steps #1',
        children: [chatNode1.id],
      }
      chatNode1.parent = foreachNode1.id

      const dogNode = {
        id: 'dog',
        title: 'Dog',
        children: [],
      }

      const root = {
        id: 'root',
        title: 'root',
        children: [foreachNode1.id, dogNode.id],
      }
      foreachNode1.parent = root.id
      dogNode.parent = root.id

      mockStore._nodes = {
        [foreachNode1.id]: foreachNode1,
        [foreachNode2.id]: foreachNode2,
        [chatNode1.id]: chatNode1,
        [dogNode.id]: dogNode,
        [root.id]: root,
      }

      // Set up StepsCommand mock
      const stepsCommandInstance = {
        findMatchingNodes: jest.fn(),
      }
      StepsCommand.mockImplementation(() => stepsCommandInstance)

      createDeepClone.mockReturnValue([])

      // Configure mock to return different values for different calls
      stepsCommandInstance.findMatchingNodes.mockImplementation(node => {
        if (node.id === foreachNode1.id) {
          return {
            nodesByOrder: {},
            nodesWithoutOrder: [{node: chatNode1, promptString: "/chatgpt create friend's name for @@ №1"}],
          }
        }
        return {nodesByOrder: {}, nodesWithoutOrder: []}
      })

      // Execute the foreach command
      await command.run(foreachNode1)

      expect(createDeepClone).toHaveBeenCalled()
    })

    it('should execute prompts only on nodes with file when --file is specified', async () => {
      // Setup:
      //
      // parentNode
      //   /foreach --file /chatgpt say hello to @@
      //   Luna
      //   Filey (this node has file attached)
      //
      // Expected result: command only executes on Filey node

      const luna = {id: 'luna', title: 'Luna', parent: 'parent'}
      const filey = {id: 'filey', title: 'Filey', file: 'file-id', parent: 'parent'}
      const foreachNode = {
        id: 'foreach',
        command: '/foreach --file /chatgpt say hello to @@',
        parent: 'parent',
        isRoot: false,
      }
      const parentNode = {
        id: 'parent',
        title: 'ParentNode',
        children: [luna.id, filey.id, foreachNode.id],
        parent: 'root',
        isRoot: false,
      }

      mockStore._nodes = {
        [luna.id]: luna,
        [filey.id]: filey,
        [foreachNode.id]: foreachNode,
        [parentNode.id]: parentNode,
      }

      mockStore._files = {
        'file-id': 'file-content',
      }

      const leafs = [{node: filey, promptString: '/chatgpt say hello to Filey'}]

      const findLeafsSpy = jest.spyOn(command, 'findLeafs')
      findLeafsSpy.mockReturnValue(leafs)

      const executePromptsSpy = jest.spyOn(command, 'executePrompts')
      executePromptsSpy.mockResolvedValue([{id: 'result', command: '/chatgpt say hello to Filey'}])

      await command.run(foreachNode)

      expect(findLeafsSpy).toHaveBeenCalledWith(parentNode, expect.anything(), true)
      expect(executePromptsSpy).toHaveBeenCalledWith(leafs, expect.anything())
    })

    it('should execute deeply nested foreach with complex steps structure', async () => {
      // Setup:
      //
      // parentNode
      //   /foreach /steps
      //     [title: "План главы"] #10 /chatgpt для главы ``` @@ ``` напиши план главы
      //     [title: "Данные для главы со ссылками"] #20 /scholar --xxs --citation  ``` @@ ```
      //       /foreach /download --max_size=2mb --max_pages=2 @@ Citation: @@link
      //       /foreach --file /steps
      //         #10 /summarize figure out author and title of this academic study --xxs
      //     [title: "Суммаризация"]#40 /summarize summarize
      //   Информационный аспект экономической безопасности
      //
      // Expected result: Complex step structure applied to leaf node

      jest.clearAllMocks()

      // Create step nodes for the main foreach
      const step10Node = {
        id: 'step10',
        title: 'План главы',
        command: '#10 /chatgpt для главы ``` @@ ``` напиши план главы',
        parent: 'foreachNode',
      }

      const nestedForeachDownload = {
        id: 'nestedForeachDownload',
        command: '/foreach /download --max_size=2mb --max_pages=2 @@ Citation: @@link',
        parent: 'step20Node',
      }

      const nestedStepNode = {
        id: 'nestedStep',
        title: '#10 /summarize figure out author and title of this academic study --xxs',
        parent: 'nestedForeachFile',
      }

      const nestedForeachFile = {
        id: 'nestedForeachFile',
        command: '/foreach --file /steps',
        children: [nestedStepNode.id],
        parent: 'step20Node',
      }

      const step20Node = {
        id: 'step20Node',
        title: 'Данные для главы со ссылками',
        command: '#20 /scholar --xxs --citation  ``` @@ ```',
        children: [nestedForeachDownload.id, nestedForeachFile.id],
        parent: 'foreachNode',
      }

      const step40Node = {
        id: 'step40',
        title: 'Суммаризация',
        command: '#40 /summarize summarize',
        parent: 'foreachNode',
      }

      // Create the main foreach node with steps
      const foreachNode = {
        id: 'foreachNode',
        command: '/foreach /steps',
        children: [step10Node.id, step20Node.id, step40Node.id],
        parent: 'parentNode',
      }

      // Create the leaf node
      const leafNode = {
        id: 'leaf',
        title: 'Информационный аспект экономической безопасности',
        parent: 'parentNode',
      }

      // Create the parent node
      const parentNode = {
        id: 'parentNode',
        title: 'parentNode',
        children: [foreachNode.id, leafNode.id],
      }

      mockStore._nodes = {
        [step10Node.id]: step10Node,
        [nestedForeachDownload.id]: nestedForeachDownload,
        [nestedStepNode.id]: nestedStepNode,
        [nestedForeachFile.id]: nestedForeachFile,
        [step20Node.id]: step20Node,
        [step40Node.id]: step40Node,
        [foreachNode.id]: foreachNode,
        [leafNode.id]: leafNode,
        [parentNode.id]: parentNode,
      }

      // Configure StepsCommand mock
      const stepsCommandInstance = {
        findMatchingNodes: jest.fn().mockReturnValue({
          nodesByOrder: {
            10: [{node: step10Node, promptString: step10Node.command}],
            20: [{node: step20Node, promptString: step20Node.command}],
            40: [{node: step40Node, promptString: step40Node.command}],
          },
          nodesWithoutOrder: [],
        }),
      }
      jest.spyOn(require('./StepsCommand'), 'StepsCommand').mockImplementation(() => stepsCommandInstance)

      // Setup expected result nodes
      const step10Result = {
        id: 'step10Result',
        command: '#10 /chatgpt для главы ``` Информационный аспект экономической безопасности ``` напиши план главы',
        parent: 'leafSteps',
      }

      const nestedForeachDownloadResult = {
        id: 'nestedForeachDownloadResult',
        command: '/foreach /download --max_size=2mb --max_pages=2 @@ Citation: @@link',
        parent: 'step20Result',
      }

      const nestedStepResult = {
        id: 'nestedStepResult',
        title: '#10 /summarize figure out author and title of this academic study --xxs',
        parent: 'nestedForeachFileResult',
      }

      const nestedForeachFileResult = {
        id: 'nestedForeachFileResult',
        command: '/foreach --file /steps',
        children: [nestedStepResult.id],
        parent: 'step20Result',
      }

      const step20Result = {
        id: 'step20Result',
        command: '#20 /scholar --xxs --citation  ``` Информационный аспект экономической безопасности ```',
        children: [nestedForeachDownloadResult.id, nestedForeachFileResult.id],
        parent: 'leafSteps',
      }

      const step40Result = {
        id: 'step40Result',
        command: '#40 /summarize summarize',
        parent: 'leafSteps',
      }

      // Mock createDeepClone to handle nested foreach structures
      createDeepClone
        .mockReturnValueOnce([nestedForeachDownloadResult])
        .mockReturnValueOnce([nestedForeachFileResult, nestedStepResult])

      // Mock runCommand to return the expected steps result
      runCommand.mockImplementationOnce(() => {
        ;[
          step10Result,
          step20Result,
          step40Result,
          nestedForeachDownloadResult,
          nestedForeachFileResult,
          nestedStepResult,
        ].map(node => mockStore.createNode(node))
      })

      // Execute the foreach command
      await command.run(foreachNode)
      const result = mockStore.getOutput()

      // Verify that runCommand was called for the steps command on the leaf node
      const callArgs = runCommand.mock.calls[0][0]
      expect(callArgs).toEqual(
        expect.objectContaining({
          queryType: 'steps',
          cell: expect.objectContaining({
            id: 'leaf',
            title: 'Информационный аспект экономической безопасности',
            command: '/steps Информационный аспект экономической безопасности',
          }),
        }),
      )

      // Verify that createDeepClone was called for the nested foreach nodes
      expect(createDeepClone).toHaveBeenCalledTimes(1)
      expect(createDeepClone).toHaveBeenCalledWith(
        expect.objectContaining({
          // To be fixed
          // title: 'Данные для главы со ссылками',
          // command: '#20 /scholar --xxs --citation  ``` Информационный аспект экономической безопасности ```',
          title: 'Данные для главы со ссылками',
        }),
        expect.anything(),
        expect.anything(),
      )

      // Verify the result contains all expected nodes
      expect(result.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command:
              '#10 /chatgpt для главы ``` Информационный аспект экономической безопасности ``` напиши план главы',
          }),
          expect.objectContaining({
            command: '#20 /scholar --xxs --citation  ``` Информационный аспект экономической безопасности ```',
          }),
          expect.objectContaining({command: '#40 /summarize summarize'}),
          expect.objectContaining({command: '/foreach /download --max_size=2mb --max_pages=2 @@ Citation: @@link'}),
          expect.objectContaining({command: '/foreach --file /steps'}),
        ]),
      )
    })

    it('should execute nested foreach with file steps on a citation file attachment', async () => {
      // Setup:
      //
      // parentNode
      //   /foreach /steps
      //     [title: "План главы"] #10 /chatgpt для главы ``` @@ ``` скопируй название главы и напиши план содержимого этой главы, не больше 5-ти пунктов
      //     [title: "Данные для главы со ссылками"] #20 /scholar --xxs --citation  ``` @@ ```
      //       /foreach /download --max_size=2mb --max_pages=2 @@ Citation: @@link
      //       /foreach --file /steps
      //         #10 /summarize figure out author and title of this academic study --xxs
      //     [title: "Суммаризация"]#40 /summarize summarize
      //   Информационный аспект экономической безопасности
      //     #10 /chatgpt для главы ``` Информационный аспект экономической безопасности ``` напиши план главы
      //     #20 /scholar --xxs --citation  ``` Информационный аспект экономической безопасности ```
      //       /foreach /download --max_size=2mb --max_pages=2 @@ Citation: @@link
      //       /foreach --file /steps
      //         #10 /summarize figure out author and title of this academic study --xxs
      //       Информационный аспект заключается в этом...
      //       Citations:
      //         - http://localhost/1.pdf
      //           1.pdf [this cell contains file attachment]
      //     #40 /summarize summarize
      //
      // Expected result: The nested foreach with file executes on the file node, creating the step structure

      jest.clearAllMocks()

      // Create the nested step structure for the file foreach
      const nestedStepNode = {
        id: 'nestedStep',
        title: '#10 /summarize figure out author and title of this academic study --xxs',
        parent: 'nestedForeachFile',
      }

      // Create the foreach --file node that will be executed
      const nestedForeachFile = {
        id: 'nestedForeachFile',
        command: '/foreach --file /steps',
        children: [nestedStepNode.id],
        parent: 'scholarResult',
      }

      // Create the file node structure (this mimics a file that was attached to a citation)
      const fileNode = {
        id: 'fileNode',
        title: '1.pdf',
        file: 'file-id', // File attachment indicator
        parent: 'citation',
      }

      // Create citation URL node
      const citationNode = {
        id: 'citation',
        title: 'http://localhost/1.pdf',
        children: [fileNode.id],
        parent: 'citations',
      }

      // Create citations container node
      const citationsNode = {
        id: 'citations',
        title: 'Citations:',
        children: [citationNode.id],
        parent: 'scholarResult',
      }

      // Create scholar result node with summary text
      const scholarResultNode = {
        id: 'scholarResult',
        title: 'Информационный аспект заключается в этом...',
        children: [citationsNode.id, nestedForeachFile.id], // The foreach --file command is a sibling to citations
        parent: 'scholarCommand',
      }

      // Create the main structure (scholar command and its parent)
      const scholarCommandNode = {
        id: 'scholarCommand',
        command: '#20 /scholar --xxs --citation  ``` Информационный аспект экономической безопасности ```',
        children: [scholarResultNode.id],
        parent: 'chapterNode',
      }

      mockStore._nodes = {
        [nestedStepNode.id]: nestedStepNode,
        [nestedForeachFile.id]: nestedForeachFile,
        [fileNode.id]: fileNode,
        [citationNode.id]: citationNode,
        [citationsNode.id]: citationsNode,
        [scholarResultNode.id]: scholarResultNode,
        [scholarCommandNode.id]: scholarCommandNode,
      }

      // Mock files content map with file ID
      mockStore._files = {
        'file-id': 'This is the content of the PDF file about information security aspects.',
      }

      // Configure StepsCommand mock for the nested foreach
      const stepsCommandInstance = {
        findMatchingNodes: jest.fn().mockReturnValue({
          nodesByOrder: {
            10: [{node: nestedStepNode, promptString: nestedStepNode.title}],
          },
          nodesWithoutOrder: [],
        }),
      }
      jest.spyOn(require('./StepsCommand'), 'StepsCommand').mockImplementation(() => stepsCommandInstance)

      // Expected result node from the steps command
      const expectedStepResult = {
        id: 'fileStepResult',
        command: '#10 /summarize figure out author and title of this academic study --xxs',
        parent: 'fileStepsNode',
      }

      // Mock runCommand to return the expected steps result
      runCommand.mockImplementationOnce(() => {
        mockStore.createNode(expectedStepResult)
      })

      // Execute the nested foreach command (the one with --file flag)
      await command.run(nestedForeachFile)
      const result = mockStore.getOutput()

      // Verify that runCommand was called for the file node
      const callArgs = runCommand.mock.calls[0][0]
      expect(callArgs).toEqual(
        expect.objectContaining({
          queryType: 'steps',
          cell: expect.objectContaining({
            id: 'fileNode',
            title: '1.pdf',
            file: 'file-id',
            command: '/steps 1.pdf',
          }),
        }),
      )

      // Verify that the result contains the expected node
      expect(result.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'fileStepResult',
            command: '#10 /summarize figure out author and title of this academic study --xxs',
          }),
        ]),
      )
    })

    it('should call runCommand and provide progress in parallel', async () => {
      const child1 = {id: 'c1', title: 'Child1'}
      const child2 = {id: 'c2', command: '/foreach /chatgpt prompt', parent: 'p'}
      const parentNode = {id: 'p', parent: 'root', title: 'ParentNode', children: [child1.id, child2.id]}

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
        [parentNode.id]: parentNode,
      }

      runCommand.mockResolvedValueOnce({nodes: [{id: 'node1', command: '/chatgpt prompt'}]})
      const childProgress = new ProgressReporter({title: 'root'})

      const command = new ForeachCommand(userId, workflowId, mockStore, childProgress)
      await command.run(child2)

      const callArgs1 = runCommand.mock.calls[0]
      expect(callArgs1).toEqual([expect.anything(), expect.objectContaining({title: 'parallel'})])
    })

    it('should call runCommand and provide progress', async () => {
      const child1 = {id: 'c1', title: 'Child1'}
      const child2 = {id: 'c2', command: '/foreach /chatgpt prompt --parallel=no', parent: 'p'}
      const parentNode = {id: 'p', parent: 'root', title: 'ParentNode', children: [child1.id, child2.id]}

      mockStore._nodes = {
        [child1.id]: child1,
        [child2.id]: child2,
        [parentNode.id]: parentNode,
      }

      runCommand.mockResolvedValueOnce({nodes: [{id: 'node1', command: '/chatgpt prompt'}]})
      const childProgress = new ProgressReporter({title: 'root'})

      const command = new ForeachCommand(userId, workflowId, mockStore, childProgress)
      await command.run(child2)

      const callArgs1 = runCommand.mock.calls[0]
      expect(callArgs1).toEqual([expect.anything(), expect.objectContaining({title: 'sequential'})])
    })
  })

  describe('executePrompts', () => {
    it('should skip errors when execute in parallel', async () => {
      const nodes = [
        {node: {}, promptString: '/chatgpt prompt'},
        {node: {}, promptString: '/chatgpt prompt'},
        {node: {}, promptString: '/chatgpt prompt'},
      ]

      jest.resetAllMocks()

      runCommand.mockImplementationOnce(() => {
        ;[{id: 'n1'}, {id: 'n2'}].map(node => mockStore.createNode(node))
      })
      runCommand.mockRejectedValueOnce(new Error('Expected test error'))
      runCommand.mockImplementationOnce(() => {
        ;[{id: 'n5'}, {id: 'n6'}].map(node => mockStore.createNode(node))
      })

      await command.executePrompts(nodes)
      const {nodes: outputNodes} = mockStore.getOutput()

      expect(outputNodes.map(({id}) => id)).toEqual(expect.arrayContaining(['n1', 'n2', 'n5', 'n6']))
    })

    it('should skip errors when execute sequentially', async () => {
      const t = command.logError
      command.logError = jest.fn().mockReturnValue()

      const nodes = [
        {node: {}, promptString: '/chatgpt prompt'},
        {node: {}, promptString: '/chatgpt prompt'},
        {node: {}, promptString: '/chatgpt prompt'},
      ]

      runCommand.mockImplementationOnce(() => {
        ;[{id: 'n1'}, {id: 'n2'}].map(node => mockStore.createNode(node))
      })
      runCommand.mockImplementationOnce(() => {
        ;[{id: 'n3'}, {id: 'n4'}].map(node => mockStore.createNode(node))
      })
      runCommand.mockImplementationOnce(() => {
        ;[{id: 'n5'}, {id: 'n6'}].map(node => mockStore.createNode(node))
      })

      await command.executePrompts(nodes, false)
      const {nodes: outputNodes} = mockStore.getOutput()

      expect(outputNodes.map(({id}) => id)).toEqual(expect.arrayContaining(['n1', 'n2', 'n5', 'n6']))

      command.logError = t
    })

    it('should output errors to log when execute in parallel', async () => {
      const t = command.logError
      command.logError = jest.fn().mockReturnValue()

      const nodes = [
        {node: {}, promptString: '/chatgpt prompt'},
        {node: {}, promptString: '/chatgpt prompt'},
        {node: {}, promptString: '/chatgpt prompt'},
      ]

      const err = new Error('Expected test error')
      runCommand.mockResolvedValueOnce({nodes: [{id: 'n1'}, {id: 'n2'}]})
      runCommand.mockRejectedValueOnce(err)
      runCommand.mockResolvedValueOnce({nodes: [{id: 'n5'}, {id: 'n6'}]})

      await command.executePrompts(nodes)

      expect(command.logError).toHaveBeenCalledWith(err)

      command.logError = t
    })

    it('should output errors to log when execute sequentially', async () => {
      const t = command.logError
      command.logError = jest.fn().mockReturnValue()

      const nodes = [
        {node: {}, promptString: '/chatgpt prompt'},
        {node: {}, promptString: '/chatgpt prompt'},
        {node: {}, promptString: '/chatgpt prompt'},
      ]

      const err = new Error('Expected test error')
      runCommand.mockResolvedValueOnce({nodes: [{id: 'n1'}, {id: 'n2'}]})
      runCommand.mockRejectedValueOnce(err)
      runCommand.mockResolvedValueOnce({nodes: [{id: 'n5'}, {id: 'n6'}]})

      await command.executePrompts(nodes, false)

      expect(command.logError).toHaveBeenCalledWith(err)

      command.logError = t
    })

    it('should report progress when execute in parallel', async () => {
      command.progress = new ProgressReporter({title: 'root'})

      const nodes = [
        {node: {}, promptString: '/chatgpt prompt'},
        {node: {}, promptString: '/chatgpt prompt'},
        {node: {}, promptString: '/chatgpt prompt'},
      ]

      runCommand.mockResolvedValueOnce({nodes: [{id: 'n1'}, {id: 'n2'}]})
      runCommand.mockRejectedValueOnce(new Error('Expected test error'))
      runCommand.mockResolvedValueOnce({nodes: [{id: 'n5'}, {id: 'n6'}]})

      await command.executePrompts(nodes)

      expect(command.progress.lastChild.add).toHaveBeenCalledTimes(3)
      expect(command.progress.lastChild.remove).toHaveBeenCalledTimes(2)
      expect(command.progress.lastChild.dispose).toHaveBeenCalledTimes(1)
    })

    it('should report progress when execute sequentially', async () => {
      const t = command.logError
      command.logError = jest.fn().mockReturnValue()
      command.progress = new ProgressReporter({title: 'root'})

      const nodes = [
        {node: {}, promptString: '/chatgpt prompt'},
        {node: {}, promptString: '/chatgpt prompt'},
        {node: {}, promptString: '/chatgpt prompt'},
      ]

      runCommand.mockResolvedValueOnce({nodes: [{id: 'n1'}, {id: 'n2'}]})
      runCommand.mockRejectedValueOnce(new Error('Expected test error'))
      runCommand.mockResolvedValueOnce({nodes: [{id: 'n5'}, {id: 'n6'}]})

      await command.executePrompts(nodes, false)
      const {nodes: outputNodes} = mockStore.getOutput()

      expect(outputNodes.map(({id}) => id)).toEqual(expect.arrayContaining(['n1', 'n2', 'n5', 'n6']))

      command.logError = t
    })
  })

  describe('_processLeaf', () => {
    beforeEach(() => {
      mockStore._nodes = {}
      mockStore._edges = {}
    })

    it('should substitute command to newNode command', async () => {
      const promptString = '/chatgpt say hello to barsik'
      const leaf = {
        title: 'Leaf',
        command: undefined,
        children: [],
      }
      const node = {
        title: undefined,
        command: '/chatgpt say hello to @@',
        children: [],
      }

      const matchingNode = {
        node,
        promptString,
      }

      await command._processLeaf(leaf, matchingNode)
      const {nodes: result} = mockStore.getOutput()

      expect(result[0].command).toBe(promptString)
      expect(result[0].title).toBe(undefined)
    })

    it('should substitute command to newNode title and command №1', async () => {
      const promptString = '/chatgpt say hello to barsik'
      const leaf = {
        title: 'Leaf',
        command: undefined,
        children: [],
      }
      const node = {
        title: '/chatgpt say hello to @@',
        command: '/chatgpt say hello to @@',
        children: [],
      }

      const matchingNode = {
        node,
        promptString,
      }

      await command._processLeaf(leaf, matchingNode)
      const {nodes: result} = mockStore.getOutput()

      expect(result[0].command).toBe(promptString)
      expect(result[0].title).toBe(promptString)
    })

    it('should substitute command to newNode command and preserve initial title', async () => {
      const promptString = '/chatgpt say hello to barsik'
      const leaf = {
        title: 'Leaf',
        command: undefined,
        children: [],
      }
      const node = {
        title: 'Test',
        command: '/chatgpt say hello to @@',
        children: [],
      }

      const matchingNode = {
        node,
        promptString,
      }

      await command._processLeaf(leaf, matchingNode)
      const {nodes: result} = mockStore.getOutput()

      expect(result[0].command).toBe(promptString)
      expect(result[0].title).toBe(node.title)
    })

    it('should remove /foreach nodes from parentNode.prompts when processing leaf', async () => {
      const foreachNode = {
        id: 'foreachNode',
        title: '/foreach something',
        command: '/foreach something',
      }
      const leaf = {
        id: 'leaf1',
        title: 'Leaf',
      }

      const matchingNode = {
        node: foreachNode,
        promptString: '/foreach something',
      }

      const orphanSpy = jest.spyOn(mockStore, 'orphanMatchingNodes').mockReturnValue()
      await command._processLeaf(leaf, matchingNode)

      expect(orphanSpy).toHaveBeenCalled()
    })
  })

  describe('runSteps', () => {
    it('should use steps title for leafs', async () => {
      const foreachNode = {
        id: 'foreachNode',
        title: '/foreach /steps Main Steps Title#_hashref',
        command: '/foreach /steps Main Steps Title #_hashref @ref',
      }
      const exampleNode = {
        id: 'exampleNode',
        title: 'Example Node',
        command: 'Example Node',
      }
      const rootNode = {id: 'rootNode', title: 'Root', children: [foreachNode.id, exampleNode.id]}
      foreachNode.parent = rootNode.id
      exampleNode.parent = rootNode.id

      mockStore._nodes = {
        foreachNode,
        exampleNode,
        rootNode,
      }

      const stepsCommandInstance = {
        findMatchingNodes: jest
          .fn()
          .mockReturnValue({nodesByOrder: [], nodesWithoutOrder: [{node: exampleNode, promptString: 'Example Node'}]}),
      }
      StepsCommand.mockImplementation(() => stepsCommandInstance)
      const executeSpy = jest.spyOn(command, 'executePrompts')

      await command.runSteps(foreachNode, {parallel: false, useFile: false})

      expect(executeSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          {node: exampleNode, promptString: '/steps Example Node Main Steps Title #_hashref @ref'},
        ]),
        expect.anything(),
      )
    })
  })
})
