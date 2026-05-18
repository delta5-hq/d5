import debug from 'debug'
import {getWorkflowData} from './commands/utils/getWorkflowData'
import {runCommand} from './commands/utils/runCommand'
import Store from './commands/utils/Store'
import {loadUserAliases} from './commands/aliases/loadUserAliases'
import {resolveCommand} from './commands/utils/queryTypeResolver'
import ProgressReporter from './ProgressReporter'
import StreamableProgressReporter from './streaming/StreamableProgressReporter'
import StreamBridge from './streaming/StreamBridge'
import {StreamEvent} from './streaming/StreamEvent'
import {progressEventEmitter} from '../../services/progress-event-emitter'
import {buildExecutionResult, buildPreStoreErrorResult} from './ExecutorResponse'
import {UnknownQueryTypeError} from './reliability/UnknownQueryTypeError'

const logError = debug('delta5:app:ExecutorController')

const finalizeStream = (streamSessionId, result) => {
  StreamBridge.emit(streamSessionId, StreamEvent.complete(result))
  StreamBridge.closeSession(streamSessionId)
}

const ExecutorController = {
  execute: async ctx => {
    const body = await ctx.request.json('infinity')
    const {queryType: frontendQueryType, cell, streamSessionId} = body
    const {userId} = ctx.state

    if (!cell) {
      ctx.throw(404, 'Cell not specified')
    }

    let mcpAlias
    let rpcAlias
    let aliases = {mcp: [], rpc: []}
    let queryType = frontendQueryType
    let store = null
    let otherData = null
    let workflowId = null

    const log = debug('delta5:app:ProgressReporter').extend(userId, '/')
    const ProgressReporterClass = streamSessionId ? StreamableProgressReporter : ProgressReporter
    const progress = new ProgressReporterClass({title: 'root', log, outputInterval: 60000}, null, streamSessionId)

    const nodeId = cell?.id
    const abortController = new AbortController()
    const requestCloseHandler = () => abortController.abort()

    ctx.req.on('close', requestCloseHandler)

    try {
      let workflowNodes, workflowEdges, workflowFiles
      ;({workflowNodes, workflowEdges, workflowId, workflowFiles, ...otherData} = body)

      try {
        aliases = await loadUserAliases(userId, workflowId)
      } catch (e) {
        logError('Failed to load user aliases, continuing with empty aliases:', e.message)
      }

      if (!workflowNodes && workflowId) {
        const {nodes, edges} = await getWorkflowData(workflowId)
        workflowNodes = nodes
        if (!workflowEdges) workflowEdges = edges
      }

      store = new Store(
        {...body, userId, nodes: workflowNodes, edges: workflowEdges, files: workflowFiles, aliases},
        progress,
      )

      const resolved = resolveCommand(cell.command, aliases)
      queryType = resolved.queryType || frontendQueryType
      mcpAlias = resolved.mcpAlias
      rpcAlias = resolved.rpcAlias

      if (nodeId) {
        progressEventEmitter.emitStart(nodeId, {queryType})
      }

      otherData.queryType = queryType

      if (nodeId) {
        progressEventEmitter.emitRunning(nodeId, {queryType})
      }

      await runCommand({...otherData, store, mcpAlias, rpcAlias, signal: abortController.signal}, progress)

      const result = buildExecutionResult(otherData, store, workflowId)

      if (streamSessionId) {
        finalizeStream(streamSessionId, result)
      }

      if (nodeId) {
        progressEventEmitter.emitComplete(nodeId, {queryType})
      }

      ctx.body = result
    } catch (e) {
      console.error(e)

      if (store && otherData) {
        store.importer.createNodes(`Error: ${e.message}`, cell.id)
        const result = buildExecutionResult(otherData, store, workflowId)

        if (streamSessionId) {
          finalizeStream(streamSessionId, result)
        }

        ctx.body = result
        // A structurally undispatchable command (no runner for the queryType,
        // e.g. top-level /refine after P0.1) is a request-level error, not a
        // runtime node failure — surface it as 5xx, not a 200 error node.
        if (e instanceof UnknownQueryTypeError) {
          ctx.status = 500
        }
      } else {
        if (streamSessionId) {
          StreamBridge.emit(streamSessionId, StreamEvent.error(e))
          StreamBridge.closeSession(streamSessionId)
        }

        ctx.body = buildPreStoreErrorResult(cell, workflowId, e)
      }

      if (nodeId) {
        progressEventEmitter.emitError(nodeId, e, {queryType})
      }
    } finally {
      ctx.req.off('close', requestCloseHandler)
      progress.dispose()
    }
  },
}

export default ExecutorController
