import debug from 'debug'
import {getMapData} from './commands/utils/getMapData'
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
      // queryType, context, prompt, cell, userId, mapId, mapNodes, mapFiles
      let {mapNodes, mapEdges, mapId, mapFiles, ...otherData} = body

      if (!mapNodes && mapId) {
        const {nodes, edges} = await getMapData(mapId)

        if (!mapNodes) mapNodes = nodes
        if (!mapEdges) mapEdges = edges
      }

      const store = new Store({...body, userId, nodes: mapNodes, edges: mapEdges, files: mapFiles}, progress)
      await runCommand({...otherData, store}, progress)

      const {nodes: nodesChanged, edges: edgesChanged} = store.getOutput()
      ctx.body = {
        ...otherData,
        nodesChanged,
        edgesChanged,
        mapId,
        cell: store.getNode(otherData.cell.id),
        mapNodes: store._nodes,
        mapFiles: store._files,
        mapEdges: store._edges,
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
