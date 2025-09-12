import {runCommand} from './runCommand'
import Store from './Store'
import {CHAT_QUERY_TYPE} from '../../constants/chat'
import {ChatCommand} from '../ChatCommand'
import {YandexCommand} from '../YandexCommand'
import {YANDEX_QUERY_TYPE} from '../../constants/yandex'
import {DeepseekCommand} from '../DeepseekCommand'
import {DEEPSEEK_QUERY_TYPE} from '../../constants/deepseek'
import {ClaudeCommand} from '../ClaudeCommand'
import {CLAUDE_QUERY_TYPE} from '../../constants/claude'
import {QwenCommand} from '../QwenCommand'
import {QWEN_QUERY_TYPE} from '../../constants/qwen'
import {PerplexityCommand} from '../PerplexityCommand'
import {PERPLEXITY_QUERY_TYPE} from '../../constants/perplexity'
import {CustomLLMChatCommand} from '../CustomLLMChatCommand'
import {CUSTOM_LLM_CHAT_QUERY_TYPE} from '../../constants/custom_llm'
import {WebCommand} from '../WebCommand'
import {WEB_QUERY_TYPE} from '../../constants/web'
import {SCHOLAR_QUERY_TYPE} from '../../constants/scholar'
import {ScholarCommand} from '../ScholarCommand'
import {OutlineCommand} from '../OutlineCommand'
import {OUTLINE_QUERY_TYPE} from '../../constants/outline'
import {ExtCommand} from '../ExtCommand'
import {EXT_QUERY_TYPE} from '../../constants/ext'
import {BaseChatModel} from 'langchain/chat_models/base'
import {getIntegrationSettings, Model} from './langchain/getLLM'
import YandexService from '../../../integrations/yandex/YandexService'
import ClaudeService from '../../../integrations/claude/ClaudeService'
import {OpenAIApi} from 'openai'
import {ExtVectorStore} from './langchain/vectorStore/ExtVectorStore'
import {DownloadCommand} from '../DownloadCommand'
import {DOWNLOAD_QUERY_TYPE} from '../../constants/download'
import {REFINE_QUERY_TYPE} from '../../constants/refine'
import {LLMChain} from 'langchain/chains'
import {SWITCH_QUERY_TYPE} from '../../constants/switch'
import {SUMMARIZE_QUERY_TYPE} from '../../constants/summarize'
import {COMPLETION_QUERY_TYPE} from '../../constants/completion'
import {MEMORIZE_QUERY_TYPE} from '../../constants/memorize'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn) // debug() возвращает саму функцию
  fn.extend = jest.fn(() => fn) // extend() возвращает ту же функцию (чтобы цепочка работала)
  return fn
})

jest.mock('./langchain/getLLM', () => ({
  ...jest.requireActual('./langchain/getLLM'),
  getIntegrationSettings: jest.fn(),
}))

jest.mock('../../../integrations/yandex/YandexService', () => {
  return jest.fn().mockImplementation(() => ({
    completionWithRetry: jest.fn(),
  }))
})

jest.mock('../../../integrations/claude/ClaudeService', () => ({
  sendMessages: jest.fn(),
}))

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

const userId = 'userId'
const mapId = 'mapId'
const settings = {
  openai: {
    apiKey: 'key',
    model: 'model',
  },
  yandex: {
    apiKey: 'key',
    model: 'model',
    folder_id: 'folder_id',
  },
  claude: {
    apiKey: 'key',
    model: 'model',
  },
  perplexity: {
    apiKey: 'key',
    model: 'model',
  },
  qwen: {
    apiKey: 'key',
    model: 'model',
  },
  deepseek: {
    apiKey: 'key',
    model: 'model',
  },
  custom_llm: {
    apiRootUrl: 'http://example.com',
    maxTokens: 1000,
    embeddingsChunkSize: 500,
    apiType: 'OpenAI compatible',
  },
}

beforeEach(() => {
  getIntegrationSettings.mockResolvedValue(settings)
})

describe('ChatCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/chatgpt write one pet name', command: '/chatgpt write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockResolvedValueOnce('Rex')

    await runCommand({
      cell: chatNode,
      queryType: CHAT_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Rex',
          parent: chatNode.id,
        }),
      ]),
    )

    chatRunSpy.mockRestore()
  })

  it('should handle error chat request', async () => {
    const chatNode = {id: 'chatNode', title: '/chatgpt write one pet name', command: '/chatgpt write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(BaseChatModel.prototype, 'call').mockRejectedValueOnce(new Error('Api Error'))

    await runCommand({
      cell: chatNode,
      queryType: CHAT_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])

    chatRunSpy.mockRestore()
  })
})

describe('YandexCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/yandexgpt write one pet name', command: '/yandexgpt write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(YandexCommand.prototype, 'replyYandex').mockResolvedValueOnce('Rex')

    await runCommand({
      cell: chatNode,
      queryType: YANDEX_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Rex',
          parent: chatNode.id,
        }),
      ]),
    )

    chatRunSpy.mockRestore()
  })

  it('should handle error yandex request', async () => {
    const chatNode = {id: 'chatNode', title: '/yandexgpt write one pet name', command: '/yandexgpt write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const yandexServiceInstance = new YandexService()
    const chatRunSpy = jest
      .spyOn(yandexServiceInstance, 'completionWithRetry')
      .mockRejectedValueOnce(new Error('Api Error'))

    await runCommand({
      cell: chatNode,
      queryType: YANDEX_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])

    chatRunSpy.mockRestore()
  })
})

describe('DeepseekCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/deepseek write one pet name', command: '/deepseek write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(DeepseekCommand.prototype, 'replyDeepseek').mockResolvedValueOnce('Rex')

    await runCommand({
      cell: chatNode,
      queryType: DEEPSEEK_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Rex',
          parent: chatNode.id,
        }),
      ]),
    )

    chatRunSpy.mockRestore()
  })

  it('should handle error deepseek request', async () => {
    const chatNode = {id: 'chatNode', title: '/deepseek write one pet name', command: '/deepseek write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(BaseChatModel.prototype, 'call').mockRejectedValueOnce(new Error('Api Error'))

    await runCommand({
      cell: chatNode,
      queryType: DEEPSEEK_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])

    chatRunSpy.mockRestore()
  })
})

describe('ClaudeCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/claude write one pet name', command: '/claude write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(ClaudeCommand.prototype, 'replyClaude').mockResolvedValueOnce('Rex')

    await runCommand({
      cell: chatNode,
      queryType: CLAUDE_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Rex',
          parent: chatNode.id,
        }),
      ]),
    )

    chatRunSpy.mockRestore()
  })

  it('should handle error claude request', async () => {
    const chatNode = {id: 'chatNode', title: '/claude write one pet name', command: '/claude write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(ClaudeService, 'sendMessages').mockRejectedValueOnce(new Error('Api Error'))

    await runCommand({
      cell: chatNode,
      queryType: CLAUDE_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])

    chatRunSpy.mockRestore()
  })
})

describe('QwenCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/qwen write one pet name', command: '/qwen write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(QwenCommand.prototype, 'replyQwen').mockResolvedValueOnce('Rex')

    await runCommand({
      cell: chatNode,
      queryType: QWEN_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Rex',
          parent: chatNode.id,
        }),
      ]),
    )

    chatRunSpy.mockRestore()
  })

  it('should handle error qwen request', async () => {
    const chatNode = {id: 'chatNode', title: '/qwen write one pet name', command: '/qwen write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const openApi = new OpenAIApi()
    const chatRunSpy = jest.spyOn(openApi, 'createChatCompletion').mockRejectedValueOnce(new Error('Api Error'))

    await runCommand({
      cell: chatNode,
      queryType: QWEN_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])

    chatRunSpy.mockRestore()
  })
})

describe('PerplexityCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {
      id: 'chatNode',
      title: '/perplexity write one pet name',
      command: '/perplexity write one pet name',
    }
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(PerplexityCommand.prototype, 'reply').mockResolvedValueOnce('Rex')

    await runCommand({
      cell: chatNode,
      queryType: PERPLEXITY_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Rex',
          parent: chatNode.id,
        }),
      ]),
    )

    chatRunSpy.mockRestore()
  })

  it('should handle error perplexity request', async () => {
    const chatNode = {
      id: 'chatNode',
      title: '/perplexity write one pet name',
      command: '/perplexity write one pet name',
    }
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const openApi = new OpenAIApi()
    const chatRunSpy = jest.spyOn(openApi, 'createChatCompletion').mockRejectedValueOnce(new Error('Api Error'))

    await runCommand({
      cell: chatNode,
      queryType: PERPLEXITY_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])

    chatRunSpy.mockRestore()
  })
})

describe('CustomLLMCommand run test', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    console.log.mockRestore()
    console.error.mockRestore()
  })

  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/chat write one pet name', command: '/chat write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(CustomLLMChatCommand.prototype, 'replyChat').mockResolvedValueOnce('Rex')

    await runCommand({
      cell: chatNode,
      queryType: CUSTOM_LLM_CHAT_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Rex',
          parent: chatNode.id,
        }),
      ]),
    )

    chatRunSpy.mockRestore()
  })

  it('should handle error custom llm request', async () => {
    const chatNode = {id: 'chatNode', title: '/chat write one pet name', command: '/chat write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(BaseChatModel.prototype, 'call').mockRejectedValueOnce(new Error('Api Error'))

    await runCommand({
      cell: chatNode,
      queryType: CUSTOM_LLM_CHAT_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])

    chatRunSpy.mockRestore()
  })
})

describe('WebCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/web write one pet name', command: '/web write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(WebCommand.prototype, 'createResponseWeb').mockResolvedValueOnce('Rex')

    await runCommand({
      cell: chatNode,
      queryType: WEB_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Rex',
          parent: chatNode.id,
        }),
      ]),
    )

    chatRunSpy.mockRestore()
  })

  it('should handle error web request', async () => {
    const chatNode = {id: 'chatNode', title: '/web write one pet name', command: '/web write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(BaseChatModel.prototype, 'call').mockRejectedValueOnce(new Error('Api Error'))

    await runCommand({
      cell: chatNode,
      queryType: WEB_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])

    chatRunSpy.mockRestore()
  })
})

describe('ScholarCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/scholar write one pet name', command: '/scholar write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(ScholarCommand.prototype, 'createResponseScholar').mockResolvedValueOnce('Rex')

    await runCommand({
      cell: chatNode,
      queryType: SCHOLAR_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Rex',
          parent: chatNode.id,
        }),
      ]),
    )

    chatRunSpy.mockRestore()
  })

  it('should handle error scholar request', async () => {
    const chatNode = {id: 'chatNode', title: '/scholar write one pet name', command: '/scholar write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(BaseChatModel.prototype, 'call').mockRejectedValueOnce(new Error('Api Error'))

    await runCommand({
      cell: chatNode,
      queryType: SCHOLAR_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])

    chatRunSpy.mockRestore()
  })
})

describe('OutlineCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/outline write one pet name', command: '/outline write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(OutlineCommand.prototype, 'createResponseOutline').mockResolvedValueOnce('Rex')

    await runCommand({
      cell: chatNode,
      queryType: OUTLINE_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Rex',
          parent: chatNode.id,
        }),
      ]),
    )

    chatRunSpy.mockRestore()
  })

  it('should handle error outline request', async () => {
    const chatNode = {id: 'chatNode', title: '/outline write one pet name', command: '/outline write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(BaseChatModel.prototype, 'call').mockRejectedValueOnce(new Error('Api Error'))

    await runCommand({
      cell: chatNode,
      queryType: OUTLINE_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])

    chatRunSpy.mockRestore()
  })
})

describe('ExtCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/ext write one pet name', command: '/ext write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(ExtCommand.prototype, 'createResponseExt').mockResolvedValueOnce('Rex')

    await runCommand({
      cell: chatNode,
      queryType: EXT_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Rex',
          parent: chatNode.id,
        }),
      ]),
    )

    chatRunSpy.mockRestore()
  })

  it('should handle error ext request', async () => {
    const chatNode = {id: 'chatNode', title: '/ext write one pet name', command: '/ext write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Map', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const setVectorsSpy = jest
      .spyOn(ExtVectorStore.prototype, 'setVectors')
      .mockRejectedValueOnce(new Error('Vector store error'))

    await runCommand({
      cell: chatNode,
      queryType: EXT_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()
    expect(output.nodes).toEqual([])

    setVectorsSpy.mockRestore()
  })
})

describe('DownloadCommand run test', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    console.log.mockRestore()
    console.error.mockRestore()
  })

  it('should successfully download and create nodes', async () => {
    const downloadNode = {
      id: 'downloadNode',
      title: '/download https://example.com',
      command: '/download https://example.com',
    }
    const rootNode = {id: 'rootNode', title: 'Map', children: [downloadNode.id]}
    downloadNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        downloadNode,
        rootNode,
      },
    })

    const mockScrapeResult = [
      {
        content: 'test content',
        filename: 'test.txt',
        contentType: 'text/plain',
      },
    ]

    const scrapeSpy = jest.spyOn(DownloadCommand.prototype, 'scrape').mockResolvedValueOnce(mockScrapeResult)
    const uploadSpy = jest.spyOn(DownloadCommand.prototype, 'upload').mockResolvedValueOnce({_id: 'fileId'})

    await runCommand({
      cell: downloadNode,
      queryType: DOWNLOAD_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'test.txt',
          parent: downloadNode.id,
          file: 'fileId',
        }),
      ]),
    )

    expect(scrapeSpy).toHaveBeenCalledWith(['https://example.com'], expect.any(Object))
    expect(uploadSpy).toHaveBeenCalled()

    scrapeSpy.mockRestore()
    uploadSpy.mockRestore()
  })

  it('should handle upload errors gracefully', async () => {
    const downloadNode = {
      id: 'downloadNode',
      title: '/download https://example.com',
      command: '/download https://example.com',
    }
    const rootNode = {id: 'rootNode', title: 'Map', children: [downloadNode.id]}
    downloadNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        downloadNode,
        rootNode,
      },
    })

    const mockScrapeResult = [
      {
        content: 'test content',
        filename: 'test.txt',
        contentType: 'text/plain',
      },
    ]

    const scrapeSpy = jest.spyOn(DownloadCommand.prototype, 'scrape').mockResolvedValueOnce(mockScrapeResult)
    const uploadSpy = jest.spyOn(DownloadCommand.prototype, 'upload').mockRejectedValueOnce(new Error('Upload failed'))

    await runCommand({
      cell: downloadNode,
      queryType: DOWNLOAD_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])
    expect(scrapeSpy).toHaveBeenCalledWith(['https://example.com'], expect.any(Object))
    expect(uploadSpy).toHaveBeenCalled()

    scrapeSpy.mockRestore()
    uploadSpy.mockRestore()
  })
})

describe('RefineCommand run test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should successfully refine content with children nodes', async () => {
    const childNode = {id: 'childNode', title: 'Original content to refine'}
    const refineNode = {
      id: 'refineNode',
      title: '/refine make it more concise',
      command: '/refine make it more concise',
      children: [childNode.id],
    }
    childNode.parent = refineNode.id

    const rootNode = {id: 'rootNode', title: 'Map', children: [refineNode.id]}
    refineNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        refineNode,
        childNode,
        rootNode,
      },
    })

    const mockLLMResponse = 'Refined content'
    const llmSpy = jest.spyOn(LLMChain.prototype, 'call').mockResolvedValueOnce({text: mockLLMResponse})

    await runCommand({
      cell: refineNode,
      queryType: REFINE_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: mockLLMResponse,
          parent: refineNode.id,
        }),
      ]),
    )

    expect(llmSpy).toHaveBeenCalled()
    llmSpy.mockRestore()
  })

  it('should handle LLM errors gracefully', async () => {
    const childNode = {id: 'childNode', title: 'Original content to refine'}
    const refineNode = {
      id: 'refineNode',
      title: '/refine make it more concise',
      command: '/refine make it more concise',
      children: [childNode.id],
    }
    childNode.parent = refineNode.id

    const rootNode = {id: 'rootNode', title: 'Map', children: [refineNode.id]}
    refineNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        refineNode,
        childNode,
        rootNode,
      },
    })

    const llmSpy = jest.spyOn(LLMChain.prototype, 'call').mockRejectedValueOnce(new Error('LLM Error'))

    await runCommand({
      cell: refineNode,
      queryType: REFINE_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])
    expect(llmSpy).toHaveBeenCalled()
    llmSpy.mockRestore()
  })
})

describe('SwitchCommand run test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should successfully execute case branch', async () => {
    const chatNode = {id: 'chatNode', title: '/chatgpt write a story', command: '/chatgpt write a story'}
    const caseNode = {id: 'caseNode', title: '/case story', command: '/case story', children: [chatNode.id]}
    chatNode.parent = caseNode.id

    const switchNode = {
      id: 'switchNode',
      title: '/switch write a story',
      command: '/switch write a story',
      children: [caseNode.id],
    }
    caseNode.parent = switchNode.id

    const rootNode = {id: 'rootNode', title: 'Map', children: [switchNode.id]}
    switchNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        switchNode,
        caseNode,
        chatNode,
        rootNode,
      },
    })

    const mockLLMResponse = 'story'
    const llmSpy = jest.spyOn(BaseChatModel.prototype, 'call').mockResolvedValueOnce({content: mockLLMResponse})
    const chatSpy = jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockResolvedValueOnce('Once upon a time...')

    await runCommand({
      cell: switchNode,
      queryType: SWITCH_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()
    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Once upon a time...',
          parent: chatNode.id,
        }),
      ]),
    )
    expect(llmSpy).toHaveBeenCalled()
    expect(chatSpy).toHaveBeenCalled()
    llmSpy.mockRestore()
    chatSpy.mockRestore()
  })

  it('should handle LLM errors gracefully', async () => {
    const chatNode = {id: 'chatNode', title: '/chatgpt write a story', command: '/chatgpt write a story'}
    const caseNode = {id: 'caseNode', title: '/case story', command: '/case story', children: [chatNode.id]}
    chatNode.parent = caseNode.id

    const switchNode = {
      id: 'switchNode',
      title: '/switch write a story',
      command: '/switch write a story',
      children: [caseNode.id],
    }
    caseNode.parent = switchNode.id

    const rootNode = {id: 'rootNode', title: 'Map', children: [switchNode.id]}
    switchNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        switchNode,
        caseNode,
        chatNode,
        rootNode,
      },
    })

    const llmSpy = jest.spyOn(BaseChatModel.prototype, 'call').mockRejectedValueOnce(new Error('LLM Error'))

    await runCommand({
      cell: switchNode,
      queryType: SWITCH_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])
    expect(llmSpy).toHaveBeenCalled()
    llmSpy.mockRestore()
  })
})

describe('SummarizeCommand run test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should successfully summarize content', async () => {
    const contentNode = {
      id: 'contentNode',
      title: 'Long text to summarize',
      content: 'This is a long text that needs to be summarized...',
    }
    const summarizeNode = {
      id: 'summarizeNode',
      title: '/summarize summarize this text',
      command: '/summarize summarize this text',
    }
    contentNode.parent = summarizeNode.id

    const rootNode = {id: 'rootNode', title: 'Map', children: [summarizeNode.id]}
    summarizeNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        summarizeNode,
        contentNode,
        rootNode,
      },
    })

    const mockLLMResponse = 'This is a summary of the text'
    const llmSpy = jest.spyOn(LLMChain.prototype, 'call').mockResolvedValueOnce({text: mockLLMResponse})
    const translateSpy = jest.spyOn(require('./translate'), 'translate').mockResolvedValueOnce(mockLLMResponse)

    await runCommand({
      cell: summarizeNode,
      queryType: SUMMARIZE_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: mockLLMResponse,
          parent: summarizeNode.id,
        }),
      ]),
    )

    expect(llmSpy).toHaveBeenCalled()
    llmSpy.mockRestore()
    translateSpy.mockRestore()
  })

  it('should handle empty content gracefully', async () => {
    const contentNode = {id: 'contentNode', title: ''}
    const summarizeNode = {
      id: 'summarizeNode',
      title: '/summarize summarize this text',
      command: '/summarize summarize this text',
    }
    contentNode.parent = summarizeNode.id

    const rootNode = {id: 'rootNode', title: '', children: [summarizeNode.id]}
    summarizeNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        summarizeNode,
        contentNode,
        rootNode,
      },
    })

    const llmSpy = jest.spyOn(LLMChain.prototype, 'call').mockResolvedValue({output_text: ''})
    const translateSpy = jest.spyOn(require('./translate'), 'translate')

    await expect(
      runCommand({
        cell: summarizeNode,
        queryType: SUMMARIZE_QUERY_TYPE,
        store: mockStore,
      }),
    ).rejects.toThrow('Nothing to summarize')

    llmSpy.mockRestore()
    translateSpy.mockRestore()
  })
})

describe('StepsCommand run test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should successfully execute all steps', async () => {
    const chatNode1 = {id: 'chatNode1', title: '#1 /chatgpt write a story', command: '#1 /chatgpt write a story'}
    const chatNode2 = {id: 'chatNode2', title: '#2 /chatgpt write a poem', command: '#2 /chatgpt write a poem'}
    const chatNode3 = {id: 'chatNode3', title: '/chatgpt write a song', command: '/chatgpt write a song'}

    const stepsNode = {
      id: 'stepsNode',
      title: '/steps execute all',
      command: '/steps execute all',
      children: [chatNode1.id, chatNode2.id, chatNode3.id],
    }

    const rootNode = {id: 'rootNode', title: 'Map', children: [stepsNode.id]}
    stepsNode.parent = rootNode.id
    chatNode1.parent = stepsNode.id
    chatNode2.parent = stepsNode.id
    chatNode3.parent = stepsNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        stepsNode,
        chatNode1,
        chatNode2,
        chatNode3,
        rootNode,
      },
    })

    const mockLLMResponse1 = 'Once upon a time...'
    const mockLLMResponse2 = 'Roses are red...'
    const mockLLMResponse3 = 'La la la...'

    const llmSpy = jest
      .spyOn(BaseChatModel.prototype, 'call')
      .mockResolvedValueOnce({content: mockLLMResponse1})
      .mockResolvedValueOnce({content: mockLLMResponse2})
      .mockResolvedValueOnce({content: mockLLMResponse3})

    await runCommand({
      cell: stepsNode,
      queryType: 'steps',
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: mockLLMResponse1,
          parent: chatNode1.id,
        }),
        expect.objectContaining({
          title: mockLLMResponse2,
          parent: chatNode2.id,
        }),
        expect.objectContaining({
          title: mockLLMResponse3,
          parent: chatNode3.id,
        }),
      ]),
    )

    llmSpy.mockRestore()
  })

  it('should handle partial failures gracefully', async () => {
    const chatNode1 = {id: 'chatNode1', title: '#1 /chatgpt write a story', command: '#1 /chatgpt write a story'}
    const chatNode2 = {id: 'chatNode2', title: '#2 /chatgpt write a poem', command: '#2 /chatgpt write a poem'}
    const chatNode3 = {id: 'chatNode3', title: '/chatgpt write a song', command: '/chatgpt write a song'}

    const stepsNode = {
      id: 'stepsNode',
      title: '/steps execute all',
      command: '/steps execute all',
      children: [chatNode1.id, chatNode2.id, chatNode3.id],
    }

    const rootNode = {id: 'rootNode', title: 'Map', children: [stepsNode.id]}
    stepsNode.parent = rootNode.id
    chatNode1.parent = stepsNode.id
    chatNode2.parent = stepsNode.id
    chatNode3.parent = stepsNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        stepsNode,
        chatNode1,
        chatNode2,
        chatNode3,
        rootNode,
      },
    })

    const mockLLMResponse1 = 'Once upon a time...'
    const mockLLMResponse3 = 'La la la...'

    const llmSpy = jest
      .spyOn(BaseChatModel.prototype, 'call')
      .mockResolvedValueOnce({content: mockLLMResponse1})
      .mockRejectedValueOnce(new Error('LLM Error'))
      .mockResolvedValueOnce({content: mockLLMResponse3})

    await runCommand({
      cell: stepsNode,
      queryType: 'steps',
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: mockLLMResponse1,
          parent: chatNode1.id,
        }),
        expect.objectContaining({
          title: mockLLMResponse3,
          parent: chatNode3.id,
        }),
      ]),
    )

    llmSpy.mockRestore()
  })
})

describe('ForeachCommand run test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should execute two foreach commands as children of a chat node, each iterating over chat node children', async () => {
    // Structure:
    // root
    //   chatNode
    //       foreachOneNode
    //       foreachTwoNode
    //       leaf1
    //       leaf2
    const rootNode = {
      id: 'root',
      title: 'Map',
      children: ['chatNode'],
    }

    const chatNode = {
      id: 'chatNode',
      title: '/chatgpt',
      command: '/chatgpt',
      children: ['leaf1', 'leaf2', 'foreachOneNode', 'foreachTwoNode'],
      parent: 'root',
    }

    const leaf1 = {
      id: 'leaf1',
      title: 'A',
      children: [],
      parent: 'chatNode',
    }
    const leaf2 = {
      id: 'leaf2',
      title: 'B',
      children: [],
      parent: 'chatNode',
    }

    const foreachOneNode = {
      id: 'foreachOneNode',
      title: '/foreach /chatgpt one @@',
      command: '/foreach /chatgpt one @@',
      parent: 'chatNode',
    }

    const foreachTwoNode = {
      id: 'foreachTwoNode',
      title: '/foreach /chatgpt two @@',
      command: '/foreach /chatgpt two @@',
      parent: 'chatNode',
    }

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        root: rootNode,
        chatNode: chatNode,
        leaf1: leaf1,
        leaf2: leaf2,
        foreachOneNode: foreachOneNode,
        foreachTwoNode: foreachTwoNode,
      },
    })

    const mockLLMResponse1 = 'one A'
    const mockLLMResponse2 = 'one B'
    const mockLLMResponse3 = 'two A'
    const mockLLMResponse4 = 'two B'

    const llmSpy = jest
      .spyOn(BaseChatModel.prototype, 'call')
      .mockResolvedValueOnce({content: mockLLMResponse1})
      .mockResolvedValueOnce({content: mockLLMResponse2})
      .mockResolvedValueOnce({content: mockLLMResponse3})
      .mockResolvedValueOnce({content: mockLLMResponse4})

    await runCommand({
      cell: foreachOneNode,
      queryType: 'foreach',
      store: mockStore,
    })
    await runCommand({
      cell: foreachTwoNode,
      queryType: 'foreach',
      store: mockStore,
    })

    const output = mockStore.getOutput()

    const resultNodes = output.nodes.filter(node =>
      [mockLLMResponse1, mockLLMResponse2, mockLLMResponse3, mockLLMResponse4].includes(node.title),
    )
    expect(resultNodes.length).toBe(4)
    const titles = resultNodes.map(node => node.title)
    expect(titles).toEqual(
      expect.arrayContaining([mockLLMResponse1, mockLLMResponse2, mockLLMResponse3, mockLLMResponse4]),
    )
    resultNodes.forEach(node => {
      expect(node.parent).toBeDefined()
    })
    llmSpy.mockRestore()
  })

  it('should execute 2-level foreach with steps', async () => {
    const rootNode = {
      id: 'root',
      title: 'Map',
      children: ['foreachNode', 'dogNode', 'catNode'],
    }

    const foreachNode = {
      id: 'foreachNode',
      title: '/foreach /steps',
      command: '/foreach /steps',
      children: ['stepsNode'],
      parent: 'root',
    }

    const stepsNode = {
      id: 'stepsNode',
      title: '/steps',
      command: '/steps',
      children: ['chatNode1', 'chatNode2'],
      parent: 'foreachNode',
    }

    const chatNode1 = {
      id: 'chatNode1',
      title: '#1 /chatgpt write a story about @@',
      command: '#1 /chatgpt write a story about @@',
      children: [],
      parent: 'stepsNode',
    }

    const chatNode2 = {
      id: 'chatNode2',
      title: '#2 /chatgpt write a poem about @@',
      command: '#2 /chatgpt write a poem about @@',
      children: [],
      parent: 'stepsNode',
    }

    const dogNode = {
      id: 'dogNode',
      title: 'Dog',
      children: [],
      parent: 'root',
    }

    const catNode = {
      id: 'catNode',
      title: 'Cat',
      children: [],
      parent: 'root',
    }

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        root: rootNode,
        foreachNode: foreachNode,
        stepsNode: stepsNode,
        chatNode1: chatNode1,
        chatNode2: chatNode2,
        dogNode: dogNode,
        catNode: catNode,
      },
    })

    const mockLLMResponse1 = 'Once upon a time there was a dog...'
    const mockLLMResponse2 = 'Roses are red, violets are blue...'
    const mockLLMResponse3 = 'Once upon a time there was a cat...'
    const mockLLMResponse4 = 'Twinkle twinkle little star...'

    const llmSpy = jest
      .spyOn(BaseChatModel.prototype, 'call')
      .mockResolvedValueOnce({content: mockLLMResponse1})
      .mockResolvedValueOnce({content: mockLLMResponse2})
      .mockResolvedValueOnce({content: mockLLMResponse3})
      .mockResolvedValueOnce({content: mockLLMResponse4})

    await runCommand({
      cell: foreachNode,
      queryType: 'foreach',
      store: mockStore,
    })

    const output = mockStore.getOutput()

    const titles = output.nodes.map(node => node.title)
    expect(titles).toEqual(
      expect.arrayContaining([mockLLMResponse1, mockLLMResponse2, mockLLMResponse3, mockLLMResponse4]),
    )

    output.nodes.forEach(node => {
      if ([mockLLMResponse1, mockLLMResponse2, mockLLMResponse3, mockLLMResponse4].includes(node.title)) {
        expect(node.parent).toBeDefined()
      }
    })

    llmSpy.mockRestore()
  })

  it('should handle partial failures in foreach execution', async () => {
    // Structure:
    // root
    //   chatNode
    //       foreachOneNode
    //       foreachTwoNode
    //       leaf1
    //       leaf2
    const rootNode = {
      id: 'root',
      title: 'Map',
      children: ['chatNode'],
    }

    const chatNode = {
      id: 'chatNode',
      title: '/chatgpt',
      command: '/chatgpt',
      children: ['leaf1', 'leaf2', 'foreachOneNode', 'foreachTwoNode'],
      parent: 'root',
    }

    const leaf1 = {
      id: 'leaf1',
      title: 'A',
      children: [],
      parent: 'chatNode',
    }
    const leaf2 = {
      id: 'leaf2',
      title: 'B',
      children: [],
      parent: 'chatNode',
    }

    const foreachOneNode = {
      id: 'foreachOneNode',
      title: '/foreach /chatgpt one @@',
      command: '/foreach /chatgpt one @@',
      parent: 'chatNode',
    }

    const foreachTwoNode = {
      id: 'foreachTwoNode',
      title: '/foreach /chatgpt two @@',
      command: '/foreach /chatgpt two @@',
      parent: 'chatNode',
    }

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        root: rootNode,
        chatNode: chatNode,
        leaf1: leaf1,
        leaf2: leaf2,
        foreachOneNode: foreachOneNode,
        foreachTwoNode: foreachTwoNode,
      },
    })

    const mockLLMResponse1 = 'one A'
    const mockLLMResponse2 = 'one B'
    const mockLLMResponse3 = 'two A'
    // mockLLMResponse4 will fail

    const llmSpy = jest
      .spyOn(BaseChatModel.prototype, 'call')
      .mockResolvedValueOnce({content: mockLLMResponse1})
      .mockResolvedValueOnce({content: mockLLMResponse2})
      .mockResolvedValueOnce({content: mockLLMResponse3})
      .mockRejectedValueOnce(new Error('LLM Error'))

    await runCommand({
      cell: foreachOneNode,
      queryType: 'foreach',
      store: mockStore,
    })
    await runCommand({
      cell: foreachTwoNode,
      queryType: 'foreach',
      store: mockStore,
    })

    const output = mockStore.getOutput()

    const resultNodes = output.nodes.filter(node =>
      [mockLLMResponse1, mockLLMResponse2, mockLLMResponse3].includes(node.title),
    )
    expect(resultNodes.length).toBe(3)
    const titles = resultNodes.map(node => node.title)
    expect(titles).toEqual(expect.arrayContaining([mockLLMResponse1, mockLLMResponse2, mockLLMResponse3]))
    resultNodes.forEach(node => {
      expect(node.parent).toBeDefined()
    })
    llmSpy.mockRestore()
  })
})

describe('CompletionCommand run test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should successfully route to OpenAI when model is set to OpenAI', async () => {
    const completionNode = {
      id: 'completionNode',
      title: '/chat write a story',
      command: '/chat write a story',
    }
    const rootNode = {id: 'rootNode', title: 'Map', children: [completionNode.id]}
    completionNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        completionNode,
        rootNode,
      },
    })

    getIntegrationSettings.mockResolvedValue({
      ...settings,
      model: Model.OpenAI,
    })

    const mockLLMResponse = 'Once upon a time...'
    jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockResolvedValueOnce(mockLLMResponse)

    await runCommand({
      cell: completionNode,
      queryType: COMPLETION_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: mockLLMResponse,
          parent: completionNode.id,
        }),
      ]),
    )
  })
})

describe('MemorizeCommand run test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should successfully memorize content and create embeddings', async () => {
    const memorizeNode = {
      id: 'memorizeNode',
      title: '/memorize --context=test',
      command: '/memorize --context=test',
      parent: 'parentNode',
    }
    const parentNode = {
      id: 'parentNode',
      title: 'Parent Content',
      children: [memorizeNode.id],
    }
    const childNode = {
      id: 'childNode',
      title: 'Child Content',
      children: [],
      parent: 'parentNode',
    }
    parentNode.children.push(childNode.id)

    const rootNode = {id: 'rootNode', title: 'Map', children: [parentNode.id]}
    parentNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        memorizeNode,
        parentNode,
        childNode,
        rootNode,
      },
    })

    const mockLoad = jest.fn().mockResolvedValue(undefined)
    jest.spyOn(ExtVectorStore.prototype, 'load').mockImplementation(mockLoad)

    await runCommand({
      cell: memorizeNode,
      queryType: MEMORIZE_QUERY_TYPE,
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])
    expect(mockLoad).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Parent Content'),
          hrefs: ['parentNode'],
        }),
        expect.objectContaining({
          content: expect.stringContaining('Child Content'),
          hrefs: ['childNode'],
        }),
      ]),
      false,
    )
  })

  it('should handle memorize command with rechunk parameter', async () => {
    const memorizeNode = {
      id: 'memorizeNode',
      title: '/memorize --rechunk --context=test',
      command: '/memorize --rechunk --context=test',
      parent: 'parentNode',
    }
    const parentNode = {
      id: 'parentNode',
      title: 'Parent Content for Rechunk',
      children: [memorizeNode.id],
    }
    const childNode1 = {
      id: 'childNode1',
      title: 'Child Content 1',
      children: [],
      parent: 'parentNode',
    }
    const childNode2 = {
      id: 'childNode2',
      title: 'Child Content 2',
      children: [],
      parent: 'parentNode',
    }
    parentNode.children.push(childNode1.id, childNode2.id)

    const rootNode = {id: 'rootNode', title: 'Map', children: [parentNode.id]}
    parentNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      mapId,
      nodes: {
        memorizeNode,
        parentNode,
        childNode1,
        childNode2,
        rootNode,
      },
    })

    const mockLoad = jest.fn().mockResolvedValue(undefined)
    jest.spyOn(ExtVectorStore.prototype, 'load').mockImplementation(mockLoad)

    await runCommand({
      cell: memorizeNode,
      queryType: 'memorize',
      store: mockStore,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual([])
    expect(mockLoad).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Parent Content for Rechunk. Child Content 1. Child Content 2.'),
          hrefs: ['parentNode'],
        }),
      ]),
      false,
    )
  })
})
