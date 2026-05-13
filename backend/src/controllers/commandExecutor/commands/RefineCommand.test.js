import {RefineCommand} from './RefineCommand'
import Store from './utils/Store'

jest.mock('./utils/langchain/getLLM')

describe('RefineCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new RefineCommand(userId, workflowId, mockStore)
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(mockStore.importer, 'createNodes')
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

  describe('run — error handling', () => {
    let node

    beforeEach(() => {
      node = {id: 'n', title: '/chatgpt write summary'}
      mockStore._nodes = {[node.id]: node}
    })

    it('creates error node on the command node when replyDefault throws', async () => {
      const spy = jest.spyOn(command, 'replyDefault').mockRejectedValue(new Error('LLM connection failed'))
      await command.run(node)
      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('Error: LLM connection failed', node.id)
      spy.mockRestore()
    })

    it('creates error node on the command node when replyRefine throws', async () => {
      const refineSpy = jest.spyOn(command, 'replyRefine').mockRejectedValue(new Error('LLM connection failed'))
      const promptSpy = jest.spyOn(command, 'getRefinePrompt').mockReturnValue('some prior content')
      await command.run(node)
      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('Error: LLM connection failed', node.id)
      refineSpy.mockRestore()
      promptSpy.mockRestore()
    })

    it('logs the thrown error', async () => {
      const err = new Error('LLM connection failed')
      const replySpy = jest.spyOn(command, 'replyDefault').mockRejectedValue(err)
      const logSpy = jest.spyOn(command, 'logError')
      await command.run(node)
      expect(logSpy).toHaveBeenCalledWith(err)
      replySpy.mockRestore()
      logSpy.mockRestore()
    })

    it('does not throw to caller when LLM throws', async () => {
      const spy = jest.spyOn(command, 'replyDefault').mockRejectedValue(new Error('crash'))
      await expect(command.run(node)).resolves.toBeUndefined()
      spy.mockRestore()
    })

    it('creates exactly one error node per thrown error', async () => {
      const spy = jest.spyOn(command, 'replyDefault').mockRejectedValue(new Error('crash'))
      await command.run(node)
      expect(mockStore.importer.createNodes).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })
  })
})
