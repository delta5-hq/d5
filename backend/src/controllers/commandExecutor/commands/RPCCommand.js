import debug from 'debug'
import {SSHExecutor} from './rpc/SSHExecutor'
import {HTTPExecutor} from './rpc/HTTPExecutor'
import {interpolateTemplate} from './shared/interpolateTemplate'
import {parseOutput} from './shared/parseOutput'
import {RPC_PROTOCOL} from '../constants/rpc'

const log = debug('delta5:app:Command:RPC')

export class RPCCommand {
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

  async executeSSH(prompt) {
    const {host, port, username, privateKey, passphrase, commandTemplate, workingDir, timeoutMs} = this.aliasConfig

    const command = interpolateTemplate(commandTemplate, prompt, {escapeMode: 'shell'})

    const executor = new SSHExecutor()
    const {stdout, stderr, exitCode} = await executor.execute({
      host,
      port,
      username,
      privateKey,
      passphrase,
      command,
      workingDir,
      timeoutMs,
    })

    if (exitCode !== 0) {
      this.logError(`SSH command failed with exit code ${exitCode}: ${stderr}`)
    }

    return stdout || stderr
  }

  async executeHTTP(prompt) {
    const {url, method, headers, bodyTemplate, timeoutMs} = this.aliasConfig

    const body = bodyTemplate ? interpolateTemplate(bodyTemplate, prompt, {escapeMode: 'json'}) : null

    const executor = new HTTPExecutor()
    const {
      body: responseBody,
      status,
      isError,
    } = await executor.execute({
      url,
      method,
      headers,
      body,
      timeoutMs,
    })

    if (isError) {
      this.logError(`HTTP request failed with status ${status}`)
    }

    return responseBody
  }

  async run(node, context, originalPrompt) {
    const prompt = this.extractPrompt(node, originalPrompt)
    const fullPrompt = context ? context + prompt : prompt

    try {
      let rawOutput

      if (this.aliasConfig.protocol === RPC_PROTOCOL.SSH) {
        rawOutput = await this.executeSSH(fullPrompt)
      } else if (this.aliasConfig.protocol === RPC_PROTOCOL.HTTP) {
        rawOutput = await this.executeHTTP(fullPrompt)
      } else {
        throw new Error(`Unknown RPC protocol: ${this.aliasConfig.protocol}`)
      }

      const parsedOutput = parseOutput(rawOutput, {
        outputFormat: this.aliasConfig.outputFormat,
        outputField: this.aliasConfig.outputField,
      })

      this.store.importer.createNodes(parsedOutput || '(empty RPC response)', node.id)
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
