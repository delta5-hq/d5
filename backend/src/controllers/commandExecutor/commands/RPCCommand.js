import debug from 'debug'
import {SSHExecutor} from './rpc/SSHExecutor'
import {HTTPExecutor} from './rpc/HTTPExecutor'
import {ACPExecutor} from './rpc/acp/ACPExecutor'
import {ACPPermissionPolicy} from './rpc/acp/ACPPermissionPolicy'
import {interpolateTemplate} from './shared/interpolateTemplate'
import {parseOutput} from './shared/parseOutput'
import {RPC_PROTOCOL} from '../constants/rpc'
import {SessionIdExtractor} from './rpc/SessionIdExtractor'
import {SessionIdInjector} from './rpc/SessionIdInjector'
import IntegrationSessionRepository from '../../../repositories/IntegrationSessionRepository'

const log = debug('delta5:app:Command:RPC')

export class RPCCommand {
  constructor(userId, workflowId, store, aliasConfig, progressReporter = null, sshClientPool = null) {
    this.store = store
    this.userId = userId
    this.workflowId = workflowId
    this.aliasConfig = aliasConfig
    this.progressReporter = progressReporter
    this.sshClientPool = sshClientPool
    this.log = log.extend(userId, '/')
    if (this.workflowId) {
      this.log = this.log.extend(workflowId, '#')
    }
    this.logError = this.log.extend('ERROR*', '::')
  }

  async executeSSH(prompt) {
    const {host, port, username, privateKey, passphrase, commandTemplate, workingDir, timeoutMs, lastSessionId} =
      this.aliasConfig

    const injector = new SessionIdInjector(commandTemplate, lastSessionId)
    const templateWithSession = injector.inject()
    const command = interpolateTemplate(templateWithSession, prompt, {escapeMode: 'shell'})

    const executor = new SSHExecutor()

    let client = null
    if (this.sshClientPool) {
      try {
        client = await this.sshClientPool.getOrCreate({host, port, username, privateKey, passphrase})
      } catch (err) {
        this.logError(`Failed to get shared SSH client, falling back to own connection: ${err.message}`)
      }
    }

    const {stdout, stderr, exitCode} = await executor.execute({
      host,
      port,
      username,
      privateKey,
      passphrase,
      command,
      workingDir,
      timeoutMs,
      client,
    })

    if (exitCode !== 0) {
      this.logError(`SSH command failed with exit code ${exitCode}: ${stderr}`)
    }

    return stdout || stderr
  }

  async executeHTTP(prompt) {
    const {url, method, headers, bodyTemplate, timeoutMs, lastSessionId} = this.aliasConfig

    const injector = new SessionIdInjector(bodyTemplate, lastSessionId)
    const templateWithSession = injector.inject()
    const body = templateWithSession ? interpolateTemplate(templateWithSession, prompt, {escapeMode: 'json'}) : null

    const injectedUrl = new SessionIdInjector(url, lastSessionId).inject()

    const injectedHeaders = headers
      ? Object.fromEntries(
          Object.entries(headers).map(([key, value]) => [key, new SessionIdInjector(value, lastSessionId).inject()]),
        )
      : headers

    const executor = new HTTPExecutor()
    const {
      body: responseBody,
      status,
      isError,
    } = await executor.execute({
      url: injectedUrl,
      method,
      headers: injectedHeaders,
      body,
      timeoutMs,
    })

    if (isError) {
      this.logError(`HTTP request failed with status ${status}`)
    }

    return responseBody
  }

  async executeACP(prompt, progressReporter = null) {
    const {command, args, env, timeoutMs, workingDir, autoApprove, allowedTools, lastSessionId} = this.aliasConfig

    const permissionPolicy = ACPPermissionPolicy.fromIntegrationConfig({autoApprove, allowedTools})
    const executor = new ACPExecutor()

    const onUpdate = progressReporter?.emitUpdate ? update => progressReporter.emitUpdate(update) : null

    const result = await executor.execute({
      command,
      args,
      env,
      timeoutMs,
      cwd: workingDir,
      permissionPolicy,
      prompt,
      lastSessionId,
      onUpdate,
    })

    return {
      output: result.output,
      sessionId: result.sessionId,
      exitCode: result.exitCode,
    }
  }

  async run(node, context, originalPrompt) {
    const prompt = this.extractPrompt(node, originalPrompt)
    const fullPrompt = context ? context + prompt : prompt

    try {
      let rawOutput
      let sessionId = null

      if (this.aliasConfig.protocol === RPC_PROTOCOL.SSH) {
        rawOutput = await this.executeSSH(fullPrompt)
      } else if (this.aliasConfig.protocol === RPC_PROTOCOL.HTTP) {
        rawOutput = await this.executeHTTP(fullPrompt)
      } else if (this.aliasConfig.protocol === RPC_PROTOCOL.ACP_LOCAL) {
        const result = await this.executeACP(fullPrompt, this.progressReporter)
        rawOutput = result.output
        sessionId = result.sessionId
      } else {
        throw new Error(`Unknown RPC protocol: ${this.aliasConfig.protocol}`)
      }

      const parsedOutput = parseOutput(rawOutput, {
        outputFormat: this.aliasConfig.outputFormat,
        outputField: this.aliasConfig.outputField,
      })

      if (sessionId) {
        await this.persistSessionId(sessionId)
      } else {
        await this.extractAndPersistSessionId(rawOutput)
      }

      this.store.importer.createNodes(parsedOutput || '(empty RPC response)', node.id)
    } catch (e) {
      this.logError(e)
      this.store.importer.createNodes(`Error: ${e.message}`, node.id)
    }
  }

  async persistSessionId(sessionId) {
    const {alias} = this.aliasConfig

    if (!sessionId) return

    try {
      await IntegrationSessionRepository.upsertSessionId(this.userId, alias, 'rpc', sessionId)
      this.log(`Persisted session ID: ${sessionId}`)
    } catch (error) {
      this.logError(`Failed to persist session ID: ${error.message}`)
    }
  }

  async extractAndPersistSessionId(rawOutput) {
    const {outputFormat, sessionIdField} = this.aliasConfig

    const extractor = new SessionIdExtractor(outputFormat, sessionIdField)
    const sessionId = extractor.extract(rawOutput)

    await this.persistSessionId(sessionId)
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
