import debug from 'debug'
import {Counter} from 'prom-client'
import archiver from 'archiver'

import Workflow from '../models/Workflow'
import WorkflowImage from '../models/WorkflowImage'
import WorkflowFile from '../models/WorkflowFile'
import Thumbnail from '../models/Thumbnail'
import generateId from '../shared/utils/generateId'
import fileToBase64 from '../utils/fileToBase64'
import {EXPORT_FILE_SIZE_LIMIT} from '../constants'
import User from '../models/User'
import {ACCESS_ROLES, ROLES} from '../shared/config/constants'

const log = debug('delta5:Controller:workflow')
const logError = log.extend('ERROR', '::')

const loadWorkflowCounter = new Counter({
  name: 'delta5_rest_workflow_get_count',
  help: 'Number of workflows loads via get rest (read only)',
  labelNames: ['workflowId'],
})

const WorkflowShareFilters = {
  all: 'all',
  public: 'public',
  hidden: 'hidden',
  private: 'private',
}

const WorkflowController = {
  load: async (ctx, next) => {
    const {workflowId} = ctx.params

    const workflow = await Workflow.findOne({workflowId})

    if (!workflow) {
      ctx.throw(404, 'Workflow not found.')
    }

    ctx.state.workflow = workflow

    await next()
  },
  authorization: async (ctx, next) => {
    const {method} = ctx
    const {userId, workflow, auth} = ctx.state

    if (!userId && !workflow.isPublic()) {
      ctx.throw(401, 'Authentication needed.')
    }

    const {access = []} = workflow.share || {}

    const user = await User.findOne({id: userId})

    const roleBinding = access.find(({subjectId, subjectType}) => {
      if (subjectType === 'user' && subjectId === userId) return true
      if (subjectType === 'mail' && user?.mail && subjectId === user.mail) return true
      if (subjectType === 'mail' && auth?.mail && subjectId === auth.mail) return true
      return false
    })

    const isOwner = workflow.userId?.toString() === userId || roleBinding?.role === ACCESS_ROLES.owner
    const isWriteable = isOwner || roleBinding?.role === ACCESS_ROLES.contributor || workflow.isPublicWriteable()
    const isReadable = isWriteable || roleBinding?.role === ACCESS_ROLES.reader || workflow.isPublic()

    if (method.toUpperCase() === 'GET' && !isReadable) {
      ctx.throw(403, 'Access denied.')
    }

    ctx.state.access = {isOwner, isWriteable, isReadable}

    await next()
  },
  list: async ctx => {
    const userId = ctx.state.userId
    const publicString = ctx.query.public
    const search = ctx.query.search || ''
    const page = parseInt(ctx.query.page, 10) || 1
    const limit = parseInt(ctx.query.limit, 10) || 10
    const shareFilter = ctx.query.filter || WorkflowShareFilters.all

    const isPublic = publicString !== 'false'

    if (!isPublic && !userId) {
      ctx.throw(401, 'Authentication needed.')
    }

    let query = {}

    if (isPublic) {
      query = {
        'share.public.enabled': true,
        $or: [{'share.public.hidden': false}, {'share.public.hidden': {$exists: false}}],
      }
    } else {
      query = {
        $or: [{userId}, {'share.access.subjectId': userId, 'share.access.subjectType': 'user'}],
      }

      if (shareFilter === WorkflowShareFilters.private) {
        query['share.public.enabled'] = {$ne: true}
      } else if (shareFilter === WorkflowShareFilters.public) {
        query['share.public.enabled'] = true
        query['share.public.hidden'] = false
      } else if (shareFilter === WorkflowShareFilters.hidden) {
        query['share.public.enabled'] = true
        query['share.public.hidden'] = true
      }
    }

    if (search) {
      query.title = {$regex: search, $options: 'i'}
    }

    const project = isPublic ? {nodes: 0, edges: 0, share: 0} : {nodes: 0, edges: 0}

    const total = await Workflow.countDocuments(query)

    const data = await Workflow.find(query, project)
      .sort([['updatedAt', 'descending']])
      .skip((page - 1) * limit)
      .limit(limit)

    ctx.body = {
      data,
      total,
      page,
      limit,
    }
  },
  get: async ctx => {
    const {workflowId} = ctx.params
    const {workflow} = ctx.state

    loadWorkflowCounter.labels(workflowId).inc()

    ctx.body = workflow
  },
  delete: async ctx => {
    const {workflowId} = ctx.params
    const {isOwner} = ctx.state.access

    if (!isOwner) {
      ctx.throw(403, 'You are not an owner of this workflow.')
    }

    const unlinkObjects = async model => {
      const objs = await model.find({'metadata.workflowId': workflowId})
      await Promise.all(objs.map(obj => obj.unlink()))
    }

    await Promise.all([
      Workflow.deleteOne({workflowId}),
      unlinkObjects(WorkflowImage),
      unlinkObjects(WorkflowFile),
      unlinkObjects(Thumbnail),
    ])

    ctx.body = {success: true}
  },
  create: async ctx => {
    const {userId} = ctx.state
    const {limitWorkflows = 0} = ctx.state.auth

    //workaround org_subscriber with no workflow limit TODO: do it on wordpress
    if (
      limitWorkflows &&
      (await Workflow.find({userId}).countDocuments()) >= limitWorkflows &&
      !ctx.state.auth.roles.includes(ROLES.org_subscriber)
    ) {
      ctx.throw(402, `Workflow limit reached (${limitWorkflows})`)
    }

    const workflowId = generateId()

    log('create new workflow', {workflowId, userId})

    await new Workflow({
      workflowId,
      userId,
      share: {
        public: {
          enabled: false,
          hidden: false,
          writeable: false,
        },
        access: [],
      },
    }).save()

    ctx.body = {workflowId}
  },
  exportJson: async ctx => {
    const {workflowId, title, nodes, edges, tags, root} = ctx.state.workflow.toJSON()
    const {isWriteable} = ctx.state.access

    if (!isWriteable) {
      ctx.throw(403, 'Only users with write access can export workflows.')
    }

    const exportWorkflow = {workflowId, title, nodes, edges, root}
    if (tags) exportWorkflow.tags = tags

    const imageList = await WorkflowImage.find({
      'metadata.workflowId': workflowId,
      length: {$lt: EXPORT_FILE_SIZE_LIMIT},
    })
    const images = await Promise.all((imageList || []).map(fileToBase64))

    const documentList = await WorkflowFile.find({
      'metadata.workflowId': workflowId,
      length: {$lt: EXPORT_FILE_SIZE_LIMIT},
    })
    const documents = await Promise.all((documentList || []).map(fileToBase64))

    const filename = `Workflow-${workflowId}-${title}.json`
    ctx.set('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)

    ctx.body = {...exportWorkflow, images, documents}
  },
  exportZip: async ctx => {
    const {workflowId, title, nodes, edges, tags, root} = ctx.state.workflow.toJSON()
    const {isWriteable} = ctx.state.access

    if (!isWriteable) {
      ctx.throw(403, 'Only users with write access can export workflows.')
    }

    const archive = archiver('zip')
    archive.on('end', () => log(`zip export of ${workflowId} successful`))
    archive.on('warning', error => logError(`warning when exporting ${workflowId} to zip: ${error}`))
    archive.on('error', error => {
      const message = `failed to export ${workflowId} to zip: ${error}`
      logError(message)
      ctx.throw(500, message)
    })

    const exportWorkflow = {workflowId, title, nodes, edges, root}
    if (tags) exportWorkflow.tags = tags
    archive.append(JSON.stringify(exportWorkflow), {name: 'workflowdata.json'})

    const metaData = {version: 1, images: {}, files: {}}

    const imageList = (await WorkflowImage.find({'metadata.workflowId': workflowId})) || []
    imageList.forEach(image => {
      metaData.images[image._id] = image.toJSON()

      archive.append(image.read(), {name: `${image._id}-${image.filename || 'unknown.jpg'}`})
    })

    const fileList = (await WorkflowFile.find({'metadata.workflowId': workflowId})) || []
    fileList.forEach(file => {
      metaData.files[file._id] = file.toJSON()

      archive.append(file.read(), {name: `${file._id}-${file.filename || 'unknown.jpg'}`})
    })
    archive.append(JSON.stringify(metaData), {name: 'metadata.json'})

    const filename = `Workflow-${workflowId}-${title}.zip`
    ctx.set('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)

    archive.finalize()

    ctx.body = archive
  },
  shareRead: async ctx => {
    const {workflow} = ctx.state

    ctx.body = workflow.share
  },
  shareWrite: async ctx => {
    ctx.throw(400, 'This endpoint is obsolete.')
  },
  sharePublicGet: async ctx => {
    const {workflow} = ctx.state
    ctx.body = workflow.share?.public || {}
  },
  sharePublicPost: async ctx => {
    const {workflow, auth} = ctx.state
    const payload = await ctx.request.json()
    const {isOwner} = ctx.state.access

    if (!isOwner) {
      ctx.throw(403, 'Only owners are allowed to share workflows.')
    } else if (!('enabled' in payload)) {
      ctx.throw(400, 'Badly formatted request.')
    } else if (payload.writeable && !payload.hidden && !auth?.roles.includes(ROLES.administrator)) {
      ctx.throw(403, 'Only administrators can set workflows public writeable')
    }

    if (!workflow.share) workflow.share = {}

    workflow.share.public = payload
    await workflow.save()

    ctx.body = {success: true}
  },
  shareAccessGet: async ctx => {
    const {workflow} = ctx.state
    ctx.body = workflow.share?.access || []
  },
  shareAccessPost: async ctx => {
    const {workflow} = ctx.state
    const payload = await ctx.request.json()
    const {isOwner} = ctx.state.access

    if (!isOwner) {
      ctx.throw(403, 'Only owners are allowed to share workflows.')
    } else if (!Array.isArray(payload)) {
      ctx.throw(400, 'Badly formatted request.')
    }

    if (!workflow.share) workflow.share = {}

    workflow.share.access = payload
    await workflow.save()

    ctx.body = {success: true}
  },
  writeable: async ctx => {
    const {isWriteable: writeable} = ctx.state.access

    ctx.body = {writeable}
  },
  nodeLimit: async ctx => {
    const {userId} = ctx.state.workflow

    let nodeLimit = false
    const user = await User.findOne({id: userId})
    if (user?.limitNodes) nodeLimit = user.limitNodes

    // Workaround for unfinished db TODO: Remove it
    if (ctx.state?.userId === userId && ctx.state?.auth) nodeLimit = ctx.state.auth.limitNodes

    //workaround role org_subscriber with unlimited workflows/cards
    if (user?.roles.includes(ROLES.org_subscriber)) nodeLimit = false

    ctx.body = {limit: nodeLimit}
  },
  addCategory: async ctx => {
    const {workflow} = ctx.state
    const request = await ctx.request.json()

    const {category} = request

    if (typeof category !== 'string' && category !== null) {
      ctx.abort(400, 'category has to be string')
    }

    workflow.category = category
    await workflow.save()

    ctx.body = {success: true}
  },

  fromTemplate: async ctx => {
    const {userId, template} = ctx.state

    const newWorkflowId = generateId()

    const {name: title, nodes, edges = {}, root} = JSON.parse(JSON.stringify(template))

    const newWorkflowData = {title, nodes, edges, root, workflowId: newWorkflowId, userId}

    await new Workflow(newWorkflowData).save()

    ctx.body = {workflowId: newWorkflowId}
  },
}

export default WorkflowController
