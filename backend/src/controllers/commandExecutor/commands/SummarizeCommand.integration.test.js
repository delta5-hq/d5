import {BaseChain} from 'langchain/chains'
import {ChatCommand} from './ChatCommand'
import {SummarizeCommand} from './SummarizeCommand'
import {runCommand} from './utils/runCommand'
import {COMPLETION_QUERY_TYPE} from '../constants/completion'
import Store from './utils/Store'

jest.mock('./utils/langchain/getLLM', () => ({
  ...jest.requireActual('./utils/langchain/getLLM'),
  getIntegrationSettings: jest.fn().mockResolvedValue({
    openai: {
      apiKey: 'key',
      model: 'model',
    },
    yandex: {
      apiKey: 'key',
      folder_id: 'id',
      model: 'model',
    },
    model: 'OpenAI',
  }),
}))

describe('SummarizeCommand integration', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should run summarize commands and pass prompt results as context', async () => {
    const sumNode1 = {
      id: 'sumNode1',
      title: '/summarize sum1 prompt',
      command: '/summarize sum1 prompt',
    }
    const sumNode2 = {
      id: 'sumNode2',
      title: '/summarize sum2 prompt',
      command: '/summarize sum2 prompt',
    }
    const chatNode = {
      id: 'chatNode',
      title: '/chat chat prmpt',
      command: '/chat chat prompt',
      children: [sumNode1.id, sumNode2.id],
    }
    sumNode1.parent = chatNode.id
    sumNode2.parent = chatNode.id

    const store = new Store({
      userId: 'userId',
      mapId: 'mapId',
      files: {},
      nodes: {
        chatNode,
        sumNode1,
        sumNode2,
      },
    })

    jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(() => {
      const childNode = {
        id: 'chatPromptResult',
        title: 'Chat Prompt Result',
        parent: chatNode.id,
      }
      store.createNode(childNode, true)
    })

    jest
      .spyOn(BaseChain.prototype, 'call')
      .mockResolvedValueOnce({output_text: 'Sum1 response'})
      .mockResolvedValueOnce({output_text: 'Sum2 response'})

    const getDocsSpy = jest.spyOn(SummarizeCommand.prototype, 'getDocuments').mockResolvedValueOnce([])

    await runCommand({
      queryType: COMPLETION_QUERY_TYPE,
      cell: chatNode,
      store,
    })

    const sum1CallArgs = getDocsSpy.mock.calls[0]
    expect(sum1CallArgs[1]).toBe('Chat Prompt Result.')

    const sum2CallArgs = getDocsSpy.mock.calls[1]
    expect(sum2CallArgs[1]).toBe('Sum1 response. Chat Prompt Result.')
  })

  it('should run nested summarize commands and pass prompt results as context', async () => {
    const sumNode2 = {
      id: 'sumNode2',
      title: '/summarize sum2 prompt',
      command: '/summarize sum2 prompt',
    }
    const sumNode1 = {
      id: 'sumNode1',
      title: '/summarize sum1 prompt',
      command: '/summarize sum1 prompt',
      children: [sumNode2.id],
    }
    sumNode2.parent = sumNode1.id

    const chatNode = {
      id: 'chatNode',
      title: '/chat chat prmpt',
      command: '/chat chat prompt',
      children: [sumNode1.id],
    }
    sumNode1.parent = chatNode.id

    const store = new Store({
      userId: 'userId',
      mapId: 'mapId',
      files: {},
      nodes: {
        chatNode,
        sumNode1,
        sumNode2,
      },
    })

    jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(() => {
      const childNode = {
        id: 'chatPromptResult',
        title: 'Chat Prompt Result',
        parent: chatNode.id,
      }
      store.createNode(childNode, true)
    })

    jest
      .spyOn(BaseChain.prototype, 'call')
      .mockResolvedValueOnce({output_text: 'Sum1 response'})
      .mockResolvedValueOnce({output_text: 'Sum2 response'})

    const getDocsSpy = jest.spyOn(SummarizeCommand.prototype, 'getDocuments').mockResolvedValueOnce([])

    await runCommand({
      queryType: COMPLETION_QUERY_TYPE,
      cell: chatNode,
      store,
    })

    const sum1CallArgs = getDocsSpy.mock.calls[0]
    expect(sum1CallArgs[1]).toBe('Chat Prompt Result.')

    const sum2CallArgs = getDocsSpy.mock.calls[1]
    expect(sum2CallArgs[1]).toBe('Sum1 response.')
  })
})
