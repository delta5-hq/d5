import debug from 'debug'
import {getWorkflowData} from './commands/utils/getWorkflowData'
import {runCommand} from './commands/utils/runCommand'
import Store from './commands/utils/Store'
import {allowedCommands} from './constants'
import ProgressReporter from './ProgressReporter'

const ExecutorController = {
  execute: async ctx => {
    const body = await ctx.request.json('infinity')
    const {queryType, cell} = body
    const {userId} = ctx.state

    if (!cell) {
      ctx.throw(404, 'Cell not specified')
    }

    if (!allowedCommands.includes(queryType)) {
      ctx.throw(400, 'Not allowed query')
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
        {...body, userId, nodes: workflowNodes, edges: workflowEdges, files: workflowFiles},
        progress,
      )
      await runCommand({...otherData, store}, progress)

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
