import Store from './commands/utils/Store'
import {getWorkflowData} from './commands/utils/getWorkflowData'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './commands/references/substitution'

const PreviewController = {
  resolveReferences: async ctx => {
    const body = await ctx.request.json('infinity')
    const {nodeId, workflowId} = body
    const {userId} = ctx.state

    if (!nodeId) {
      ctx.throw(400, 'nodeId is required')
    }

    let {workflowNodes, workflowEdges, workflowFiles} = body

    if (workflowId && (!workflowNodes || !workflowEdges)) {
      const {nodes, edges} = await getWorkflowData(workflowId)
      if (!workflowNodes) workflowNodes = nodes
      if (!workflowEdges) workflowEdges = edges
    }

    const store = new Store({
      userId,
      nodes: workflowNodes || {},
      edges: workflowEdges || {},
      files: workflowFiles || {},
    })

    const node = store.getNode(nodeId)
    if (!node) {
      ctx.throw(404, 'Node not found')
    }

    const resolvedCommand = substituteReferencesAndHashrefsChildrenAndSelf(node, store)

    ctx.body = {resolvedCommand}
  },
}

export default PreviewController
