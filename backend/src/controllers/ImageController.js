import WorkflowImage from '../models/WorkflowImage'
import Template from '../models/Template'
import path from 'path'
import createUMLFile from './utils/createUmlFile'

const ImageController = {
  load: async (ctx, next) => {
    const {imageId} = ctx.params

    let image = await WorkflowImage.findOne({_id: imageId})

    if (!image) {
      ctx.throw(404, 'Image not found.')
    }

    ctx.state.image = image

    await next()
  },
  authorization: async (ctx, next) => {
    const {mapId} = ctx.params
    const {userId, template, image} = ctx.state

    if (!image.metadata.templateId && image.metadata.mapId !== mapId) {
      ctx.throw(403, 'Access denied. Image is not associated with this workflow.')
    } else if (image.metadata.templateId && image.metadata.userId?.toString() !== userId) {
      const accessTemplate = template || (await Template.findOne({_id: image.metadata.templateId}))
      if (!accessTemplate) {
        ctx.throw(403, 'Access denied.')
      } else if (!accessTemplate.isPublic() && userId) {
        ctx.throw(403, 'Access denied.')
      } else if (!accessTemplate.isPublic() && !userId) {
        ctx.throw(401, 'Authentication needed.')
      }
    }

    await next()
  },

  list: async ctx => {
    const {mapId} = ctx.params
    const {templateId} = ctx.params

    ctx.body = mapId
      ? await WorkflowImage.find({'metadata.mapId': mapId})
      : await WorkflowImage.find({'metadata.templateId': templateId})
  },

  get: async ctx => {
    const {image} = ctx.state

    ctx.body = image.read()
    if (image.filename) ctx.set('Content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(image.filename)}`)
    ctx.type = image.metadata.contentType || path.extname(image.filename) || 'application/octet-stream'
  },

  create: async ctx => {
    // TODO: set count of selected items, so we can determine later if the image can be deleted
    const {
      request: {query: {filename = 'no-file-name-given', filetype = 'unknown'} = {}},
      headers: {'content-type': contentType},
      params: {mapId, templateId},
      state: {userId},
    } = ctx
    if (filetype == 'uml') {
      const metadata = {mapId, contentType: 'image/svg+xml', userId}
      const file = await createUMLFile(ctx.req.read(), filename, metadata)
      ctx.body = {_id: file._id}
    } else {
      const metadata = {
        [mapId ? 'mapId' : 'templateId']: mapId || templateId,
        contentType,
        userId,
      }
      const image = await WorkflowImage.write({filename, metadata}, ctx.req)

      ctx.body = {_id: image._id}
    }
  },

  delete: async ctx => {
    const {image} = ctx.state

    await image.unlink()
    ctx.body = {success: true}
  },
}

export default ImageController
