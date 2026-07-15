import {generateNodeId} from '../../shared/utils/generateId'

export const buildExecutionResult = (otherData, store, workflowId) => {
  const {nodes: nodesChanged, edges: edgesChanged} = store.getOutput()
  return {
    ...otherData,
    nodesChanged,
    edgesChanged,
    workflowId,
    cell: store.getNode(otherData.cell.id),
    workflowNodes: store._nodes,
    workflowFiles: store._files,
    workflowEdges: store._edges,
  }
}

export const buildPreStoreErrorResult = (cell, workflowId, error) => ({
  nodesChanged: [
    {
      id: generateNodeId(),
      title: `Error: ${error.message}`,
      parent: cell.id,
      children: [],
    },
  ],
  edgesChanged: [],
  workflowId,
  cell,
})
