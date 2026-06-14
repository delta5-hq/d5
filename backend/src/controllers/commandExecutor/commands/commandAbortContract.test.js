import Store from './utils/Store'
import {ChatCommand} from './ChatCommand'
import {ClaudeCommand} from './ClaudeCommand'
import {CustomLLMChatCommand} from './CustomLLMChatCommand'
import {DeepseekCommand} from './DeepseekCommand'
import {ExtCommand} from './ExtCommand'
import {PerplexityCommand} from './PerplexityCommand'
import {QwenCommand} from './QwenCommand'
import {ScholarCommand} from './ScholarCommand'
import {SummarizeCommand} from './SummarizeCommand'
import {WebCommand} from './WebCommand'
import {YandexCommand} from './YandexCommand'
import {createAbortError} from './utils/executionSignal'

const makeStore = () => {
  const store = new Store({
    userId: 'userId',
    workflowId: 'workflowId',
    nodes: {},
  })

  store.importer.createNodes = jest.fn()
  store.importer.createTable = jest.fn()
  store.importer.createJoinNode = jest.fn()
  store.importer.createErrorNode = jest.fn()

  return store
}

const commandCases = [
  {
    name: 'ChatCommand',
    CommandClass: ChatCommand,
    replyMethod: 'replyChatOpenAIAPI',
    node: {id: 'node', command: '/chat prompt'},
    run: (command, node, signal) => command.run(node, null, node.command, {signal}),
  },
  {
    name: 'ClaudeCommand',
    CommandClass: ClaudeCommand,
    replyMethod: 'replyClaude',
    node: {id: 'node', command: '/claude prompt'},
    run: (command, node, signal) => command.run(node, null, node.command, {signal}),
  },
  {
    name: 'CustomLLMChatCommand',
    CommandClass: CustomLLMChatCommand,
    replyMethod: 'replyChat',
    node: {id: 'node', command: '/custom prompt'},
    run: (command, node, signal) => command.run(node, null, node.command, {signal}),
  },
  {
    name: 'DeepseekCommand',
    CommandClass: DeepseekCommand,
    replyMethod: 'replyDeepseek',
    node: {id: 'node', command: '/deepseek prompt'},
    run: (command, node, signal) => command.run(node, null, node.command, {signal}),
  },
  {
    name: 'ExtCommand',
    CommandClass: ExtCommand,
    replyMethod: 'createResponseExt',
    node: {id: 'node', command: '/ext prompt'},
    run: (command, node, signal) => command.run(node, node.command, {signal}),
  },
  {
    name: 'PerplexityCommand',
    CommandClass: PerplexityCommand,
    replyMethod: 'reply',
    node: {id: 'node', command: '/perplexity prompt'},
    run: (command, node, signal) => command.run(node, null, node.command, {signal}),
  },
  {
    name: 'QwenCommand',
    CommandClass: QwenCommand,
    replyMethod: 'replyQwen',
    node: {id: 'node', command: '/qwen prompt'},
    run: (command, node, signal) => command.run(node, null, node.command, {signal}),
  },
  {
    name: 'ScholarCommand',
    CommandClass: ScholarCommand,
    replyMethod: 'createResponseScholar',
    node: {id: 'node', command: '/scholar prompt'},
    run: (command, node, signal) => command.run(node, node.command, {signal}),
  },
  {
    name: 'SummarizeCommand',
    CommandClass: SummarizeCommand,
    replyMethod: 'replyDefault',
    node: {id: 'node', command: '/summarize prompt'},
    run: (command, node, signal) => command.run(node, node.command, {signal}),
  },
  {
    name: 'WebCommand',
    CommandClass: WebCommand,
    replyMethod: 'createResponseWeb',
    node: {id: 'node', command: '/web prompt'},
    run: (command, node, signal) => command.run(node, node.command, {signal}),
  },
  {
    name: 'YandexCommand',
    CommandClass: YandexCommand,
    replyMethod: 'replyYandex',
    node: {id: 'node', command: '/yandexgpt prompt'},
    run: (command, node, signal) => command.run(node, null, node.command, {signal}),
  },
]

const expectNoWorkflowMutation = store => {
  expect(store.importer.createNodes).not.toHaveBeenCalled()
  expect(store.importer.createTable).not.toHaveBeenCalled()
  expect(store.importer.createJoinNode).not.toHaveBeenCalled()
  expect(store.importer.createErrorNode).not.toHaveBeenCalled()
}

describe('command abort contract', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each(commandCases)(
    '$name rethrows AbortError without converting cancellation into workflow output',
    async spec => {
      const store = makeStore()
      const command = new spec.CommandClass('userId', 'workflowId', store)
      const error = createAbortError()
      jest.spyOn(spec.CommandClass.prototype, spec.replyMethod).mockRejectedValue(error)

      await expect(spec.run(command, spec.node, new AbortController().signal)).rejects.toBe(error)

      expectNoWorkflowMutation(store)
    },
  )

  it.each(commandCases)('$name checks cancellation after response and before workflow mutation', async spec => {
    const store = makeStore()
    const command = new spec.CommandClass('userId', 'workflowId', store)
    const controller = new AbortController()
    jest.spyOn(spec.CommandClass.prototype, spec.replyMethod).mockImplementation(async () => {
      controller.abort()
      return 'late response'
    })

    await expect(spec.run(command, spec.node, controller.signal)).rejects.toMatchObject({name: 'AbortError'})

    expectNoWorkflowMutation(store)
  })
})
