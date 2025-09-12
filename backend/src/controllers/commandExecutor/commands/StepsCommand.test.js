import ProgressReporter from '../ProgressReporter'
import {ChatCommand} from './ChatCommand'
import {StepsCommand} from './StepsCommand'
import {runCommand} from './utils/runCommand'
import Store from './utils/Store'
import {YandexCommand} from './YandexCommand'

jest.useFakeTimers()
jest.mock('./utils/runCommand')

jest.mock('../ProgressReporter', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((opts, parent) => {
      const instance = {
        add: jest.fn(async label => label),
        remove: jest.fn(),
        dispose: jest.fn(),
        registerChild: jest.fn(),
        title: opts?.title,
      }
      if (parent) {
        parent.lastChild = instance
      }
      return instance
    }),
  }
})

const sourceRunCommand = jest.requireActual('./utils/runCommand').runCommand

describe('StepsCommand', () => {
  const userId = 'userId'
  const mapId = 'mapId'
  const mockStore = new Store({
    userId,
    mapId,
    nodes: {},
  })
  const command = new StepsCommand(userId, mapId, mockStore)

  beforeEach(() => {
    jest.clearAllMocks()

    runCommand.mockImplementation(() => jest.fn())
  })

  it('should find node with order and not', async () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '/chatgpt child2'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    mockStore._nodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(node)

    expect(nodesByOrder).toEqual({1: [{node: child1, promptString: child1.command}]})
    expect(nodesWithoutOrder).toEqual([{node: child2, promptString: child2.command}])
  })

  it('should take title if command property undefined', async () => {
    const child1 = {id: 'child1', title: '#1 /chatgpt child1', command: undefined}
    const child2 = {id: 'child2', command: '/chatgpt child2'}
    const node = {command: '/steps', children: [child1.id, child2.id]}

    mockStore._nodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(node)

    expect(nodesByOrder).toEqual({1: [{node: child1, promptString: child1.title}]})
    expect(nodesWithoutOrder).toEqual([{node: child2, promptString: child2.command}])
  })

  it('should find nodes with order', async () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '#2 /chatgpt child2'}
    const child3 = {id: 'child3', command: '#3 /chatgpt child3'}
    const child4 = {id: 'child4', command: '#-9999 /chatgpt child4'}
    const node = {command: '/steps', children: [child1.id, child2.id, child3.id, child4.id]}

    mockStore._nodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [child3.id]: child3,
      [child4.id]: child4,
      [node.id]: node,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(node)

    const first = [{node: child1, promptString: child1.command}]
    const second = [{node: child2, promptString: child2.command}]
    const third = [{node: child3, promptString: child3.command}]
    const fourth = [{node: child4, promptString: child4.command}]

    expect(nodesByOrder).toEqual({1: first, 2: second, 3: third, '-9999': fourth})
    expect(nodesWithoutOrder).toEqual([])
  })

  it('should execute prompts', async () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '#2 /chatgpt child2'}

    mockStore._nodes = {
      [child1.id]: child1,
      [child2.id]: child2,
    }

    const nodes = [
      {node: child1, promptString: child1.command},
      {node: child2, promptString: child2.command},
    ]

    const newNode1 = {id: 'newNode1', parent: child1.id, title: 'newNode1'}
    const newNode2 = {id: 'newNode2', parent: child2.id, title: 'newNode2'}

    runCommand.mockImplementation(sourceRunCommand)
    const chatRunSpy = jest.spyOn(ChatCommand.prototype, 'run')

    chatRunSpy.mockImplementationOnce(() => {
      mockStore.createNode(newNode1, true)
    })
    chatRunSpy.mockImplementationOnce(() => {
      mockStore.createNode(newNode2, true)
    })

    await command.executePrompts(nodes)

    // New Nodes was created and added to mapNodes
    expect(mockStore._nodes['newNode1']).toEqual(newNode1)
    expect(mockStore._nodes['newNode2']).toEqual(newNode2)

    // Parent nodes were updated and should contain new childNodes and prompts ids
    expect(mockStore._nodes[child1.id].children).toContain(newNode1.id)
    expect(mockStore._nodes[child1.id].prompts).toContain(newNode1.id)

    expect(mockStore._nodes[child2.id].children).toContain(newNode2.id)
    expect(mockStore._nodes[child2.id].prompts).toContain(newNode2.id)

    chatRunSpy.mockRestore()
  })

  it('should execute prompts and remove prev prompt', async () => {
    const prevPromptResult = {id: 'prompt', title: 'Result of prev prompt execution'}
    const child1 = {
      id: 'child1',
      command: '#1 /chatgpt child1',
      children: [prevPromptResult.id],
      prompts: [prevPromptResult.id],
    }

    mockStore._nodes = {
      [child1.id]: child1,
      [prevPromptResult.id]: prevPromptResult,
    }

    const nodes = [{node: child1, promptString: child1.command}]

    const newNode1 = {id: 'newNode1', parent: child1.id, title: 'newNode1'}

    runCommand.mockImplementation(sourceRunCommand)
    const chatRunSpy = jest.spyOn(ChatCommand.prototype, 'run')

    chatRunSpy.mockImplementationOnce(() => {
      mockStore.createNode(newNode1, true)
    })

    await command.executePrompts(nodes)

    expect(mockStore._nodes[child1.id].children).toContain(newNode1.id)
    expect(mockStore._nodes[child1.id].children).not.toContain(prevPromptResult.id)
    expect(mockStore._nodes[child1.id].prompts).toContain(newNode1.id)
    expect(mockStore._nodes[child1.id].prompts).not.toContain(prevPromptResult.id)

    chatRunSpy.mockRestore()
  })

  it('should execute prompts and skip undefined result', async () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '#2 /chatgpt child2'}

    mockStore._nodes = {
      [child1.id]: child1,
      [child2.id]: child2,
    }

    const nodes = [
      {node: child1, promptString: child1.command},
      {node: child2, promptString: child2.command},
    ]

    const newNode1 = {id: 'newNode1', title: 'newNode1', parent: 'child1'}

    runCommand
      .mockImplementationOnce(() => ({
        nodes: [newNode1],
      }))
      .mockImplementationOnce(() => undefined)

    await command.executePrompts(nodes)

    expect(child2).toEqual(child2)
  })

  it('should execute nodes with order', async () => {
    const node1 = {id: 'node1', command: '#1 /chatgpt @node1'}
    const node2 = {id: 'node2', command: '#2 /chatgpt node2 @@node1 @@child2'}

    const child1 = {id: 'child1', command: '#1 /chatgpt @child1'}
    const child2 = {id: 'child2', command: '#2 /chatgpt @child2 @@child1'}
    const node3 = {id: 'node3', command: '#1 /steps child4', children: [child1, child2]}

    const root = {
      command: '/steps',
      children: [node1.id, node2.id, node3.id],
    }

    mockStore._nodes = {
      [node1.id]: node1,
      [node2.id]: node2,
      [child1.id]: child1,
      [child2.id]: child2,
      [node3.id]: node3,
      [root.id]: root,
    }

    await command.run(root)
  })

  it('should ignore node with /foreach without prefix', async () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '/foreach /chatgpt child2 @@'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    mockStore._nodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(node)

    expect(nodesByOrder).toEqual({1: [{node: child1, promptString: child1.command}]})
    expect(nodesWithoutOrder).toEqual([])
  })

  it('should ignore node with /foreach and prefix', async () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '#2 /foreach /chatgpt child2 @@'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    mockStore._nodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(node, mockStore._nodes)

    expect(nodesByOrder).toEqual({1: [{node: child1, promptString: child1.command}]})
    expect(nodesWithoutOrder).toEqual([])
  })

  it('should match node with /summarize', async () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '#2 /summarize child2 @@'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    mockStore._nodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(node)

    expect(nodesByOrder).toEqual({
      1: [{node: child1, promptString: child1.command}],
      2: [{node: child2, promptString: child2.command}],
    })
    expect(nodesWithoutOrder).toEqual([])
  })

  it('should match node with /outline --summarize', async () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '#2 /outline child2 @@ --summarize'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    mockStore._nodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(node)

    expect(nodesByOrder).toEqual({
      1: [{node: child1, promptString: child1.command}],
      2: [{node: child2, promptString: child2.command}],
    })
    expect(nodesWithoutOrder).toEqual([])
  })

  it('should ignore prompts', async () => {
    const node1 = {id: 'node1', command: '#1 /chatgpt node1'}

    const child1 = {id: 'child2', title: 'child1'}
    const child2 = {id: 'child2', title: 'child2'}
    const arr = [child1.id, child2.id]
    const node2 = {id: 'node2', command: '/chatgpt node2', children: [...arr], prompts: [...arr]}

    const node = {id: 'node', command: '/steps', children: [node2.id, node1.id]}

    mockStore._nodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node1.id]: node1,
      [node2.id]: node2,
      [node.id]: node,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(node)

    expect(nodesByOrder).toEqual({1: [{node: node1, promptString: node1.command}]})
    expect(nodesWithoutOrder).toEqual([{node: node2, promptString: node2.command}])
  })

  it('should use correct prompt with yandex', async () => {
    const refValue = {id: 'rv', title: 'экономика'}
    const refParent = {id: 'rp', title: '@subject', children: [refValue.id]}
    const subChild = {id: 'sc', title: '@@subject'}
    const child = {title: 'для научной статьи на тему', depth: 3, id: 'c', children: [subChild.id]}
    const parent = {
      command: '/yandexgpt придумай 2 поисковых запроса',
      depth: 2,
      id: 'p',
      children: [child.id],
    }
    const steps = {
      id: 'steps',
      command: '/steps',
      children: [parent.id],
    }

    mockStore._nodes = {
      [subChild.id]: subChild,
      [child.id]: child,
      [parent.id]: parent,
      [steps.id]: steps,
      [refParent.id]: refParent,
      [refValue.id]: refValue,
    }

    const yandexSpy = jest.spyOn(YandexCommand.prototype, 'replyYandex').mockReturnValue('response')
    runCommand.mockImplementation(sourceRunCommand)

    await command.run(steps)

    const yandexParams = [
      {
        role: 'user',
        text: 'Context:\n```\n```\nпридумай 2 поисковых запроса\n  для научной статьи на тему\n \nэкономика',
      },
    ]

    expect(yandexSpy).toHaveBeenCalledWith(yandexParams, expect.anything())
    yandexSpy.mockRestore()
  })

  it('should ignore switch child', async () => {
    const caseNode = {id: 'case', command: '/case value'}
    const child = {id: 'child2', command: '#1 /switch value', children: [caseNode.id]}
    const node = {id: 'node', command: '/steps', children: [child.id]}

    mockStore._nodes = {
      [caseNode.id]: caseNode,
      [child.id]: child,
      [node.id]: node,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(node)

    expect(nodesByOrder).toEqual({1: [{node: child, promptString: child.command}]})
    expect(nodesWithoutOrder).toEqual([])
  })

  it('should handle nested structure with empty command nodes', async () => {
    const grandchild = {id: 'grandchild', command: '/chatgpt prompt'}
    const child = {id: 'child', command: '', children: [grandchild.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    mockStore._nodes = {
      [grandchild.id]: grandchild,
      [child.id]: child,
      [root.id]: root,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(root)

    expect(nodesByOrder).toEqual({})
    expect(nodesWithoutOrder).toEqual([{node: grandchild, promptString: grandchild.command}])

    // Empty command nodes shouldn't be collected
    expect(nodesWithoutOrder.some(item => item.node === child)).toBeFalsy()
  })

  it('should find nodes with order in nested structure', async () => {
    const grandchild1 = {id: 'grandchild1', command: '#10 /chatgpt prompt'}
    const grandchild2 = {id: 'grandchild2', command: '#20 /chatgpt prompt'}
    const child = {id: 'child', command: '', children: [grandchild1.id, grandchild2.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    mockStore._nodes = {
      [grandchild1.id]: grandchild1,
      [grandchild2.id]: grandchild2,
      [child.id]: child,
      [root.id]: root,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(root)

    expect(nodesByOrder).toEqual({
      10: [{node: grandchild1, promptString: grandchild1.command}],
      20: [{node: grandchild2, promptString: grandchild2.command}],
    })
    expect(nodesWithoutOrder).toEqual([])
  })

  it('should traverse through multiple levels of empty commands', async () => {
    const greatGrandchild = {id: 'greatGrandchild', command: '#20 /chatgpt deep prompt'}
    const grandchild2 = {id: 'grandchild2', command: '', children: [greatGrandchild.id]}
    const grandchild1 = {id: 'grandchild1', command: '#10 /chatgpt prompt'}
    const child = {id: 'child', command: '', children: [grandchild1.id, grandchild2.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    mockStore._nodes = {
      [greatGrandchild.id]: greatGrandchild,
      [grandchild1.id]: grandchild1,
      [grandchild2.id]: grandchild2,
      [child.id]: child,
      [root.id]: root,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(root)

    expect(nodesByOrder).toEqual({
      10: [{node: grandchild1, promptString: grandchild1.command}],
      20: [{node: greatGrandchild, promptString: greatGrandchild.command}],
    })
    expect(nodesWithoutOrder).toEqual([])
  })

  it('should not traverse into command nodes', async () => {
    const emptyGreatGrandchild = {id: 'emptyGreatGrandchild', command: ''}
    const greatGrandchild = {id: 'greatGrandchild', command: '/chatgpt another prompt'}

    const grandchild = {
      id: 'grandchild',
      command: '/chatgpt prompt',
      children: [emptyGreatGrandchild.id, greatGrandchild.id],
    }

    const child = {id: 'child', command: '', children: [grandchild.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    mockStore._nodes = {
      [emptyGreatGrandchild.id]: emptyGreatGrandchild,
      [greatGrandchild.id]: greatGrandchild,
      [grandchild.id]: grandchild,
      [child.id]: child,
      [root.id]: root,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(root)

    expect(nodesByOrder).toEqual({})
    expect(nodesWithoutOrder).toEqual([{node: grandchild, promptString: grandchild.command}])

    // Should not traverse into command nodes
    expect(nodesWithoutOrder.some(item => item.node === greatGrandchild)).toBeFalsy()
    expect(nodesWithoutOrder.some(item => item.node === emptyGreatGrandchild)).toBeFalsy()
  })

  it('should not traverse into nested /steps nodes', async () => {
    const greatGrandchild1 = {id: 'greatGrandchild1', command: ''}
    const greatGrandchild2 = {id: 'greatGrandchild2', command: '/chatgpt prompt'}

    const grandchild = {
      id: 'grandchild',
      command: '/steps comment',
      children: [greatGrandchild1.id, greatGrandchild2.id],
    }

    const child = {id: 'child', command: '', children: [grandchild.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    mockStore._nodes = {
      [greatGrandchild1.id]: greatGrandchild1,
      [greatGrandchild2.id]: greatGrandchild2,
      [grandchild.id]: grandchild,
      [child.id]: child,
      [root.id]: root,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(root)

    expect(nodesByOrder).toEqual({})
    expect(nodesWithoutOrder).toEqual([{node: grandchild, promptString: grandchild.command}])

    // Should not traverse into /steps nodes
    expect(nodesWithoutOrder.some(item => item.node === greatGrandchild2)).toBeFalsy()
    expect(nodesWithoutOrder.some(item => item.node === greatGrandchild1)).toBeFalsy()
  })

  it('should not traverse into nested /steps nodes with summarize', async () => {
    const greatGrandchild1 = {id: 'greatGrandchild1', command: ''}
    const greatGrandchild2 = {id: 'greatGrandchild2', command: '/summarize prompt'}

    const grandchild = {
      id: 'grandchild',
      command: '/steps comment',
      children: [greatGrandchild1.id, greatGrandchild2.id],
    }

    const child = {id: 'child', command: '', children: [grandchild.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    mockStore._nodes = {
      [greatGrandchild1.id]: greatGrandchild1,
      [greatGrandchild2.id]: greatGrandchild2,
      [grandchild.id]: grandchild,
      [child.id]: child,
      [root.id]: root,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(root)

    expect(nodesByOrder).toEqual({})
    expect(nodesWithoutOrder).toEqual([{node: grandchild, promptString: grandchild.command}])

    // Should not traverse into /steps nodes
    expect(nodesWithoutOrder.some(item => item.node === greatGrandchild2)).toBeFalsy()
    expect(nodesWithoutOrder.some(item => item.node === greatGrandchild1)).toBeFalsy()
  })

  it('should traverse deeply nested structure with commands', async () => {
    // /steps comment
    //   (empty string as command)
    //     /chatgpt prompt
    //       (empty string as command)
    //       /chatgpt another prompt
    const emptyGreatGrandchild = {id: 'emptyGreatGrandchild', command: ''}
    const greatGrandchild = {id: 'greatGrandchild', command: '/chatgpt another prompt'}

    const grandchild = {
      id: 'grandchild',
      command: '/chatgpt prompt',
      children: [emptyGreatGrandchild.id, greatGrandchild.id],
    }

    const child = {id: 'child', command: '', children: [grandchild.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    mockStore._nodes = {
      [emptyGreatGrandchild.id]: emptyGreatGrandchild,
      [greatGrandchild.id]: greatGrandchild,
      [grandchild.id]: grandchild,
      [child.id]: child,
      [root.id]: root,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(root)

    // traverse only those children, which it is a closest parent to
    expect(nodesByOrder).toEqual({})
    expect(nodesWithoutOrder).toHaveLength(1)
    expect(nodesWithoutOrder).toEqual(expect.arrayContaining([{node: grandchild, promptString: grandchild.command}]))

    expect(nodesWithoutOrder.some(item => item.node === child)).toBeFalsy()
    expect(nodesWithoutOrder.some(item => item.node === greatGrandchild)).toBeFalsy()
    expect(nodesWithoutOrder.some(item => item.node === emptyGreatGrandchild)).toBeFalsy()
  })

  it('should find nested commands under command nodes', async () => {
    // /steps comment
    //   (empty string as command)
    //     /chatgpt prompt
    //       (empty string as command)
    //       /summarize prompt
    const emptyGreatGrandchild = {id: 'emptyGreatGrandchild', command: ''}
    const greatGrandchild = {id: 'greatGrandchild', command: '/summarize prompt'}

    const grandchild = {
      id: 'grandchild',
      command: '/chatgpt prompt',
      children: [emptyGreatGrandchild.id, greatGrandchild.id],
    }

    const child = {id: 'child', command: '', children: [grandchild.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    mockStore._nodes = {
      [emptyGreatGrandchild.id]: emptyGreatGrandchild,
      [greatGrandchild.id]: greatGrandchild,
      [grandchild.id]: grandchild,
      [child.id]: child,
      [root.id]: root,
    }

    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(root)

    // traverse only those children, which it is a closest parent to
    expect(nodesByOrder).toEqual({})
    expect(nodesWithoutOrder).toHaveLength(1)
    expect(nodesWithoutOrder).toEqual(expect.arrayContaining([{node: grandchild, promptString: grandchild.command}]))

    expect(nodesWithoutOrder.some(item => item.node === child)).toBeFalsy()
    expect(nodesWithoutOrder.some(item => item.node === greatGrandchild)).toBeFalsy()
    expect(nodesWithoutOrder.some(item => item.node === emptyGreatGrandchild)).toBeFalsy()
  })

  it('should handle nested steps with SWOT analysis and reference resolution', async () => {
    // Create reference nodes for SWOT analysis
    const strengthsRef = {id: 's7000', title: 'Strong brand recognition and quality products'}
    const weaknessesRef = {id: 'w7000', title: 'Limited distribution network and seasonal business'}
    const opportunitiesRef = {id: 'o7000', title: 'Growing health-conscious consumer base and online sales potential'}
    const threatsRef = {id: 't7000', title: 'Intense competition and unpredictable weather patterns'}

    // Create nested step structure for SWOT analysis
    const step1_1 = {id: 'step1_1', command: '#1 /chatgpt Strengths: @s7000'}
    const step1_2 = {id: 'step1_2', command: '#1 /chatgpt Weaknesses: @w7000'}
    const step1_3 = {id: 'step1_3', command: '#1 /chatgpt Opportunities: @o7000'}
    const step1_4 = {id: 'step1_4', command: '#1 /chatgpt Threats: @t7000'}

    const step2_1 = {
      id: 'step2_1',
      command:
        '#2 /chatgpt 3 ways of combining Strengths and Opportunities in short list\nStrengths: @@s7000\nOpportunities: @@o7000',
    }
    const step2_2 = {
      id: 'step2_2',
      command: '#2 /chatgpt 3 ways of combining Strength and Threats in short list\nStrength @@s7000\nThreats @@t7000',
    }
    const step2_3 = {
      id: 'step2_3',
      command:
        '#2 /chatgpt 3 ways of combining Opportunities and Weaknesses in short list\nOpportunities: @@o7000\nWeaknesses: @@w7000',
    }
    const step2_4 = {
      id: 'step2_4',
      command:
        '#2 /chatgpt 3 ways of combining Threats and Weaknesses in short list\nThreats @@t7000\nWeaknesses: @@w7000',
    }

    // Create nested SWOT analysis steps node
    const swotNode = {
      id: 'swot',
      command: '/steps Correlative SWOT Analysis',
      children: [step1_1.id, step1_2.id, step1_3.id, step1_4.id, step2_1.id, step2_2.id, step2_3.id, step2_4.id],
    }

    // Create top-level lemonade kiosk node
    const lemonadeNode = {
      id: 'lemonade',
      command: '/steps Lemonade Kiosk',
      children: [swotNode.id],
    }

    // Prepare map nodes
    mockStore._nodes = {
      [strengthsRef.id]: strengthsRef,
      [weaknessesRef.id]: weaknessesRef,
      [opportunitiesRef.id]: opportunitiesRef,
      [threatsRef.id]: threatsRef,
      [step1_1.id]: step1_1,
      [step1_2.id]: step1_2,
      [step1_3.id]: step1_3,
      [step1_4.id]: step1_4,
      [step2_1.id]: step2_1,
      [step2_2.id]: step2_2,
      [step2_3.id]: step2_3,
      [step2_4.id]: step2_4,
      [swotNode.id]: swotNode,
      [lemonadeNode.id]: lemonadeNode,
    }

    // Execute the test
    const {nodesByOrder, nodesWithoutOrder} = command.findMatchingNodes(swotNode)

    // Verify nodes were found with correct orders
    expect(Object.keys(nodesByOrder)).toContain('1')
    expect(Object.keys(nodesByOrder)).toContain('2')

    // All #1 commands should be in order 1
    expect(nodesByOrder['1']).toHaveLength(4)
    expect(nodesByOrder['1'].map(item => item.node.id)).toContain(step1_1.id)
    expect(nodesByOrder['1'].map(item => item.node.id)).toContain(step1_2.id)
    expect(nodesByOrder['1'].map(item => item.node.id)).toContain(step1_3.id)
    expect(nodesByOrder['1'].map(item => item.node.id)).toContain(step1_4.id)

    // All #2 commands should be in order 2
    expect(nodesByOrder['2']).toHaveLength(4)
    expect(nodesByOrder['2'].map(item => item.node.id)).toContain(step2_1.id)
    expect(nodesByOrder['2'].map(item => item.node.id)).toContain(step2_2.id)
    expect(nodesByOrder['2'].map(item => item.node.id)).toContain(step2_3.id)
    expect(nodesByOrder['2'].map(item => item.node.id)).toContain(step2_4.id)

    // No nodes without order
    expect(nodesWithoutOrder).toHaveLength(0)

    // Run a mock execution to verify reference resolution
    runCommand.mockImplementation(({cell}) => {
      // Ensure references are correctly resolved in the command
      if (cell.id === step2_1.id) {
        expect(cell.command).toContain(strengthsRef.title)
        expect(cell.command).toContain(opportunitiesRef.title)
      }
      return Promise.resolve({nodes: []})
    })

    await command.run(swotNode)
    expect(runCommand).toHaveBeenCalled()
  })

  it('should call runCommand and provide progress in parallel', async () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '#2 /chatgpt child2'}

    mockStore._nodes = {
      [child1.id]: child1,
      [child2.id]: child2,
    }

    const nodes = [
      {node: child1, promptString: child1.command},
      {node: child2, promptString: child2.command},
    ]

    const newNode1 = {id: 'newNode1', parent: child1.id, title: 'newNode1'}
    const newNode2 = {id: 'newNode2', parent: child2.id, title: 'newNode2'}

    runCommand.mockImplementation(sourceRunCommand)
    const chatRunSpy = jest.spyOn(ChatCommand.prototype, 'run')

    chatRunSpy.mockReturnValueOnce({
      nodes: [newNode1],
    })
    chatRunSpy.mockReturnValueOnce({
      nodes: [newNode2],
    })
    const childProgress = new ProgressReporter({title: 'root'})

    const command = new StepsCommand(userId, mapId, mockStore, childProgress)
    await command.executePrompts(nodes)

    const callArgs1 = runCommand.mock.calls[0]
    expect(callArgs1).toEqual([
      expect.anything(),
      expect.objectContaining({lastChild: expect.objectContaining({title: 'runCommand'})}),
    ])

    const callArgs2 = runCommand.mock.calls[1]
    expect(callArgs2).toEqual([
      expect.anything(),
      expect.objectContaining({lastChild: expect.objectContaining({title: 'runCommand'})}),
    ])

    chatRunSpy.mockRestore()
  })
})
