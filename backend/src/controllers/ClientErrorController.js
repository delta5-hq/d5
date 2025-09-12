import ClientError from '../models/ClientError'
import {ROLES} from '../shared/config/constants'

const ClientErrorController = {
  create: async ctx => {
    const {userId} = ctx.state
    const {path, backtrace, ...additions} = await ctx.request.json()

    const error = new ClientError({userId, path, backtrace, additions})
    await error.save()

    ctx.body = {success: true}
  },
  list: async ctx => {
    const {auth} = ctx.state

    if (!auth?.roles.includes(ROLES.administrator)) {
      ctx.throw(403, 'This endpoint is only available for administrators.')
    }

    ctx.body = await ClientError.find()
      .sort([['updatedAt', 'descending']])
      .limit(500)
  },
}

export default ClientErrorController
