import Workflow from '../../../../models/Workflow'

export const getMapData = async mapId => {
  if (!mapId) {
    throw Error('mapId undefined')
  }
  const map = await Workflow.findOne({mapId}).lean()

  return map
}
