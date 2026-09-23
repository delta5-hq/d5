import debug from 'debug'
import {callTool, withClient} from './mcp/MCPClientManager'
import {MCPToolAdapter} from './mcp/MCPToolAdapter'
import {determineLLMType, getIntegrationSettings, getLLM} from './utils/langchain/getLLM'
import {assertToolCallingCapability, createMCPAgentExecutor} from './utils/langchain/getAgentExecutor'
import {isInternalMcpServer, buildInternalServerEnv, resolveInternalServerScript} from './mcp/internalServerEnv'
import {runWithErrorNode} from './shared/runWithErrorNode'
import {resolveExternalCommandPrompt} from './shared/resolveExternalCommandPrompt'
import {EXECUTION_FAILURE_TYPE} from './utils/executionNodeStatus'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'

const MCP_TOOL_NAME_AUTO = 'auto'

const log = debug('delta5:app:Command:MCP')

class MCPToolError extends Error {
  constructor() {
    super('MCP tool reported failure')
    this.name = 'MCPToolError'
  }
}

export class MCPCommand {
  /**
   * @param {string} userId
   * @param {string} workflowId
   * @param {Store} store
   * @param {import('./mcp/aliasResolver').MCPAliasConfig} aliasConfig
   */
  constructor(userId, workflowId, store, aliasConfig) {
    this.store = store
    this.userId = userId
    this.workflowId = workflowId
    this.aliasConfig = aliasConfig
    this.log = log.extend(userId, '/')
    if (this.workflowId) {
      this.log = this.log.extend(workflowId, '#')
    }
    this.logError = this.log.extend('ERROR*', '::')
  }

  buildToolArguments(prompt) {
    const inputField = this.aliasConfig.toolInputField || 'prompt'
    return {
      ...this.aliasConfig.toolStaticArgs,
      [inputField]: prompt,
    }
  }

  transportConfig(extraEnv, normalizedArgs) {
    const {serverUrl, transport, headers, command, args, env} = this.aliasConfig
    const mergedEnv = extraEnv ? {...env, ...extraEnv} : env
    const resolvedArgs = normalizedArgs ?? args
    return {
      serverUrl,
      transport,
      headers,
      command,
      args: resolvedArgs,
      env: mergedEnv,
    }
  }

  async runAgentMode(prompt, signal, extraEnv, normalizedArgs) {
    const settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
    const llmType = determineLLMType(settings)
    const {llm} = getLLM({settings, type: llmType})

    if (!llm) {
      throw new Error('No LLM provider configured. Add an API key in Settings → Integrations to use agent mode.')
    }

    assertToolCallingCapability(llm)

    const {timeoutMs} = this.aliasConfig

    return withClient(this.transportConfig(extraEnv, normalizedArgs), async client => {
      if (signal) {
        signal.addEventListener('abort', () => client.close().catch(() => {}))
      }

      const {tools: toolDescriptors} = await client.listTools()
      const tools = toolDescriptors.map(
        toolDescriptor => new MCPToolAdapter({toolDescriptor, client, timeoutMs, signal}),
      )
      const executor = createMCPAgentExecutor(llm, tools)
      return (await executor.invoke({input: prompt}, {signal})).output
    })
  }

  async runDirectMode(prompt, signal, extraEnv, normalizedArgs) {
    return callTool({
      ...this.transportConfig(extraEnv, normalizedArgs),
      toolName: this.aliasConfig.toolName,
      toolArguments: this.buildToolArguments(prompt),
      timeoutMs: this.aliasConfig.timeoutMs,
      signal,
    })
  }

  async run(node, context, originalPrompt, options = {}) {
    await runWithErrorNode(
      this.store,
      node,
      this.logError.bind(this),
      async () => {
        const {signal} = options
        const prompt = this.extractPrompt(node, originalPrompt)
        const fullPrompt = context ? context + prompt : prompt

        const {command, args} = this.aliasConfig
        const internal = isInternalMcpServer(command, args)

        let extraEnv
        let normalizedArgs
        if (internal) {
          const settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
          extraEnv = buildInternalServerEnv(this.userId, this.workflowId, settings)
          if (args?.[0]) {
            normalizedArgs = [resolveInternalServerScript(args[0]), ...args.slice(1)]
          }
        }

        if (this.aliasConfig.toolName === MCP_TOOL_NAME_AUTO) {
          const text = await this.runAgentMode(fullPrompt, signal, extraEnv, normalizedArgs)
          this.store.importer.createNodes(text || '(empty MCP response)', node.id)
          return
        }

        const result = await this.runDirectMode(fullPrompt, signal, extraEnv, normalizedArgs)

        if (result.isError) {
          throw new MCPToolError()
        }

        const text = result.content || '(empty MCP response)'
        this.store.importer.createNodes(text, node.id)
      },
      {
        classifyError: error => ({
          type:
            error instanceof MCPToolError
              ? EXECUTION_FAILURE_TYPE.MCP_TOOL_ERROR
              : EXECUTION_FAILURE_TYPE.RUNTIME_ERROR,
        }),
        publicMessage: error => (error instanceof MCPToolError ? error.message : 'MCP command execution failed'),
      },
    )
  }

  extractPrompt(node, originalPrompt) {
    const rawPrompt = originalPrompt || node?.command || node?.title || ''
    const resolvedPrompt = resolveExternalCommandPrompt(rawPrompt, node, this.store)
    return this.stripAliasPrefix(resolvedPrompt)
  }

  stripAliasPrefix(text) {
    const {alias} = this.aliasConfig
    const trimmed = text.trimStart()
    if (trimmed.startsWith(alias)) {
      const rest = trimmed.slice(alias.length)
      if (rest === '' || /^\s/.test(rest)) {
        return rest.trimStart()
      }
    }
    return trimmed
  }
}
