import debug from 'debug'
import WorkflowPath from '../models/WorkflowPath'

const log = debug('delta5:Path:Controller')

const PathController = {
  load: async (ctx, next) => {
    const {pathId} = ctx.params

    const path = await WorkflowPath.findOne({_id: pathId})

    if (!path) {
      ctx.throw(404, 'Path not found.')
    }

    ctx.state.path = path

    await next()
  },

  list: async ctx => {
    const {workflowId} = ctx.params
    ctx.body = await WorkflowPath.find({workflowId})
  },

  get: async ctx => {
    const {path} = ctx.state

    ctx.body = path
  },

  create: async ctx => {
    const request = await ctx.request.json()
    const {workflowId, _id, nodes, title} = request

    log('create new path', {workflowId, _id})

    const path = _id ? await WorkflowPath.findOne({_id}) : new WorkflowPath({_id, workflowId, nodes, title})

    path.nodes = nodes

    await path.save()
    ctx.body = {_id: path._id}
  },

  delete: async ctx => {
    const {pathId} = ctx.params

    log('delete path', {pathId})

    const result = await WorkflowPath.deleteOne({_id: pathId})

    log('delete result ', result)
    if (result.deletedCount === 0) {
      ctx.throw(500, 'Cannot delete path')
    }

    ctx.body = {success: true}
  },
}

export default PathController
