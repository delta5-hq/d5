import {BaseChatModel} from 'langchain/chat_models/base'
import {RefineCommand} from './RefineCommand'
import Store from './utils/Store'

jest.mock('./utils/langchain/getLLM')

describe('RefineCommand', () => {
  const userId = 'userId'
  const mapId = 'mapId'
  const mockStore = new Store({
    userId,
    mapId,
    nodes: {},
  })
  const command = new RefineCommand(userId, mapId, mockStore)
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should should concatenate substituted reference', () => {
    const refNode = {id: 'ref', title: '@ref story about cat'}
    const child1 = {id: 'child1', title: '@@ref'}
    const child2 = {id: 'child2', title: 'Some story'}
    const mockNode = {
      id: 'mockNodeId',
      command: '/chatgpt write summary',
      title: 'Summary',
      children: [child1.id, child2.id],
    }
    mockStore._nodes = {
      [mockNode.id]: mockNode,
      [child1.id]: child1,
      [child2.id]: child2,
      [refNode.id]: refNode,
    }
    const result = command.getRefinePrompt(mockNode)

    expect(result).toContain('story about cat')
  })

  it('should call replyDefault when no refine prompt', async () => {
    const mockNode = {
      id: 'mockNodeId',
      command: '/chatgpt write summary',
      title: 'Summary',
    }
    mockStore._nodes = {
      [mockNode.id]: mockNode,
    }

    const spy = jest.spyOn(command, 'replyDefault')
    await command.run(mockNode)

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('should call replyRefine when refine prompt is present', async () => {
    const child1 = {id: 'child1', title: 'Child2'}
    const child2 = {id: 'child2', title: 'Child1'}
    const mockNode = {
      id: 'mockNodeId',
      command: '/chatgpt write summary',
      title: 'Summary',
      children: [child1.id, child2.id],
    }
    mockStore._nodes = {
      [mockNode.id]: mockNode,
      [child1.id]: child1,
      [child2.id]: child2,
    }

    const spy = jest.spyOn(command, 'replyRefine')
    await command.run(mockNode)

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('should succesfully return result', async () => {
    const node = {id: 'n', title: '/chatgpt write summary'}
    mockStore._nodes = {
      [node.id]: node,
    }

    const spy = jest.spyOn(command, 'replyDefault').mockResolvedValue('Result')
    await command.run(node)
    const result = mockStore.getOutput()

    expect(result.nodes).toEqual(expect.arrayContaining([expect.objectContaining({title: 'Result', parent: node.id})]))
    spy.mockRestore()
  })

  it('should return empty array when reply result is undefined', async () => {
    const node = {id: 'n', title: '/chatgpt write summary'}
    mockStore._nodes = {
      [node.id]: node,
    }

    const spy = jest.spyOn(command, 'replyDefault').mockResolvedValue(undefined)
    await command.run(node)
    const result = mockStore.getOutput()

    expect(result.nodes).toEqual([])
    spy.mockRestore()
  })

  it('should return empty array when llm throw error with replyDefault', async () => {
    const node = {id: 'n', title: '/chatgpt write summary'}
    mockStore._nodes = {
      [node.id]: node,
    }

    const spy = jest.spyOn(BaseChatModel, 'call').mockRejectedValue()
    await command.run(node)
    const result = mockStore.getOutput()

    expect(result.nodes).toEqual([])
    spy.mockRestore()
  })

  it('should return empty array when llm throw error with replyRefine', async () => {
    const node = {id: 'n', title: '/chatgpt write summary'}
    mockStore._nodes = {
      [node.id]: node,
    }

    const spy = jest.spyOn(BaseChatModel, 'call').mockRejectedValue()
    const getRefineSpy = jest.spyOn(command, 'getRefinePrompt').mockReturnValue(true)
    await command.run(node)
    const result = mockStore.getOutput()

    expect(result.nodes).toEqual([])
    spy.mockRestore()
    getRefineSpy.mockRestore()
  })
})
