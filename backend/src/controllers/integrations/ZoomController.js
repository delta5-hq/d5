import {container} from '../../services/container'

const zoomService = container.get('zoomService')

const ZoomController = {
  auth: async ctx => {
    const body = await ctx.request.json()
    const authorization = ctx.headers.authorization

    if (!authorization) {
      ctx.throw(401, 'Unauthorized')
    }

    try {
      const data = await zoomService.auth(body, authorization)
      ctx.body = data
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },

  getRecordings: async ctx => {
    const meetingId = ctx.params.id
    const authorization = ctx.headers.authorization

    if (!authorization) {
      ctx.throw(401, 'Zoom authorization required')
    }

    if (!meetingId) {
      ctx.throw(404, 'Meeting ID is required')
    }

    try {
      const transcriptions = await zoomService.getRecordings(meetingId, authorization)
      ctx.body = transcriptions
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },
}

export default ZoomController
