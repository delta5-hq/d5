import {container} from '../../services/container'

const midjourneyService = container.get('midjourneyService')

const MidjourneyController = {
  create: async ctx => {
    const {prompt, process_mode} = await ctx.request.json()

    try {
      const result = await midjourneyService.create(prompt, process_mode)
      ctx.body = result
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },

  upscale: async ctx => {
    const data = await ctx.request.json()

    try {
      const result = await midjourneyService.upscale(data)
      ctx.body = result
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },
}

export default MidjourneyController
