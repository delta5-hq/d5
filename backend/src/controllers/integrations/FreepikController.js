import {container} from '../../services/container'

const freepikService = container.get('freepikService')

const FreepikController = {
  getIcons: async ctx => {
    try {
      const data = await freepikService.getIcons(ctx.request.query)
      ctx.body = data
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },

  downloadIcon: async ctx => {
    const {id, png_size} = await ctx.request.json()

    try {
      const data = await freepikService.downloadIcon(id, png_size)
      ctx.body = data
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },
}

export default FreepikController
