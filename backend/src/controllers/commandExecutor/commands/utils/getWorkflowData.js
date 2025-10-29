import Workflow from '../../../../models/Workflow'

export const getWorkflowData = async workflowId => {
  if (!workflowId) {
    throw Error('workflowId undefined')
  }
  const workflow = await Workflow.findOne({workflowId}).lean()

  return workflow
}
