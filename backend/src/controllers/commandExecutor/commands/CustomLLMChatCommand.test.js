import {CustomLLMChatCommand} from './CustomLLMChatCommand'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {CustomLLMChat} from './utils/langchain/CustomLLMChat'
import Store from './utils/Store'

jest.mock('./utils/langchain/getLLM', () => ({
  getIntegrationSettings: jest.fn(),
}))

jest.mock('./utils/langchain/CustomLLMChat', () => ({
  CustomLLMChat: jest.fn(),
}))

jest.mock('./references/substitution', () => ({
  substituteReferencesAndHashrefsChildrenAndSelf: jest.fn(() => 'substituted prompt'),
}))

jest.mock('./references/utils/referencePatterns', () => ({
  referencePatterns: {
    withAssignmentPrefix: jest.fn(() => ({test: jest.fn(() => false)})),
  },
}))

describe('CustomLLMChatCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'

  const createCommand = () => {
    const store = new Store({userId, workflowId, nodes: {}})
    store.importer.createNodes = jest.fn()
    store.importer.createErrorNode = jest.fn()
    return {command: new CustomLLMChatCommand(userId, workflowId, store), store}
  }

  beforeEach(() => {
    jest.clearAllMocks()
    CustomLLMChat.mockImplementation(() => ({invoke: jest.fn().mockResolvedValue({content: 'custom response'})}))
  })

  it('creates an actionable error node when Custom LLM settings are absent', async () => {
    const {command, store} = createCommand()
    getIntegrationSettings.mockResolvedValue({})

    await command.run({id: 'node', command: '/custom Reply CUSTOM_OK'}, null, '/custom Reply CUSTOM_OK')

    expect(store.importer.createErrorNode).toHaveBeenCalledWith(
      'Error: Custom LLM API root URL not configured. Set it in Integration Settings before running /custom.',
      'node',
    )
    expect(CustomLLMChat).not.toHaveBeenCalled()
    expect(store.importer.createNodes).not.toHaveBeenCalled()
  })

  it.each([
    ['empty string', ''],
    ['blank string', '   '],
    ['missing protocol', 'localhost:8000'],
    ['unsupported protocol', 'ftp://localhost:8000'],
  ])('rejects invalid Custom LLM API root URL: %s', async (_label, apiRootUrl) => {
    const {command, store} = createCommand()
    getIntegrationSettings.mockResolvedValue({custom_llm: {apiRootUrl}})

    await command.run({id: 'node', command: '/custom prompt'}, null, '/custom prompt')

    expect(store.importer.createErrorNode.mock.calls[0][0]).toMatch(/^Error: Custom LLM API root URL/)
    expect(CustomLLMChat).not.toHaveBeenCalled()
  })

  it('uses normalized configured Custom LLM settings and writes successful output', async () => {
    const {command, store} = createCommand()
    getIntegrationSettings.mockResolvedValue({
      custom_llm: {
        apiRootUrl: ' https://custom.example/v1/ ',
        apiType: 'openai-compatible',
        apiKey: ' key ',
      },
    })

    await command.run({id: 'node', command: '/custom prompt'}, null, '/custom prompt')

    expect(CustomLLMChat).toHaveBeenCalledWith({
      apiRootUrl: 'https://custom.example/v1',
      apiType: 'openai-compatible',
      apiKey: 'key',
    })
    expect(store.importer.createNodes).toHaveBeenCalledWith('custom response', 'node')
    expect(store.importer.createErrorNode).not.toHaveBeenCalled()
  })
})
