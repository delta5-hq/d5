import debug from 'debug'
import {callTool, withClient} from './mcp/MCPClientManager'
import {MCPToolAdapter} from './mcp/MCPToolAdapter'
import {determineLLMType, getIntegrationSettings, getLLM} from './utils/langchain/getLLM'
import {createSimpleAgentExecutor} from './utils/langchain/getAgentExecutor'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'

const MCP_TOOL_NAME_AUTO = 'auto'

const log = debug('delta5:app:Command:MCP')

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

  transportConfig() {
    const {serverUrl, transport, headers, command, args, env} = this.aliasConfig
    return {serverUrl, transport, headers, command, args, env}
  }

  async runAgentMode(prompt, signal) {
    const settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
    const llmType = determineLLMType(undefined, settings)
    const {llm} = getLLM({settings, type: llmType})

    if (!llm) {
      throw new Error('No LLM provider configured. Add an API key in Settings → Integrations to use agent mode.')
    }

    const {timeoutMs} = this.aliasConfig

    return withClient(this.transportConfig(), async client => {
      if (signal) {
        signal.addEventListener('abort', () => client.close().catch(() => {}))
      }

      const {tools: toolDescriptors} = await client.listTools()
      const tools = toolDescriptors.map(
        toolDescriptor => new MCPToolAdapter({toolDescriptor, client, timeoutMs, signal}),
      )
      const executor = createSimpleAgentExecutor(llm, tools)
      return (await executor.call({input: prompt}, {signal})).output
    })
  }

  async runDirectMode(prompt, signal) {
    return callTool({
      ...this.transportConfig(),
      toolName: this.aliasConfig.toolName,
      toolArguments: this.buildToolArguments(prompt),
      timeoutMs: this.aliasConfig.timeoutMs,
      signal,
    })
  }

  async run(node, context, originalPrompt, options = {}) {
    const {signal} = options
    const prompt = this.extractPrompt(node, originalPrompt)
    const fullPrompt = context ? context + prompt : prompt

    if (this.aliasConfig.toolName === MCP_TOOL_NAME_AUTO) {
      const text = await this.runAgentMode(fullPrompt, signal)
      this.store.importer.createNodes(text || '(empty MCP response)', node.id)
      return
    }

    const result = await this.runDirectMode(fullPrompt, signal)

    if (result.isError) {
      this.logError(result.content)
      throw new Error(result.content || 'MCP tool returned an error')
    }

    const text = result.content || '(empty MCP response)'
    this.store.importer.createNodes(text, node.id)
  }

  extractPrompt(node, originalPrompt) {
    if (originalPrompt) {
      return this.stripAliasPrefix(originalPrompt)
    }

    const rawTitle = node?.command || node?.title || ''
    return this.stripAliasPrefix(rawTitle)
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
