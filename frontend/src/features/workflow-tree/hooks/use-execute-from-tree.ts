import { useState } from 'react'
import type { NodeData } from '@shared/base-types'
import { executeWorkflowCommand } from '../api/execute-workflow-command'
import { mergeWorkflowNodes } from '@entities/workflow/lib'
import { useWorkflowMutation } from '@entities/workflow/api'
import type { WorkflowContentData } from '@shared/base-types'

interface UseExecuteFromTreeProps {
  workflowId: string
  workflowData: WorkflowContentData
  onSuccess?: () => void
}

export const useExecuteFromTree = ({ workflowId, workflowData, onSuccess }: UseExecuteFromTreeProps) => {
  const [isExecuting, setIsExecuting] = useState(false)
  const { updateWorkflow } = useWorkflowMutation(workflowId)

  const executeNode = async (node: NodeData, queryType: string) => {
    if (!node.command && queryType !== 'chat') {
      throw new Error('Node has no command to execute')
    }

    setIsExecuting(true)

    try {
      const response = await executeWorkflowCommand({
        queryType,
        cell: node,
        workflowNodes: workflowData.nodes,
        workflowEdges: workflowData.edges,
        workflowId,
      })

      const mergedData = mergeWorkflowNodes(workflowData, response)

      await updateWorkflow({
        nodes: mergedData.nodes,
        edges: mergedData.edges,
        root: mergedData.root,
      })

      onSuccess?.()
    } finally {
      setIsExecuting(false)
    }
  }

  return {
    executeNode,
    isExecuting,
  }
}
