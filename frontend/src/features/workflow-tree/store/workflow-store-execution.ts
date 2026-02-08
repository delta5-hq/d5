import type { Store } from '@shared/lib/store'
import type { NodeData, WorkflowContentData } from '@shared/base-types'
import { mergeWorkflowNodes } from '@entities/workflow/lib'
import { executeWorkflowCommand } from '../api/execute-workflow-command'
import type { WorkflowStoreState } from './workflow-store-types'
import type { DebouncedPersister } from './workflow-store-persistence'

export function bindExecuteAction(store: Store<WorkflowStoreState>, persister: DebouncedPersister) {
  return async (node: NodeData, queryType: string): Promise<boolean> => {
    const { isDirty, workflowId, nodes, edges, root, share } = store.getState()

    if (isDirty) {
      const saved = await persister.flush()
      if (!saved) return false
    }

    store.setState({ isExecuting: true })

    try {
      const workflowData: WorkflowContentData = {
        nodes,
        edges,
        root: root ?? '',
        share: share ?? { access: [] },
      }

      const response = await executeWorkflowCommand({
        queryType,
        cell: node,
        workflowNodes: nodes,
        workflowEdges: edges,
        workflowId,
      })

      const merged = mergeWorkflowNodes(workflowData, response)
      store.setState({
        nodes: merged.nodes,
        edges: merged.edges ?? {},
        root: merged.root,
        isDirty: true,
      })

      await persister.flush()
      return true
    } catch {
      return false
    } finally {
      store.setState({ isExecuting: false })
    }
  }
}
