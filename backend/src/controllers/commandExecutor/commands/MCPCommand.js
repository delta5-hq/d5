import debug from 'debug'
import {callTool} from './mcp/MCPClientManager'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'

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

  async run(node, context, originalPrompt) {
    const prompt = this.extractPrompt(node, originalPrompt)
    const fullPrompt = context ? context + prompt : prompt

    try {
      const result = await callTool({
        serverUrl: this.aliasConfig.serverUrl,
        transport: this.aliasConfig.transport,
        toolName: this.aliasConfig.toolName,
        toolArguments: this.buildToolArguments(fullPrompt),
        headers: this.aliasConfig.headers,
      })

      if (result.isError) {
        this.logError(result.content)
      }

      const text = result.content || '(empty MCP response)'
      this.store.importer.createNodes(text, node.id)
    } catch (e) {
      this.logError(e)
      this.store.importer.createNodes(`Error: ${e.message}`, node.id)
    }
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
