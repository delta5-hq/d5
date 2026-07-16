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
import {WEB_QUERY_TYPE} from '../../constants/web'
import {SCHOLAR_QUERY_TYPE} from '../../constants/scholar'
import {OUTLINE_QUERY_TYPE} from '../../constants/outline'
import {EXT_QUERY_TYPE} from '../../constants/ext'
import {BaseChatModel} from '@langchain/core/language_models/chat_models'
import {getIntegrationSettings, Model} from './langchain/getLLM'
import YandexService from '../../../integrations/yandex/YandexService'
import {ClaudeService} from '../../../integrations/claude/ClaudeService'
import {DOWNLOAD_QUERY_TYPE} from '../../constants/download'
import {scrapeFiles} from '../../../utils/scrape'
import WorkflowFile from '../../../../models/WorkflowFile'
import {REFINE_QUERY_TYPE} from '../../constants/refine'
import {LLMChain} from '@langchain/classic/chains'
import {SWITCH_QUERY_TYPE} from '../../constants/switch'
import {SUMMARIZE_QUERY_TYPE} from '../../constants/summarize'
import {COMPLETION_QUERY_TYPE} from '../../constants/completion'
import {MEMORIZE_QUERY_TYPE} from '../../constants/memorize'
import {MCP_FUSION_QUERY_TYPE} from '../../constants/mcpFusion'
import {MCPFusionCommand} from '../MCPFusionCommand'
import * as MCPClientManager from '../mcp/MCPClientManager'
/* eslint-disable no-unused-vars */
import {SSHExecutor} from '../rpc/SSHExecutor'
import {HTTPExecutor} from '../rpc/HTTPExecutor'
import IntegrationSessionRepository from '../../../../repositories/IntegrationSessionRepository'
/* eslint-enable no-unused-vars */

jest.mock('../../../../repositories/IntegrationSessionRepository', () => ({
  __esModule: true,
  default: {
    upsertSessionId: jest.fn(),
  },
}))

jest.mock('debug', () => {
  const fn = jest.fn(() => fn) // debug() возвращает саму функцию
  fn.extend = jest.fn(() => fn) // extend() возвращает ту же функцию (чтобы цепочка работала)
  return fn
})

jest.mock('./langchain/getLLM', () => ({
  ...jest.requireActual('./langchain/getLLM'),
  getIntegrationSettings: jest.fn(),
}))

jest.mock('../../../integrations/yandex/YandexService', () => ({
  __esModule: true,
  default: {
    completionWithRetry: jest.fn(),
  },
}))

jest.mock('../../../integrations/claude/ClaudeService', () => ({
  ClaudeService: {
    sendMessages: jest.fn(),
  },
}))

jest.mock('../../../utils/scrape', () => ({
  scrapeFiles: jest.fn(),
}))

jest.mock('../../../../models/WorkflowFile', () => ({
  __esModule: true,
  default: {
    write: jest.fn(),
  },
}))

/* Manual mock factory — auto-mock triggers zod ESM crash in Jest 27 */
jest.mock('../mcp/MCPClientManager', () => ({
  callTool: jest.fn(),
  listTools: jest.fn(),
}))

const mockSSHExecute = jest.fn()
const mockHTTPExecute = jest.fn()
const mockACPExecute = jest.fn()

jest.mock('../rpc/SSHExecutor', () => ({
  SSHExecutor: jest.fn().mockImplementation(() => ({
    execute: mockSSHExecute,
  })),
}))

jest.mock('../rpc/HTTPExecutor', () => ({
  HTTPExecutor: jest.fn().mockImplementation(() => ({
    execute: mockHTTPExecute,
  })),
}))

jest.mock('../rpc/acp/ACPExecutor', () => ({
  ACPExecutor: jest.fn().mockImplementation(() => ({
    execute: mockACPExecute,
  })),
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
const workflowId = 'workflowId'
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

const createReferenceWorkflow = ({nodeId, command, refDefinition, hashDefinition}) => {
  const commandNode = {id: nodeId, title: command, command, children: [], depth: 1}
  const refNode = {id: `${nodeId}Ref`, title: refDefinition, children: [], depth: 1}
  const hashNode = {id: `${nodeId}Hash`, title: hashDefinition, children: [], depth: 1}
  const rootNode = {
    id: `${nodeId}Root`,
    title: 'Workflow',
    children: [commandNode.id, refNode.id, hashNode.id],
    depth: 0,
  }

  commandNode.parent = rootNode.id
  refNode.parent = rootNode.id
  hashNode.parent = rootNode.id

  return {
    commandNode,
    nodes: {
      [commandNode.id]: commandNode,
      [refNode.id]: refNode,
      [hashNode.id]: hashNode,
      [rootNode.id]: rootNode,
    },
  }
}

const lastMockCallArg = mockFn => mockFn.mock.calls[mockFn.mock.calls.length - 1][0]

const expectResolvedExternalPrompt = (prompt, expectedParts, trailingWhitespace = '') => {
  expectedParts.forEach(expectedPart => expect(prompt).toContain(expectedPart))
  expect(prompt).not.toMatch(/@@|##_/)
  if (trailingWhitespace) {
    expect(prompt.endsWith(trailingWhitespace)).toBe(true)
  }
}

describe('ChatCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/chatgpt write one pet name', command: '/chatgpt write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
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
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(BaseChatModel.prototype, 'invoke').mockRejectedValueOnce(new Error('Api Error'))

    await expect(
      runCommand({
        cell: chatNode,
        queryType: CHAT_QUERY_TYPE,
        store: mockStore,
      }),
    ).resolves.not.toThrow()

    chatRunSpy.mockRestore()
  })
})

describe('YandexCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/yandexgpt write one pet name', command: '/yandexgpt write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
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
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(YandexService, 'completionWithRetry').mockRejectedValueOnce(new Error('Api Error'))

    await expect(
      runCommand({
        cell: chatNode,
        queryType: YANDEX_QUERY_TYPE,
        store: mockStore,
      }),
    ).resolves.not.toThrow()

    chatRunSpy.mockRestore()
  })
})

describe('DeepseekCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/deepseek write one pet name', command: '/deepseek write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
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
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(BaseChatModel.prototype, 'invoke').mockRejectedValueOnce(new Error('Api Error'))

    await expect(
      runCommand({
        cell: chatNode,
        queryType: DEEPSEEK_QUERY_TYPE,
        store: mockStore,
      }),
    ).resolves.not.toThrow()

    chatRunSpy.mockRestore()
  })
})

describe('ClaudeCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/claude write one pet name', command: '/claude write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
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
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(ClaudeService, 'sendMessages').mockRejectedValueOnce(new Error('Api Error'))

    await expect(
      runCommand({
        cell: chatNode,
        queryType: CLAUDE_QUERY_TYPE,
        store: mockStore,
      }),
    ).resolves.not.toThrow()

    chatRunSpy.mockRestore()
  })
})

describe('QwenCommand run test', () => {
  it('should succesfully create nodes and return output', async () => {
    const chatNode = {id: 'chatNode', title: '/qwen write one pet name', command: '/qwen write one pet name'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
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
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(QwenCommand.prototype, 'replyQwen').mockRejectedValueOnce(new Error('Api Error'))

    await expect(
      runCommand({
        cell: chatNode,
        queryType: QWEN_QUERY_TYPE,
        store: mockStore,
      }),
    ).resolves.not.toThrow()

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
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
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
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(PerplexityCommand.prototype, 'reply').mockRejectedValueOnce(new Error('Api Error'))

    await expect(
      runCommand({
        cell: chatNode,
        queryType: PERPLEXITY_QUERY_TYPE,
        store: mockStore,
      }),
    ).resolves.not.toThrow()

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
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
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
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [chatNode.id]}
    chatNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        chatNode,
        rootNode,
      },
    })

    const chatRunSpy = jest.spyOn(BaseChatModel.prototype, 'invoke').mockRejectedValueOnce(new Error('Api Error'))

    await expect(
      runCommand({
        cell: chatNode,
        queryType: CUSTOM_LLM_CHAT_QUERY_TYPE,
        store: mockStore,
      }),
    ).resolves.not.toThrow()

    chatRunSpy.mockRestore()
  })
})

describe.each([
  [WEB_QUERY_TYPE, '/web write one pet name', 'Rex'],
  [SCHOLAR_QUERY_TYPE, '/scholar write one pet name', 'Rex'],
  [OUTLINE_QUERY_TYPE, '/outline write one pet name', 'Rex'],
  [EXT_QUERY_TYPE, '/ext write one pet name', 'Rex'],
])('%s dispatch via internal MCP server', (queryType, command, responseTitle) => {
  it('creates output nodes from a successful MCP tool response', async () => {
    const node = {id: 'cmdNode', title: command, command}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [node.id]}
    node.parent = rootNode.id

    const mockStore = new Store({userId, workflowId, nodes: {cmdNode: node, rootNode}})

    MCPClientManager.callTool.mockResolvedValueOnce({content: responseTitle, isError: false})

    await runCommand({cell: node, queryType, store: mockStore})

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({title: responseTitle, parent: node.id})]),
    )
  })

  it('resolves without throwing when the MCP tool rejects', async () => {
    const node = {id: 'cmdNode', title: command, command}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [node.id]}
    node.parent = rootNode.id

    const mockStore = new Store({userId, workflowId, nodes: {cmdNode: node, rootNode}})

    MCPClientManager.callTool.mockRejectedValueOnce(new Error('MCP error'))

    await expect(runCommand({cell: node, queryType, store: mockStore})).resolves.not.toThrow()
  })
})

describe('internal research MCP slash parameter bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const runInternalResearchCommand = async ({queryType, command, prompt}) => {
    const node = {id: 'cmdNode', title: command, command}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [node.id]}
    node.parent = rootNode.id

    const mockStore = new Store({userId, workflowId, nodes: {cmdNode: node, rootNode}})
    MCPClientManager.callTool.mockResolvedValueOnce({content: 'ok', isError: false})

    await runCommand({cell: node, queryType, store: mockStore, prompt})

    return lastMockCallArg(MCPClientManager.callTool).toolArguments
  }

  it.each([
    [
      'web common flags',
      WEB_QUERY_TYPE,
      '/web --lang=ru --citation --xxs find D5 workflow evidence',
      {query: 'find D5 workflow evidence', lang: 'ru', citations: true, maxChunks: 'xxs'},
    ],
    [
      'scholar kebab-case min-year flag',
      SCHOLAR_QUERY_TYPE,
      '/scholar --min-year=2020 --citation --xxs agent workflow protocols',
      {query: 'agent workflow protocols', citations: true, maxChunks: 'xxs', minYear: 2020},
    ],
    [
      'scholar snake_case min_year flag',
      SCHOLAR_QUERY_TYPE,
      '/scholar --min_year=2024 --citation --xxs legacy scholar flag spelling',
      {query: 'legacy scholar flag spelling', citations: true, maxChunks: 'xxs', minYear: 2024},
    ],
    [
      'ext context flag',
      EXT_QUERY_TYPE,
      '/ext --context=my-context --xxs answer from memorized corpus: @@',
      {query: 'answer from memorized corpus: @@', context: 'my-context', maxChunks: 'xxs'},
    ],
    [
      'outline mixed research flags',
      OUTLINE_QUERY_TYPE,
      '/outline --web=xxs --lang=ru --citation map workflow protocols',
      {query: 'map workflow protocols', web: 'xxs', lang: 'ru', citations: true},
    ],
  ])('passes cleaned command text and static tool args for %s', async (_label, queryType, command, expectedArgs) => {
    await expect(runInternalResearchCommand({queryType, command})).resolves.toMatchObject(expectedArgs)
  })

  it('parses static args from the node command while cleaning an explicit prompt', async () => {
    const toolArguments = await runInternalResearchCommand({
      queryType: EXT_QUERY_TYPE,
      command: '/ext --context=qa-corpus --xxs fallback query',
      prompt: '/ext --context=qa-corpus --xxs explicit query @@',
    })

    expect(toolArguments).toMatchObject({
      context: 'qa-corpus',
      maxChunks: 'xxs',
      query: 'explicit query @@',
    })
  })
})

describe('/refine top-level run (P0.488: modifier-root error)', () => {
  /*
   * Top-level /refine (queryType=REFINE_QUERY_TYPE) is intercepted by
   * the modifierQueryTypes guard in runCommand before reaching CommandFactory.
   * It resolves (no throw) and writes a [✗ invalid] suffix + error child node,
   * giving the user a visible attribution instead of an opaque 500.
   */
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('writes [✗ invalid] suffix and error node without throwing', async () => {
    const refineNode = {
      id: 'refineNode',
      title: '/refine make it more concise',
      command: '/refine make it more concise',
      children: [],
      parent: 'rootNode',
    }
    const rootNode = {
      id: 'rootNode',
      title: 'Workflow',
      children: [refineNode.id],
    }
    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {refineNode, rootNode},
    })

    await runCommand({
      cell: refineNode,
      queryType: REFINE_QUERY_TYPE,
      store: mockStore,
    })

    const outputNodes = mockStore.getOutput().nodes
    const cellOut = outputNodes.find(n => n.id === 'refineNode')
    expect(cellOut?.title).toMatch(/\[✗ !\]/)
    expect(outputNodes.some(n => n.title?.match(/requires a parent cell/i))).toBe(true)
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

    const rootNode = {id: 'rootNode', title: 'Workflow', children: [switchNode.id]}
    switchNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        switchNode,
        caseNode,
        chatNode,
        rootNode,
      },
    })

    const mockLLMResponse = 'story'
    const llmSpy = jest.spyOn(BaseChatModel.prototype, 'invoke').mockResolvedValueOnce({content: mockLLMResponse})
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

    const rootNode = {id: 'rootNode', title: 'Workflow', children: [switchNode.id]}
    switchNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        switchNode,
        caseNode,
        chatNode,
        rootNode,
      },
    })

    const llmSpy = jest.spyOn(BaseChatModel.prototype, 'invoke').mockRejectedValueOnce(new Error('LLM Error'))

    await expect(
      runCommand({
        cell: switchNode,
        queryType: SWITCH_QUERY_TYPE,
        store: mockStore,
      }),
    ).resolves.not.toThrow()

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

    const rootNode = {id: 'rootNode', title: 'Workflow', children: [summarizeNode.id]}
    summarizeNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        summarizeNode,
        contentNode,
        rootNode,
      },
    })

    const mockLLMResponse = 'This is a summary of the text'
    const llmSpy = jest.spyOn(LLMChain.prototype, 'invoke').mockResolvedValueOnce({text: mockLLMResponse})
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
      workflowId,
      nodes: {
        summarizeNode,
        contentNode,
        rootNode,
      },
    })

    const llmSpy = jest.spyOn(LLMChain.prototype, 'invoke').mockResolvedValue({output_text: ''})
    const translateSpy = jest.spyOn(require('./translate'), 'translate')

    const errorSpy = jest.spyOn(mockStore.importer, 'createErrorNode').mockImplementation(() => {})

    await runCommand({
      cell: summarizeNode,
      queryType: SUMMARIZE_QUERY_TYPE,
      store: mockStore,
    })

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Nothing to summarize'), summarizeNode.id)

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

    const rootNode = {id: 'rootNode', title: 'Workflow', children: [stepsNode.id]}
    stepsNode.parent = rootNode.id
    chatNode1.parent = stepsNode.id
    chatNode2.parent = stepsNode.id
    chatNode3.parent = stepsNode.id

    const mockStore = new Store({
      userId,
      workflowId,
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
      .spyOn(BaseChatModel.prototype, 'invoke')
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

    const rootNode = {id: 'rootNode', title: 'Workflow', children: [stepsNode.id]}
    stepsNode.parent = rootNode.id
    chatNode1.parent = stepsNode.id
    chatNode2.parent = stepsNode.id
    chatNode3.parent = stepsNode.id

    const mockStore = new Store({
      userId,
      workflowId,
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
      .spyOn(BaseChatModel.prototype, 'invoke')
      .mockResolvedValueOnce({content: mockLLMResponse1})
      .mockRejectedValueOnce(new Error('LLM Error'))
      .mockResolvedValueOnce({content: mockLLMResponse3})

    await runCommand({
      cell: stepsNode,
      queryType: 'steps',
      store: mockStore,
    })

    const output = mockStore.getOutput()

    /* Step 1 succeeds, step 2 error is caught internally, step 3 still executes */
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
      title: 'Workflow',
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
      workflowId,
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
      .spyOn(BaseChatModel.prototype, 'invoke')
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
      title: 'Workflow',
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
      workflowId,
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
      .spyOn(BaseChatModel.prototype, 'invoke')
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
      title: 'Workflow',
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
      workflowId,
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
      .spyOn(BaseChatModel.prototype, 'invoke')
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
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [completionNode.id]}
    completionNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
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

describe('CompletionCommand — commodity :n=N routing contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([2, 3, 5, 10])(
    'routes /chat :n=%i through COMPLETION_QUERY_TYPE producing exactly %i provider invocations',
    async n => {
      const node = {
        id: 'node',
        parent: 'root',
        command: `/chat :n=${n} task`,
        children: [],
      }
      const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
      const store = new Store({userId, workflowId, nodes: {node, root}})

      getIntegrationSettings.mockResolvedValue({...settings, model: Model.OpenAI})

      let llmCallCount = 0
      jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockImplementation(async () => {
        llmCallCount++
        return `output ${llmCallCount}`
      })

      await runCommand({cell: node, queryType: COMPLETION_QUERY_TYPE, store})

      expect(llmCallCount).toBe(n)
    },
  )

  it.each([1, 2, 3])(':n=%i token is stripped from all LLM messages when routed via COMPLETION_QUERY_TYPE', async n => {
    const node = {
      id: 'node',
      parent: 'root',
      command: `/chat :n=${n} Reply with one word: hello`,
      children: [],
    }
    const root = {
      id: 'root',
      parent: null,
      title: 'Workflow',
      children: [node.id],
    }
    const store = new Store({userId, workflowId, nodes: {node, root}})

    getIntegrationSettings.mockResolvedValue({
      ...settings,
      model: Model.OpenAI,
    })

    const allMessages = []
    jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockImplementation(async messages => {
      allMessages.push(...messages)
      return 'hello'
    })

    await runCommand({cell: node, queryType: COMPLETION_QUERY_TYPE, store})

    expect(allMessages.length).toBeGreaterThan(0)
    allMessages.forEach(msg => {
      expect(msg.content).not.toMatch(/:n=\d+/)
      expect(msg.content).toContain('Reply with one word: hello')
    })
  })

  it('routes /chat :n=1 through COMPLETION_QUERY_TYPE as a single non-forked invocation', async () => {
    const node = {
      id: 'node',
      parent: 'root',
      command: '/chat :n=1 task',
      children: [],
    }
    const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
    const store = new Store({userId, workflowId, nodes: {node, root}})

    getIntegrationSettings.mockResolvedValue({...settings, model: Model.OpenAI})
    let llmCallCount = 0
    jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockImplementation(async () => {
      llmCallCount++
      return 'out'
    })

    await runCommand({cell: node, queryType: COMPLETION_QUERY_TYPE, store})

    expect(llmCallCount).toBe(1)
    expect(store.getNode(node.id).title ?? '').not.toMatch(/\[/)
  })

  it.each([
    [Model.Claude, 'ClaudeService.sendMessages', () => ClaudeService.sendMessages],
    [Model.YandexGPT, 'YandexService.completionWithRetry', () => YandexService.completionWithRetry],
  ])(
    'routes /chat :n=2 through %s family producing exactly 2 provider invocations — no double-fork',
    async (model, _label, getSpy) => {
      const node = {
        id: 'node',
        parent: 'root',
        command: '/chat :n=2 task',
        children: [],
      }
      const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
      const store = new Store({userId, workflowId, nodes: {node, root}})

      getIntegrationSettings.mockResolvedValue({...settings, model})

      const mockResponse =
        model === Model.Claude
          ? {content: [{type: 'text', text: 'ok'}]}
          : {
              result: {
                alternatives: [{message: {text: 'ok'}}],
                usage: {inputTextTokens: 0, completionTokens: 0, totalTokens: 0},
              },
            }

      let callCount = 0
      const spy = getSpy()
      spy.mockImplementation(async () => {
        callCount++
        return mockResponse
      })

      await runCommand({cell: node, queryType: COMPLETION_QUERY_TYPE, store})

      expect(callCount).toBe(2)
    },
  )

  it('commodity suffix [✓ K/N] is written to the cell when routed via COMPLETION_QUERY_TYPE with :n=3', async () => {
    const node = {
      id: 'node',
      parent: 'root',
      command: '/chat :n=3 task',
      children: [],
    }
    const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
    const store = new Store({userId, workflowId, nodes: {node, root}})

    getIntegrationSettings.mockResolvedValue({...settings, model: Model.OpenAI})
    const chatSpy = jest
      .spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI')
      .mockResolvedValue('A well-formed response output from the language model.')

    await runCommand({cell: node, queryType: COMPLETION_QUERY_TYPE, store})

    expect(chatSpy).toHaveBeenCalledTimes(3)
    expect(store.getNode(node.id).title).toMatch(/\[✓/)
  })
})

describe('commodity :n=N — direct CHAT_QUERY_TYPE path (no CompletionCommand routing)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([2, 3, 5])('routes exactly %i LLM invocations with :n=%i on direct CHAT_QUERY_TYPE', async n => {
    const node = {
      id: 'node',
      parent: 'root',
      command: `/chat :n=${n} task`,
      children: [],
    }
    const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
    const store = new Store({userId, workflowId, nodes: {node, root}})

    let callCount = 0
    jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockImplementation(async () => {
      callCount++
      return `output ${callCount}`
    })

    await runCommand({cell: node, queryType: CHAT_QUERY_TYPE, store})

    expect(callCount).toBe(n)
  })

  it(':n=N token is absent from messages sent to the LLM on direct CHAT_QUERY_TYPE', async () => {
    const node = {
      id: 'node',
      parent: 'root',
      command: '/chat :n=2 Reply with one word: hello',
      children: [],
    }
    const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
    const store = new Store({userId, workflowId, nodes: {node, root}})

    const allMessages = []
    jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockImplementation(async messages => {
      allMessages.push(...messages)
      return 'hello'
    })

    await runCommand({cell: node, queryType: CHAT_QUERY_TYPE, store})

    expect(allMessages.length).toBeGreaterThan(0)
    allMessages.forEach(msg => {
      expect(msg.content).not.toMatch(/:n=\d+/)
      expect(msg.content).toContain('Reply with one word: hello')
    })
  })

  it('generated child node titles do not contain :n= on direct CHAT_QUERY_TYPE', async () => {
    const node = {
      id: 'node',
      parent: 'root',
      command: '/chat :n=2 Reply with one word: hello',
      children: [],
    }
    const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
    const store = new Store({userId, workflowId, nodes: {node, root}})

    jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockResolvedValue('hello')

    await runCommand({cell: node, queryType: CHAT_QUERY_TYPE, store})

    const childNodes = store.getOutput().nodes.filter(n => n.parent === node.id)
    expect(childNodes.length).toBeGreaterThan(0)
    childNodes.forEach(n => {
      expect(n.title).not.toMatch(/:n=\d+/)
    })
  })

  const runDirectCommodity = async outcomes => {
    const node = {
      id: 'node',
      parent: 'root',
      command: `/chat :n=${outcomes.length} task`,
      children: [],
    }
    const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
    const store = new Store({userId, workflowId, nodes: {node, root}})

    const chat = jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI')
    outcomes.forEach(outcome => {
      if (outcome instanceof Error) chat.mockRejectedValueOnce(outcome)
      else chat.mockResolvedValueOnce(outcome)
    })

    await runCommand({cell: node, queryType: CHAT_QUERY_TYPE, store})

    return {
      childTitles: store
        .getOutput()
        .nodes.filter(n => n.parent === node.id)
        .map(n => n.title),
      cellTitle: store.getNode(node.id).title,
    }
  }

  it.each([
    {
      name: 'all attempts produce output',
      outcomes: ['alpha', 'beta'],
      childTitles: ['alpha', 'beta'],
      suffix: /\[✓ 2\/2\]$/,
    },
    {
      name: 'provider/runtime error attempts are excluded while valid short output survives',
      outcomes: [new Error('provider rejected credentials'), 'hello'],
      childTitles: ['hello'],
      suffix: /\[✓ 1\/2 ⚠\]$/,
    },
    {
      name: 'provider/runtime error and refusal attempts are both excluded',
      outcomes: [new Error('provider rejected credentials'), "I'm sorry, I cannot help with that.", 'ok'],
      childTitles: ['ok'],
      suffix: /\[✓ 1\/3 ⚠\]$/,
    },
    {
      name: 'all attempts fail before producing acceptable output',
      outcomes: [new Error('provider rejected credentials'), new Error('provider rejected credentials')],
      childTitles: [],
      suffix: /\[✗ 0\/2\]$/,
    },
  ])('commodity merge classifies fork outcomes: $name', async ({outcomes, childTitles, suffix}) => {
    const result = await runDirectCommodity(outcomes)

    expect(result.childTitles).toEqual(childTitles)
    expect(result.cellTitle).toMatch(suffix)
  })
})

describe('commodity :n=N — generated child titles contain only task text (COMPLETION_QUERY_TYPE)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('child node titles written to the store do not contain :n= after commodity run via routing', async () => {
    const node = {
      id: 'node',
      parent: 'root',
      command: '/chat :n=2 Reply with one word: hello',
      children: [],
    }
    const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
    const store = new Store({userId, workflowId, nodes: {node, root}})

    getIntegrationSettings.mockResolvedValue({...settings, model: Model.OpenAI})
    jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockResolvedValue('hello')

    await runCommand({cell: node, queryType: COMPLETION_QUERY_TYPE, store})

    const childNodes = store.getOutput().nodes.filter(n => n.parent === node.id)
    expect(childNodes.length).toBeGreaterThan(0)
    childNodes.forEach(n => {
      expect(n.title).not.toMatch(/:n=\d+/)
    })
  })
})

describe('/memorize dispatch test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should extract parent content and dispatch to MCP tool', async () => {
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

    const rootNode = {id: 'rootNode', title: 'Workflow', children: [parentNode.id]}
    parentNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {memorizeNode, parentNode, childNode, rootNode},
    })

    MCPClientManager.callTool.mockResolvedValueOnce({content: 'Memorized 2 chunks', isError: false})

    await runCommand({cell: memorizeNode, queryType: MEMORIZE_QUERY_TYPE, store: mockStore})

    expect(MCPClientManager.callTool).toHaveBeenCalledTimes(1)
    const callArgs = MCPClientManager.callTool.mock.calls[0][0]
    expect(callArgs.toolArguments.text).toContain('Parent Content')
    expect(callArgs.toolArguments.context).toBe('test')
  })

  it('should handle memorize error gracefully', async () => {
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
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [parentNode.id]}
    parentNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {memorizeNode, parentNode, rootNode},
    })

    MCPClientManager.callTool.mockRejectedValueOnce(new Error('MCP connection failed'))

    await expect(
      runCommand({cell: memorizeNode, queryType: MEMORIZE_QUERY_TYPE, store: mockStore}),
    ).resolves.not.toThrow()
  })
})

describe('MCPCommand run test', () => {
  const mcpAlias = {
    alias: '/mymcp',
    serverUrl: 'http://localhost:3001/mcp',
    transport: 'streamable-http',
    toolName: 'summarize',
  }

  it('should create nodes from MCP tool response', async () => {
    const mcpNode = {id: 'mcpNode', title: '/mymcp explain quantum physics', command: '/mymcp explain quantum physics'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [mcpNode.id]}
    mcpNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        mcpNode,
        rootNode,
      },
    })

    MCPClientManager.callTool.mockResolvedValueOnce({content: 'Quantum physics explained', isError: false})

    await runCommand({
      cell: mcpNode,
      store: mockStore,
      mcpAlias,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Quantum physics explained',
          parent: mcpNode.id,
        }),
      ]),
    )
  })

  it('should resolve @ and # references before sending MCP tool arguments', async () => {
    const {commandNode, nodes} = createReferenceWorkflow({
      nodeId: 'mcpNode',
      command: '/mymcp summarize @@topic and ##_source',
      refDefinition: '@topic reference topic',
      hashDefinition: '#_source hash source',
    })
    const mockStore = new Store({userId, workflowId, aliases: {mcp: [mcpAlias], rpc: []}, nodes})

    MCPClientManager.callTool.mockResolvedValueOnce({content: 'resolved', isError: false})

    await runCommand({cell: commandNode, store: mockStore, mcpAlias})

    const prompt = lastMockCallArg(MCPClientManager.callTool).toolArguments.prompt
    expectResolvedExternalPrompt(prompt, ['reference topic', 'hash source'])
  })

  it('should preserve typed trailing whitespace after resolving MCP tool arguments', async () => {
    const trailingWhitespace = '   '
    const {commandNode, nodes} = createReferenceWorkflow({
      nodeId: 'mcpNode',
      command: `/mymcp summarize @@topic and ##_source${trailingWhitespace}`,
      refDefinition: '@topic reference topic',
      hashDefinition: '#_source hash source',
    })
    const mockStore = new Store({userId, workflowId, aliases: {mcp: [mcpAlias], rpc: []}, nodes})

    MCPClientManager.callTool.mockResolvedValueOnce({content: 'resolved', isError: false})

    await runCommand({cell: commandNode, store: mockStore, mcpAlias})

    const prompt = lastMockCallArg(MCPClientManager.callTool).toolArguments.prompt
    expectResolvedExternalPrompt(prompt, ['reference topic', 'hash source'], trailingWhitespace)
  })

  it('should handle error when MCP tool connection fails', async () => {
    const mcpNode = {id: 'mcpNode', title: '/mymcp explain quantum physics', command: '/mymcp explain quantum physics'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [mcpNode.id]}
    mcpNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        mcpNode,
        rootNode,
      },
    })

    MCPClientManager.callTool.mockRejectedValueOnce(new Error('Connection refused'))
    const errorSpy = jest.spyOn(mockStore.importer, 'createErrorNode').mockImplementation(() => {})

    await runCommand({
      cell: mcpNode,
      store: mockStore,
      mcpAlias,
    })

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Connection refused'), mcpNode.id)
  })

  it('should handle error when MCP tool returns isError', async () => {
    const mcpNode = {id: 'mcpNode', title: '/mymcp explain quantum physics', command: '/mymcp explain quantum physics'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [mcpNode.id]}
    mcpNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        mcpNode,
        rootNode,
      },
    })

    MCPClientManager.callTool.mockResolvedValueOnce({content: 'Tool execution failed', isError: true})
    const errorSpy = jest.spyOn(mockStore.importer, 'createErrorNode').mockImplementation(() => {})

    await runCommand({
      cell: mcpNode,
      store: mockStore,
      mcpAlias,
    })

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Tool execution failed'), mcpNode.id)
  })

  it('should handle empty MCP response by creating placeholder node', async () => {
    const mcpNode = {id: 'mcpNode', title: '/mymcp summarize', command: '/mymcp summarize'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [mcpNode.id]}
    mcpNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        mcpNode,
        rootNode,
      },
    })

    MCPClientManager.callTool.mockResolvedValueOnce({content: '', isError: false})

    await runCommand({
      cell: mcpNode,
      store: mockStore,
      mcpAlias,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: '(empty MCP response)',
          parent: mcpNode.id,
        }),
      ]),
    )
  })

  it('should handle null MCP response by creating placeholder node', async () => {
    const mcpNode = {id: 'mcpNode', title: '/mymcp query', command: '/mymcp query'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [mcpNode.id]}
    mcpNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        mcpNode,
        rootNode,
      },
    })

    MCPClientManager.callTool.mockResolvedValueOnce({content: null, isError: false})

    await runCommand({
      cell: mcpNode,
      store: mockStore,
      mcpAlias,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: '(empty MCP response)',
          parent: mcpNode.id,
        }),
      ]),
    )
  })
})

describe('RPCCommand run test', () => {
  const sshAlias = {
    alias: '/ssh1',
    protocol: 'ssh',
    host: 'vm1.example.com',
    port: 22,
    username: 'deploy',
    privateKey: 'fake-key',
    commandTemplate: 'run-script "{{prompt}}"',
    outputFormat: 'text',
  }

  const httpAlias = {
    alias: '/api1',
    protocol: 'http',
    url: 'https://api.example.com/exec',
    method: 'POST',
    bodyTemplate: '{"cmd":"{{prompt}}"}',
    outputFormat: 'json',
    outputField: 'result',
  }

  beforeEach(() => {
    mockSSHExecute.mockResolvedValue({stdout: 'SSH execution result', stderr: '', exitCode: 0})
    mockHTTPExecute.mockResolvedValue({body: '{"result":"HTTP response"}', status: 200, isError: false})
    mockACPExecute.mockResolvedValue({output: 'ACP execution result', sessionId: null, exitCode: 0})
  })

  it('should execute SSH command and create nodes from output', async () => {
    const rpcNode = {id: 'rpcNode', title: '/ssh1 deploy app', command: '/ssh1 deploy app'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [rpcNode.id]}
    rpcNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        rpcNode,
        rootNode,
      },
    })

    await runCommand({
      cell: rpcNode,
      store: mockStore,
      rpcAlias: sshAlias,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'SSH execution result',
          parent: rpcNode.id,
        }),
      ]),
    )
  })

  it('should execute HTTP request and extract JSON field', async () => {
    const rpcNode = {id: 'rpcNode', title: '/api1 run task', command: '/api1 run task'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [rpcNode.id]}
    rpcNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        rpcNode,
        rootNode,
      },
    })

    await runCommand({
      cell: rpcNode,
      store: mockStore,
      rpcAlias: httpAlias,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'HTTP response',
          parent: rpcNode.id,
        }),
      ]),
    )
  })

  it('should resolve @ and # references before interpolating RPC HTTP body', async () => {
    const {commandNode, nodes} = createReferenceWorkflow({
      nodeId: 'rpcNode',
      command: '/api1 run @@task using ##_source',
      refDefinition: '@task referenced task',
      hashDefinition: '#_source referenced source',
    })
    const mockStore = new Store({userId, workflowId, aliases: {mcp: [], rpc: [httpAlias]}, nodes})

    await runCommand({cell: commandNode, store: mockStore, rpcAlias: httpAlias})

    const {body} = lastMockCallArg(mockHTTPExecute)
    expectResolvedExternalPrompt(body, ['referenced task', 'referenced source'])
  })

  it('should preserve typed trailing whitespace after resolving RPC HTTP body prompt', async () => {
    const trailingWhitespace = '   '
    const {commandNode, nodes} = createReferenceWorkflow({
      nodeId: 'rpcNode',
      command: `/api1 run @@task using ##_source${trailingWhitespace}`,
      refDefinition: '@task referenced task',
      hashDefinition: '#_source referenced source',
    })
    const mockStore = new Store({userId, workflowId, aliases: {mcp: [], rpc: [httpAlias]}, nodes})

    await runCommand({cell: commandNode, store: mockStore, rpcAlias: httpAlias})

    const {body} = lastMockCallArg(mockHTTPExecute)
    const parsedBody = JSON.parse(body)
    expectResolvedExternalPrompt(parsedBody.cmd, ['referenced task', 'referenced source'], trailingWhitespace)
  })

  it('should create error node when SSH execution fails', async () => {
    mockSSHExecute.mockRejectedValueOnce(new Error('SSH connection failed'))

    const rpcNode = {id: 'rpcNode', title: '/ssh1 deploy', command: '/ssh1 deploy'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [rpcNode.id]}
    rpcNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        rpcNode,
        rootNode,
      },
    })

    await runCommand({
      cell: rpcNode,
      store: mockStore,
      rpcAlias: sshAlias,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Error: SSH connection failed',
          parent: rpcNode.id,
        }),
      ]),
    )
  })

  it('should execute ACP-local command and create nodes from output', async () => {
    const acpAlias = {
      alias: '/ide-acp',
      protocol: 'acp-local',
      command: 'npx',
      args: '-y @agentclientprotocol/claude-agent-acp',
      workingDir: '/workspace',
      autoApprove: 'all',
      outputFormat: 'text',
    }

    mockACPExecute.mockResolvedValueOnce({
      output: 'ACP command executed successfully',
      sessionId: 'session-abc-123',
      exitCode: 0,
    })

    const rpcNode = {id: 'rpcNode', title: '/ide-acp build feature', command: '/ide-acp build feature'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [rpcNode.id]}
    rpcNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        rpcNode,
        rootNode,
      },
    })

    await runCommand({
      cell: rpcNode,
      store: mockStore,
      rpcAlias: acpAlias,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'ACP command executed successfully',
          parent: rpcNode.id,
        }),
      ]),
    )
  })

  it('should create error node when ACP execution fails', async () => {
    const acpAlias = {
      alias: '/qa-acp',
      protocol: 'acp-local',
      command: 'npx',
      args: 'playwright test',
      workingDir: '/workspace',
      autoApprove: 'none',
      outputFormat: 'text',
    }

    mockACPExecute.mockRejectedValueOnce(new Error('ACP process timeout'))

    const rpcNode = {id: 'rpcNode', title: '/qa-acp run tests', command: '/qa-acp run tests'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [rpcNode.id]}
    rpcNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        rpcNode,
        rootNode,
      },
    })

    await runCommand({
      cell: rpcNode,
      store: mockStore,
      rpcAlias: acpAlias,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Error: ACP process timeout',
          parent: rpcNode.id,
        }),
      ]),
    )
  })

  it('should handle empty RPC output by creating placeholder node', async () => {
    mockSSHExecute.mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0})

    const rpcNode = {id: 'rpcNode', title: '/ssh1 status', command: '/ssh1 status'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [rpcNode.id]}
    rpcNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        rpcNode,
        rootNode,
      },
    })

    await runCommand({
      cell: rpcNode,
      store: mockStore,
      rpcAlias: sshAlias,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: '(empty RPC response)',
          parent: rpcNode.id,
        }),
      ]),
    )
  })

  it('should create error node for unknown RPC protocol', async () => {
    const unknownAlias = {
      alias: '/unknown',
      protocol: 'unknown-protocol',
      outputFormat: 'text',
    }

    const rpcNode = {id: 'rpcNode', title: '/unknown test', command: '/unknown test'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [rpcNode.id]}
    rpcNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        rpcNode,
        rootNode,
      },
    })

    await runCommand({
      cell: rpcNode,
      store: mockStore,
      rpcAlias: unknownAlias,
    })

    const output = mockStore.getOutput()

    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.stringMatching(/Error:.*Unknown RPC protocol/),
          parent: rpcNode.id,
        }),
      ]),
    )
  })

  it('should handle ACP with null sessionId by attempting extraction from output', async () => {
    const acpAlias = {
      alias: '/ide-acp',
      protocol: 'acp-local',
      command: 'npx',
      args: '-y @agentclientprotocol/claude-agent-acp',
      workingDir: '/workspace',
      autoApprove: 'all',
      outputFormat: 'json',
      sessionIdField: 'session_id',
    }

    mockACPExecute.mockResolvedValueOnce({
      output: '{"result":"Success","session_id":"extracted-123"}',
      sessionId: null,
      exitCode: 0,
    })

    const rpcNode = {id: 'rpcNode', title: '/ide-acp build', command: '/ide-acp build'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [rpcNode.id]}
    rpcNode.parent = rootNode.id

    const mockStore = new Store({
      userId,
      workflowId,
      nodes: {
        rpcNode,
        rootNode,
      },
    })

    await runCommand({
      cell: rpcNode,
      store: mockStore,
      rpcAlias: acpAlias,
    })

    expect(IntegrationSessionRepository.upsertSessionId).toHaveBeenCalledWith(
      userId,
      '/ide-acp',
      'rpc',
      'extracted-123',
    )
  })
})

describe('/download dispatch routing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('routes DOWNLOAD_QUERY_TYPE to the file-artifact path, not MCPClientManager', async () => {
    const node = {id: 'dlNode', title: '/download https://example.com', command: '/download https://example.com'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [node.id]}
    node.parent = rootNode.id
    const mockStore = new Store({userId, workflowId, nodes: {dlNode: node, rootNode}})

    scrapeFiles.mockResolvedValueOnce([{filename: 'page.txt', content: 'content'}])
    WorkflowFile.write.mockResolvedValueOnce({_id: 'fid'})

    await runCommand({cell: node, queryType: DOWNLOAD_QUERY_TYPE, store: mockStore})

    expect(scrapeFiles).toHaveBeenCalledTimes(1)
    expect(WorkflowFile.write).toHaveBeenCalledTimes(1)
    expect(MCPClientManager.callTool).not.toHaveBeenCalled()
  })

  it('resolves without throwing when the download path encounters an error', async () => {
    const node = {id: 'dlNode', title: '/download https://example.com', command: '/download https://example.com'}
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [node.id]}
    node.parent = rootNode.id
    const mockStore = new Store({userId, workflowId, nodes: {dlNode: node, rootNode}})

    scrapeFiles.mockRejectedValueOnce(new Error('Connection refused'))

    await expect(runCommand({cell: node, queryType: DOWNLOAD_QUERY_TYPE, store: mockStore})).resolves.not.toThrow()
  })
})

describe('commodity :n=N × MCP alias', () => {
  const mcpSeamAlias = {
    alias: '/qa-mcp',
    serverUrl: 'http://localhost:3100/mcp',
    transport: 'streamable-http',
    toolName: 'run',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([2, 3, 5])(
    'suppresses the fan-out for /qa-mcp :n=%i — invokes the MCP tool exactly once, one output node, honest suppression metadata',
    async n => {
      const node = {id: 'node', parent: 'root', command: `/qa-mcp :n=${n} task-prompt`, children: []}
      const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
      const store = new Store({userId, workflowId, nodes: {node, root}})

      MCPClientManager.callTool.mockResolvedValue({content: 'result', isError: false})

      await runCommand({cell: node, store, mcpAlias: mcpSeamAlias})

      expect(MCPClientManager.callTool).toHaveBeenCalledTimes(1)
      expect(store.getOutput().nodes.filter(m => m.parent === node.id)).toHaveLength(1)
      expect(store.getNode(node.id).reliabilityMetadata).toEqual(
        expect.objectContaining({
          suppressed: true,
          cause: 'side-effecting-alias',
          requestedN: n,
          mode: 'suppressed',
          total: 1,
          eligible: 1,
        }),
      )
    },
  )

  it.each([1, 2, 3])(':n=%i token is absent from the MCP tool payload of the single suppressed execution', async n => {
    const node = {id: 'node', parent: 'root', command: `/qa-mcp :n=${n} task-prompt`, children: []}
    const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
    const store = new Store({userId, workflowId, nodes: {node, root}})

    MCPClientManager.callTool.mockResolvedValue({content: 'result', isError: false})

    await runCommand({cell: node, store, mcpAlias: mcpSeamAlias})

    MCPClientManager.callTool.mock.calls.forEach(([callArgs]) => {
      expect(callArgs.toolArguments.prompt).not.toMatch(/:n=/)
      expect(callArgs.toolArguments.prompt).toContain('task-prompt')
    })
  })

  it('@@ and ## references are resolved within MCP payload after :n=N is stripped', async () => {
    const {commandNode, nodes} = createReferenceWorkflow({
      nodeId: 'mcpNode',
      command: '/qa-mcp :n=2 @@topic and ##_source',
      refDefinition: '@topic seam-topic',
      hashDefinition: '#_source seam-source',
    })
    const store = new Store({userId, workflowId, nodes})

    MCPClientManager.callTool.mockResolvedValue({content: 'r', isError: false})

    await runCommand({cell: commandNode, store, mcpAlias: mcpSeamAlias})

    expect(MCPClientManager.callTool).toHaveBeenCalledTimes(1)
    MCPClientManager.callTool.mock.calls.forEach(([callArgs]) => {
      expect(callArgs.toolArguments.prompt).not.toMatch(/:n=/)
      expectResolvedExternalPrompt(callArgs.toolArguments.prompt, ['seam-topic', 'seam-source'])
    })
  })
})

describe('commodity :n=N × RPC alias', () => {
  const rpcSeamAlias = {
    alias: '/qa-rpc',
    protocol: 'ssh',
    host: 'vm1.example.com',
    port: 22,
    username: 'deploy',
    privateKey: 'fake-key',
    commandTemplate: '{{prompt}}',
    outputFormat: 'text',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([2, 3, 5])(
    'suppresses the fan-out for /qa-rpc :n=%i — runs the SSH command exactly once, one output node, honest suppression metadata',
    async n => {
      const node = {id: 'node', parent: 'root', command: `/qa-rpc :n=${n} task-prompt`, children: []}
      const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
      const store = new Store({userId, workflowId, nodes: {node, root}})

      mockSSHExecute.mockResolvedValue({stdout: 'rpc-result', stderr: '', exitCode: 0})

      await runCommand({cell: node, store, rpcAlias: rpcSeamAlias})

      expect(mockSSHExecute).toHaveBeenCalledTimes(1)
      expect(store.getOutput().nodes.filter(m => m.parent === node.id)).toHaveLength(1)
      expect(store.getNode(node.id).reliabilityMetadata).toEqual(
        expect.objectContaining({
          suppressed: true,
          cause: 'side-effecting-alias',
          requestedN: n,
          mode: 'suppressed',
          total: 1,
          eligible: 1,
        }),
      )
    },
  )

  it.each([1, 2, 3])(
    ':n=%i token is absent from the SSH command string of the single suppressed execution',
    async n => {
      const node = {id: 'node', parent: 'root', command: `/qa-rpc :n=${n} task-prompt`, children: []}
      const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
      const store = new Store({userId, workflowId, nodes: {node, root}})

      mockSSHExecute.mockResolvedValue({stdout: 'rpc-result', stderr: '', exitCode: 0})

      await runCommand({cell: node, store, rpcAlias: rpcSeamAlias})

      mockSSHExecute.mock.calls.forEach(([params]) => {
        expect(params.command).not.toMatch(/:n=/)
        expect(params.command).toContain('task-prompt')
      })
    },
  )

  it('@@ and ## references are resolved within RPC command string after :n=N is stripped', async () => {
    const {commandNode, nodes} = createReferenceWorkflow({
      nodeId: 'rpcNode',
      command: '/qa-rpc :n=2 @@topic and ##_source',
      refDefinition: '@topic seam-topic',
      hashDefinition: '#_source seam-source',
    })
    const store = new Store({userId, workflowId, nodes})

    mockSSHExecute.mockResolvedValue({stdout: 'r', stderr: '', exitCode: 0})

    await runCommand({cell: commandNode, store, rpcAlias: rpcSeamAlias})

    expect(mockSSHExecute).toHaveBeenCalledTimes(1)
    mockSSHExecute.mock.calls.forEach(([params]) => {
      expect(params.command).not.toMatch(/:n=/)
      expectResolvedExternalPrompt(params.command, ['seam-topic', 'seam-source'])
    })
  })
})

describe('commodity :n=N × /mcp fusion (MCP_FUSION_QUERY_TYPE, no alias param)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('suppresses the fan-out for /mcp :n=3 — invokes the fusion command exactly once, one output node, honest suppression metadata', async () => {
    const node = {id: 'node', parent: 'root', command: '/mcp :n=3 task-prompt', children: []}
    const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
    const store = new Store({userId, workflowId, nodes: {node, root}})

    const runSpy = jest.spyOn(MCPFusionCommand.prototype, 'run').mockImplementation(async function (cell) {
      this.store.createNode({title: 'fusion-result', parent: cell.id})
    })

    await runCommand({cell: node, queryType: MCP_FUSION_QUERY_TYPE, store})

    expect(runSpy).toHaveBeenCalledTimes(1)
    expect(store.getOutput().nodes.filter(m => m.parent === node.id)).toHaveLength(1)
    expect(store.getNode(node.id).reliabilityMetadata).toEqual(
      expect.objectContaining({
        suppressed: true,
        cause: 'side-effecting-alias',
        requestedN: 3,
        mode: 'suppressed',
        total: 1,
        eligible: 1,
      }),
    )
  })
})

describe('commodity :n=N guard narrowness — native /chat fan-out is unaffected', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('native /chat :n=3 still creates exactly 3 forks / 3 output nodes with no suppression metadata', async () => {
    const node = {id: 'node', parent: 'root', command: '/chat :n=3 task', children: []}
    const root = {id: 'root', parent: null, title: 'Workflow', children: [node.id]}
    const store = new Store({userId, workflowId, nodes: {node, root}})

    let callCount = 0
    jest.spyOn(ChatCommand.prototype, 'replyChatOpenAIAPI').mockImplementation(async () => {
      callCount++
      return `A well-formed response output ${callCount}`
    })

    await runCommand({cell: node, queryType: CHAT_QUERY_TYPE, store})

    expect(callCount).toBe(3)
    expect(store.getOutput().nodes.filter(m => m.parent === node.id)).toHaveLength(3)
    expect(store.getNode(node.id).reliabilityMetadata.mode).toBe('commodity')
    expect(store.getNode(node.id).reliabilityMetadata.suppressed).toBeUndefined()
  })
})
