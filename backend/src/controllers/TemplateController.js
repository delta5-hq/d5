import debug from 'debug'

import Template from '../models/Template'
import WorkflowImage from '../models/WorkflowImage'
import {ROLES} from '../shared/config/constants'

const log = debug('delta5:Template:Controller')

const TemplateController = {
  load: async (ctx, next) => {
    const {templateId} = ctx.params

    const template = await Template.findOne({_id: templateId})

    if (!template) {
      ctx.throw(404, 'Template not found.')
    }

    ctx.state.template = template

    await next()
  },
  authorization: async (ctx, next) => {
    const {userId, template} = ctx.state

    if (!userId) {
      ctx.throw(401, 'Authentication needed.')
    } else if (userId && template.userId !== userId && !(template.isPublic() && ctx.method.toUpperCase() === 'GET')) {
      ctx.throw(403, 'Access denied.')
    }

    await next()
  },
  authorizationRead: async (ctx, next) => {
    const {userId, template} = ctx.state

    if (!userId) {
      ctx.throw(401, 'Authentication needed.')
    } else if (userId && template.userId !== userId && !template.isPublic()) {
      ctx.throw(403, 'Access denied.')
    }

    await next()
  },
  list: async ctx => {
    const {userId} = ctx.state

    log('list template', {userId})

    const query = {$or: [{userId}, {'share.public': true}]}

    ctx.body = await Template.find(query).sort([['updatedAt', 'descending']])
  },
  get: async ctx => {
    const {template} = ctx.state

    log('get template', {templateId: template._id})

    ctx.body = template
  },
  delete: async ctx => {
    const {templateId} = ctx.params

    log('delete template', {templateId})

    const result = await Template.deleteOne({_id: templateId})
    // Remove the background image if it exists
    await WorkflowImage.deleteMany({'metadata.templateId': templateId})

    log('delete result ', result)
    if (result.deletedCount === 0) {
      ctx.throw(500, 'Cannot delete template')
    }

    ctx.body = {success: true}
  },
  create: async ctx => {
    const {
      userId,
      auth: {roles},
    } = ctx.state
    const templateData = await ctx.request.json()

    log('create template', {userId, roles})

    if (templateData.share && templateData.share.public && !roles.includes(ROLES.administrator)) {
      ctx.throw(403, 'Your are not allowed to create a public template.')
    }

    const {_id, ...restData} = templateData
    const template = _id ? await Template.findOne({_id}) : new Template()

    // copy all images and MUTATE the templateData to set new image paths
    try {
      await Promise.all(
        Object.values(restData.nodes).map(async node => {
          if (node.image) {
            let image = await WorkflowImage.findOne({_id: node.image})
            if (!image) {
              image = await WorkflowImage.findOne({'metadata.importId': node.image})
            }

            const metadata = {...image.metadata, userId, templateId: `${template._id}`}
            const templateImage = await WorkflowImage.write({filename: image.filename, metadata}, image.read())

            node.image = `${templateImage._id}`
          }
        }),
      )
    } catch (e) {
      await WorkflowImage.deleteMany({'metadata.templateId': template._id})

      throw e
    }

    template.overwrite({
      ...restData,
      userId,
    })

    await template.save()

    ctx.body = {templateId: template._id}
  },
  update: async ctx => {
    const data = await ctx.request.json()
    const {templateId} = ctx.params
    const {imageId} = data

    try {
      log('update template ${templateId} with background image ${imageId}')
      ctx.body = await Template.findByIdAndUpdate(templateId, {backgroundImage: imageId}, {new: true})
    } catch (e) {
      log('error updating template:', e)
      let image = await WorkflowImage.findOne({_id: imageId})
      image.unlink()
      ctx.throw(500, 'Error updating template with background image.')
    }
    ctx.body = {templateId: templateId}
  },
}

export default TemplateController
