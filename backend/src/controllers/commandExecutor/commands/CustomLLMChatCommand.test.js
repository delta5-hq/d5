import {CustomLLMChatCommand} from './CustomLLMChatCommand'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings, getLLM, Model} from './utils/langchain/getLLM'
import {clearStepsPrefix} from '../constants/steps'
import Store from './utils/Store'

jest.mock('./references/substitution')
jest.mock('./utils/langchain/getLLM')
jest.mock('../constants/steps', () => ({
  clearStepsPrefix: jest.fn(str => `cleared ${str}`),
}))

const makeSettings = (overrides = {}) => ({
  custom_llm: {apiRootUrl: 'http://localhost:8080', apiKey: 'key', apiType: 'openai', model: 'gpt-4o-mini'},
  ...overrides,
})

const makeCommand = (opts = {}) => {
  const userId = opts.userId ?? 'user1'
  const workflowId = 'workflowId' in opts ? opts.workflowId : 'wf1'
  const store = new Store({userId, workflowId, nodes: {}})
  return {command: new CustomLLMChatCommand(userId, workflowId, store), store, userId, workflowId}
}

describe('CustomLLMChatCommand', () => {
  const mockInvoke = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValue('substituted prompt')
    clearStepsPrefix.mockImplementation(str => `cleared ${str}`)
    getIntegrationSettings.mockResolvedValue(makeSettings())
    mockInvoke.mockResolvedValue({content: 'llm reply'})
    getLLM.mockReturnValue({llm: {invoke: mockInvoke}})
  })

  describe('integration settings loading', () => {
    it('loads settings scoped to the command user and workflow', async () => {
      const {command, store, userId, workflowId} = makeCommand()
      const node = {id: 'n1', title: '/custom hi'}

      await command.run(node, null, 'hi')

      expect(getIntegrationSettings).toHaveBeenCalledWith(userId, workflowId, store)
    })

    it('loads settings with null workflowId when command has no workflow scope', async () => {
      const {command, store, userId} = makeCommand({workflowId: null})
      const node = {id: 'n1', title: '/custom hi'}

      await command.run(node, null, 'hi')

      expect(getIntegrationSettings).toHaveBeenCalledWith(userId, null, store)
    })
  })

  describe('LLM construction', () => {
    it('always requests CustomLLM type from getLLM', async () => {
      const {command} = makeCommand()
      const node = {id: 'n1', title: '/custom hi'}

      await command.run(node, null, 'hi')

      expect(getLLM).toHaveBeenCalledWith(expect.objectContaining({type: Model.CustomLLM}))
    })

    it('passes the full settings object returned by getIntegrationSettings to getLLM', async () => {
      const {command} = makeCommand()
      const settings = makeSettings()
      getIntegrationSettings.mockResolvedValueOnce(settings)
      const node = {id: 'n1', title: '/custom hi'}

      await command.run(node, null, 'hi')

      expect(getLLM).toHaveBeenCalledWith(expect.objectContaining({settings}))
    })

    it.each([
      ['gpt-4o-mini', 'gpt-4o-mini'],
      ['gpt-4-turbo', 'gpt-4-turbo'],
      ['claude-haiku-4-5', 'claude-haiku-4-5'],
    ])('forwards model="%s" inside settings to getLLM without alteration', async (model, expected) => {
      const {command} = makeCommand()
      getIntegrationSettings.mockResolvedValueOnce(
        makeSettings({custom_llm: {apiRootUrl: 'http://x', apiType: 'openai', model}}),
      )
      const node = {id: 'n1', title: '/custom hi'}

      await command.run(node, null, 'hi')

      const [[{settings}]] = getLLM.mock.calls
      expect(settings.custom_llm.model).toBe(expected)
    })
  })

  describe('message passing to LLM', () => {
    it('invokes the LLM returned by getLLM with the resolved prompt', async () => {
      const {command} = makeCommand()
      const node = {id: 'n1', title: '/custom hi'}

      await command.run(node, null, 'my prompt')

      expect(mockInvoke).toHaveBeenCalledTimes(1)
    })

    it('places the final prompt as a user-role message', async () => {
      const {command} = makeCommand()
      const node = {id: 'n1', title: '/custom hi'}

      await command.run(node, null, 'my prompt')

      const [[messages]] = mockInvoke.mock.calls
      expect(messages).toEqual(expect.arrayContaining([expect.objectContaining({content: expect.any(String)})]))
    })
  })

  describe('prompt resolution', () => {
    it('uses substituteReferencesAndHashrefsChildrenAndSelf when prompt is absent', async () => {
      const {command} = makeCommand()
      const node = {id: 'n1', title: '/custom hi'}

      await command.run(node, null, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('uses substituteReferencesAndHashrefsChildrenAndSelf when prompt is empty string', async () => {
      const {command} = makeCommand()
      const node = {id: 'n1', title: '/custom hi'}

      await command.run(node, null, '')

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
    })

    it('uses clearStepsPrefix when prompt is provided and title has no reference pattern', async () => {
      const {command} = makeCommand()
      const node = {id: 'n1', title: '/custom hi'}

      await command.run(node, null, 'original prompt')

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith('original prompt')
    })

    it('prepends explicit context when provided', async () => {
      const {command} = makeCommand()
      const node = {id: 'n1', title: '/custom hi'}
      clearStepsPrefix.mockImplementation(str => str)

      await command.run(node, 'CTX:', 'prompt')

      const [[messages]] = mockInvoke.mock.calls
      const userMessage = messages.find(m => m._getType?.() === 'human' || m.content?.includes('CTX:'))
      expect(userMessage?.content).toMatch(/CTX:/)
    })
  })

  describe('output', () => {
    it('creates child nodes with the LLM response text', async () => {
      const {command, store} = makeCommand()
      const createSpy = jest.spyOn(store.importer, 'createNodes')
      const node = {id: 'n1', title: '/custom hi'}
      mockInvoke.mockResolvedValueOnce({content: 'the answer'})

      await command.run(node, null, 'hi')

      expect(createSpy).toHaveBeenCalledWith('the answer', node.id)
      createSpy.mockRestore()
    })

    it('attaches output to the executed node id, not a hardcoded id', async () => {
      const {command, store} = makeCommand()
      const createSpy = jest.spyOn(store.importer, 'createNodes')
      const node = {id: 'target-node', title: '/custom hi'}

      await command.run(node, null, 'hi')

      expect(createSpy).toHaveBeenCalledWith(expect.any(String), 'target-node')
      createSpy.mockRestore()
    })
  })

  describe('error handling', () => {
    it.each([
      [
        'getLLM throws a configuration error',
        () =>
          getLLM.mockImplementationOnce(() => {
            throw new Error('Custom LLM API URL not configured.')
          }),
      ],
      [
        'getIntegrationSettings rejects',
        () => getIntegrationSettings.mockRejectedValueOnce(new Error('DB unavailable')),
      ],
      ['LLM invoke rejects', () => mockInvoke.mockRejectedValueOnce(new Error('timeout'))],
    ])('creates an error node when %s', async (_label, setupFailure) => {
      const {command, store} = makeCommand()
      setupFailure()
      const errorSpy = jest.spyOn(store.importer, 'createErrorNode')
      const node = {id: 'n1', title: '/custom hi'}

      await command.run(node, null, 'hi')

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), node.id)
      errorSpy.mockRestore()
    })

    it('does not create output nodes when an error occurs', async () => {
      const {command, store} = makeCommand()
      getLLM.mockImplementationOnce(() => {
        throw new Error('fail')
      })
      const createSpy = jest.spyOn(store.importer, 'createNodes')
      const node = {id: 'n1', title: '/custom hi'}

      await command.run(node, null, 'hi')

      expect(createSpy).not.toHaveBeenCalled()
      createSpy.mockRestore()
    })

    it('attaches the error node to the executed node id', async () => {
      const {command, store} = makeCommand()
      getLLM.mockImplementationOnce(() => {
        throw new Error('fail')
      })
      const errorSpy = jest.spyOn(store.importer, 'createErrorNode')
      const node = {id: 'target-node', title: '/custom hi'}

      await command.run(node, null, 'hi')

      expect(errorSpy).toHaveBeenCalledWith(expect.any(String), 'target-node')
      errorSpy.mockRestore()
    })

    it('does not throw out of run regardless of the failure source', async () => {
      const {command} = makeCommand()
      mockInvoke.mockRejectedValueOnce(new Error('unhandled'))
      const node = {id: 'n1', title: '/custom hi'}

      await expect(command.run(node, null, 'hi')).resolves.not.toThrow()
    })
  })
})
