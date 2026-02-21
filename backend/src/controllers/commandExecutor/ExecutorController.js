import debug from 'debug'
import {getWorkflowData} from './commands/utils/getWorkflowData'
import {runCommand} from './commands/utils/runCommand'
import Store from './commands/utils/Store'
import {allowedCommands} from './constants'
import {findAliasByQueryType} from './commands/mcp/aliasResolver'
import {loadUserAliases} from './commands/aliases/loadUserAliases'
import {findRPCAliasByQueryType} from './commands/utils/queryTypeResolver'
import ProgressReporter from './ProgressReporter'

const logError = debug('delta5:app:ExecutorController')

const ExecutorController = {
  execute: async ctx => {
    const body = await ctx.request.json('infinity')
    const {queryType, cell} = body
    const {userId} = ctx.state

    if (!cell) {
      ctx.throw(404, 'Cell not specified')
    }

    let mcpAlias
    let rpcAlias
    let aliases = {mcp: [], rpc: []}

    try {
      aliases = await loadUserAliases(userId)
    } catch (e) {
      logError('Failed to load user aliases, continuing with empty aliases:', e.message)
    }

    if (!allowedCommands.includes(queryType)) {
      mcpAlias = findAliasByQueryType(aliases.mcp, queryType)
      if (!mcpAlias) {
        rpcAlias = findRPCAliasByQueryType(aliases.rpc, queryType)
        if (!rpcAlias) {
          ctx.throw(400, 'Not allowed query')
        }
      }
    }

    const log = debug('delta5:app:ProgressReporter').extend(userId, '/')
    const progress = new ProgressReporter({title: 'root', log, outputInterval: 60000})
    try {
      // queryType, context, prompt, cell, userId, workflowId, workflowNodes, workflowFiles
      let {workflowNodes, workflowEdges, workflowId, workflowFiles, ...otherData} = body

      if (!workflowNodes && workflowId) {
        const {nodes, edges} = await getWorkflowData(workflowId)

        if (!workflowNodes) workflowNodes = nodes
        if (!workflowEdges) workflowEdges = edges
      }

      const store = new Store(
        {...body, userId, nodes: workflowNodes, edges: workflowEdges, files: workflowFiles, aliases},
        progress,
      )
      await runCommand({...otherData, store, mcpAlias, rpcAlias}, progress)

      const {nodes: nodesChanged, edges: edgesChanged} = store.getOutput()
      ctx.body = {
        ...otherData,
        nodesChanged,
        edgesChanged,
        workflowId,
        cell: store.getNode(otherData.cell.id),
        workflowNodes: store._nodes,
        workflowFiles: store._files,
        workflowEdges: store._edges,
      }
    } catch (e) {
      console.error(e)
      ctx.throw(500, e.message)
    } finally {
      progress.dispose()
    }
  },
}

export default ExecutorController
