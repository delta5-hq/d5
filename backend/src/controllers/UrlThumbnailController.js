import crypto from 'crypto'
import Thumbnail from '../models/Thumbnail'
import {HTML_SERVICE_URL} from '../constants'
import getThumbnail from '../utils/getThumbnail'

const md5 = payload => crypto.createHash('md5').update(payload).digest('hex')

const UrlThumbnailController = {
  get: async ctx => {
    const {url} = ctx.query
    const {size = Thumbnail.SIZES.full} = ctx.query

    if (!Object.values(Thumbnail.SIZES).includes(size)) {
      ctx.throw(400, `Wrong size given (${size})`)
    } else if (!url) {
      ctx.throw(400, 'Url is required query parameter')
    }

    const hash = md5(url)

    const filter = {metadata: {hash, size}, filename: hash}

    try {
      const thumbnail = await getThumbnail(filter, HTML_SERVICE_URL, {body: JSON.stringify({url})})

      ctx.body = thumbnail.read()
      ctx.type = 'image/png'
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },
}

export default UrlThumbnailController
