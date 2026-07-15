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
import {CriteriaFailedError} from './reliability/core/CriteriaFailedError'
import {isAbortError} from './commands/utils/executionSignal'

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
    let storeResponseContext = null

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
      storeResponseContext = {otherData, workflowId}

      if (nodeId) {
        progressEventEmitter.emitRunning(nodeId, {queryType})
      }

      if (streamSessionId) {
        StreamBridge.getOrCreateSession(streamSessionId)
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
      if (e instanceof CriteriaFailedError && store && storeResponseContext) {
        const result = buildExecutionResult(storeResponseContext.otherData, store, storeResponseContext.workflowId)
        if (streamSessionId) {
          finalizeStream(streamSessionId, result)
        }
        if (nodeId) {
          progressEventEmitter.emitComplete(nodeId, {queryType})
        }
        ctx.body = result
      } else if (e instanceof CriteriaFailedError) {
        logError('criteria failed before response context initialized: %o', e)
        if (streamSessionId) {
          StreamBridge.emit(streamSessionId, StreamEvent.error(e))
          StreamBridge.closeSession(streamSessionId)
        }
        if (nodeId) {
          progressEventEmitter.emitError(nodeId, e, {queryType})
        }
        ctx.throw(422, e.message || 'All criteria failed')
      } else if (isAbortError(e)) {
        if (streamSessionId) {
          StreamBridge.closeSession(streamSessionId)
        }
        if (nodeId) {
          progressEventEmitter.emitComplete(nodeId, {queryType})
        }
        ctx.body =
          store && otherData
            ? buildExecutionResult(otherData, store, workflowId)
            : {nodesChanged: [], edgesChanged: [], workflowId, cell}
      } else {
        console.error(e)

        if (store && otherData) {
          store.importer.createErrorNode(`Error: ${e.message}`, cell.id)
          const result = buildExecutionResult(otherData, store, workflowId)

          if (streamSessionId) {
            finalizeStream(streamSessionId, result)
          }

          if (nodeId) {
            progressEventEmitter.emitError(nodeId, e, {queryType})
          }

          ctx.body = result
        } else {
          if (streamSessionId) {
            StreamBridge.emit(streamSessionId, StreamEvent.error(e))
            StreamBridge.closeSession(streamSessionId)
          }

          if (nodeId) {
            progressEventEmitter.emitError(nodeId, e, {queryType})
          }

          ctx.body = buildPreStoreErrorResult(cell, workflowId, e)
        }
      }
    } finally {
      ctx.req.off('close', requestCloseHandler)
      progress.dispose()
    }
  },
}

export default ExecutorController
