import Workflow from '../../../../models/Workflow'

export const getMapData = async workflowId => {
  if (!workflowId) {
    throw Error('workflowId undefined')
  }
  const map = await Workflow.findOne({workflowId}).lean()

  return map
}
