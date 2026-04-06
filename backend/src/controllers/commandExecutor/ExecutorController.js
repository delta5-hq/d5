import debug from 'debug'
import {getWorkflowData} from './commands/utils/getWorkflowData'
import {runCommand} from './commands/utils/runCommand'
import Store from './commands/utils/Store'
import {allowedCommands} from './constants'
import {loadUserAliases} from './commands/aliases/loadUserAliases'
import {resolveCommand} from './commands/utils/queryTypeResolver'
import ProgressReporter from './ProgressReporter'
import StreamableProgressReporter from './streaming/StreamableProgressReporter'
import StreamBridge from './streaming/StreamBridge'
import {StreamEvent} from './streaming/StreamEvent'
import {progressEventEmitter} from '../../services/progress-event-emitter'

const logError = debug('delta5:app:ExecutorController')

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

    const log = debug('delta5:app:ProgressReporter').extend(userId, '/')
    const ProgressReporterClass = streamSessionId ? StreamableProgressReporter : ProgressReporter
    const progress = new ProgressReporterClass({title: 'root', log, outputInterval: 60000}, null, streamSessionId)

    const nodeId = cell?.id

    try {
      // queryType, context, prompt, cell, userId, workflowId, workflowNodes, workflowFiles
      let {workflowNodes, workflowEdges, workflowId, workflowFiles, ...otherData} = body

      try {
        aliases = await loadUserAliases(userId, workflowId)
      } catch (e) {
        logError('Failed to load user aliases, continuing with empty aliases:', e.message)
      }

      const resolved = resolveCommand(cell.command, aliases)
      queryType = resolved.queryType || frontendQueryType
      mcpAlias = resolved.mcpAlias
      rpcAlias = resolved.rpcAlias

      if (nodeId) {
        progressEventEmitter.emitStart(nodeId, {queryType})
      }

      if (!allowedCommands.includes(queryType)) {
        if (!mcpAlias && !rpcAlias) {
          ctx.throw(400, 'Not allowed query')
        }
      }

      otherData.queryType = queryType

      if (!workflowNodes && workflowId) {
        const {nodes, edges} = await getWorkflowData(workflowId)

        if (!workflowNodes) workflowNodes = nodes
        if (!workflowEdges) workflowEdges = edges
      }

      const store = new Store(
        {...body, userId, nodes: workflowNodes, edges: workflowEdges, files: workflowFiles, aliases},
        progress,
      )

      if (nodeId) {
        progressEventEmitter.emitRunning(nodeId, {queryType})
      }

      await runCommand({...otherData, store, mcpAlias, rpcAlias}, progress)

      const {nodes: nodesChanged, edges: edgesChanged} = store.getOutput()
      const result = {
        ...otherData,
        nodesChanged,
        edgesChanged,
        workflowId,
        cell: store.getNode(otherData.cell.id),
        workflowNodes: store._nodes,
        workflowFiles: store._files,
        workflowEdges: store._edges,
      }

      if (streamSessionId) {
        StreamBridge.emit(streamSessionId, StreamEvent.complete(result))
        StreamBridge.closeSession(streamSessionId)
      }

      if (nodeId) {
        progressEventEmitter.emitComplete(nodeId, {queryType})
      }

      ctx.body = result
    } catch (e) {
      console.error(e)

      if (streamSessionId) {
        StreamBridge.emit(streamSessionId, StreamEvent.error(e))
        StreamBridge.closeSession(streamSessionId)
      }

      if (nodeId) {
        progressEventEmitter.emitError(nodeId, e, {queryType})
      }

      ctx.throw(500, e.message)
    } finally {
      progress.dispose()
    }
  },
}

export default ExecutorController
