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

const log = debug('delta5:Controller:map')
const logError = log.extend('ERROR', '::')

const loadMapCounter = new Counter({
  name: 'delta5_rest_map_get_count',
  help: 'Number of workflows loads via get rest (read only)',
  labelNames: ['mapId'],
})

const WorkflowController = {
  load: async (ctx, next) => {
    const {mapId} = ctx.params

    const map = await Workflow.findOne({mapId})

    if (!map) {
      ctx.throw(404, 'Workflow not found.')
    }

    ctx.state.map = map

    await next()
  },
  authorization: async (ctx, next) => {
    const {method} = ctx
    const {userId, map} = ctx.state

    if (!userId && !map.isPublic()) {
      ctx.throw(401, 'Authentication needed.')
    }

    const {access = []} = map.share || {}

    const user = User.findOne({id: userId})

    if (!user) {
      ctx.throw(401, 'User not found.')
    }

    const roleBinding = access.find(
      ({subjectId, subjectType}) =>
        (subjectType === 'user' && subjectId === userId) || (subjectType === 'mail' && subjectId === user.mail),
    )

    const isOwner = map.userId?.toString() === userId || roleBinding?.role === ACCESS_ROLES.owner
    const isWriteable = isOwner || roleBinding?.role === ACCESS_ROLES.contributor || map.isPublicWriteable()
    const isReadable = isWriteable || roleBinding?.role === ACCESS_ROLES.reader || map.isPublic()

    if (method.toUpperCase() === 'GET' && !isReadable) {
      ctx.throw(403, 'Access denied.')
    }

    ctx.state.access = {isOwner, isWriteable, isReadable}

    await next()
  },
  list: async ctx => {
    const {userId} = ctx.state
    const {public: publicString} = ctx.query

    const isPublic = publicString !== 'false'

    if (!isPublic && !userId) ctx.throw(401, 'Authentication needed.')

    const query = isPublic
      ? {
          'share.public.enabled': true,
          $or: [{'share.public.hidden': false}, {'share.public.hidden': {$exists: false}}],
        }
      : {$or: [{userId}, {'share.access.subjectId': userId, 'share.access.subjectType': 'user'}]}
    const project = isPublic ? {nodes: 0, edges: 0, share: 0} : {nodes: 0, edges: 0}

    ctx.body = await Workflow.find(query, project).sort([['updatedAt', 'descending']])
  },
  get: async ctx => {
    const {mapId} = ctx.params
    const {map} = ctx.state

    loadMapCounter.labels(mapId).inc()

    ctx.body = map
  },
  delete: async ctx => {
    const {mapId} = ctx.params
    const {isOwner} = ctx.state.access

    if (!isOwner) {
      ctx.throw(403, 'You are not an owner of this workflow.')
    }

    const unlinkObjects = async model => {
      const objs = await model.find({'metadata.mapId': mapId})
      await Promise.all(objs.map(obj => obj.unlink()))
    }

    await Promise.all([
      Workflow.deleteOne({mapId}),
      unlinkObjects(WorkflowImage),
      unlinkObjects(WorkflowFile),
      unlinkObjects(Thumbnail),
    ])

    ctx.body = {success: true}
  },
  create: async ctx => {
    const {userId} = ctx.state
    const {limitMaps = 0} = ctx.state.auth

    //workaround org_subscriber with no map limit TODO: do it on wordpress
    if (
      limitMaps &&
      (await Workflow.find({userId}).countDocuments()) >= limitMaps &&
      !ctx.state.auth.roles.includes(ROLES.org_subscriber)
    ) {
      ctx.throw(402, `Workflow limit reached (${limitMaps})`)
    }

    const mapId = generateId()

    log('create new workflow', {mapId, userId})

    await new Workflow({mapId, userId}).save()

    ctx.body = {mapId}
  },
  exportJson: async ctx => {
    const {mapId, title, nodes, edges, tags, root} = ctx.state.map.toJSON()
    const {isWriteable} = ctx.state.access

    if (!isWriteable) {
      ctx.throw(403, 'Only users with write access can export workflows.')
    }

    const exportMap = {mapId, title, nodes, edges, root}
    if (tags) exportMap.tags = tags

    const imageList = await WorkflowImage.find({'metadata.mapId': mapId, length: {$lt: EXPORT_FILE_SIZE_LIMIT}})
    const images = await Promise.all((imageList || []).map(fileToBase64))

    const documentList = await WorkflowFile.find({'metadata.mapId': mapId, length: {$lt: EXPORT_FILE_SIZE_LIMIT}})
    const documents = await Promise.all((documentList || []).map(fileToBase64))

    const filename = `Workflow-${mapId}-${title}.json`
    ctx.set('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)

    ctx.body = {...exportMap, images, documents}
  },
  exportZip: async ctx => {
    const {mapId, title, nodes, edges, tags, root} = ctx.state.map.toJSON()
    const {isWriteable} = ctx.state.access

    if (!isWriteable) {
      ctx.throw(403, 'Only users with write access can export workflows.')
    }

    const archive = archiver('zip')
    archive.on('end', () => log(`zip export of ${mapId} successful`))
    archive.on('warning', error => logError(`warning when exporting ${mapId} to zip: ${error}`))
    archive.on('error', error => {
      const message = `failed to export ${mapId} to zip: ${error}`
      logError(message)
      ctx.throw(500, message)
    })

    const exportMap = {mapId, title, nodes, edges, root}
    if (tags) exportMap.tags = tags
    archive.append(JSON.stringify(exportMap), {name: 'mapdata.json'})

    const metaData = {version: 1, images: {}, files: {}}

    const imageList = (await WorkflowImage.find({'metadata.mapId': mapId})) || []
    imageList.forEach(image => {
      metaData.images[image._id] = image.toJSON()

      archive.append(image.read(), {name: `${image._id}-${image.filename || 'unknown.jpg'}`})
    })

    const fileList = (await WorkflowFile.find({'metadata.mapId': mapId})) || []
    fileList.forEach(file => {
      metaData.files[file._id] = file.toJSON()

      archive.append(file.read(), {name: `${file._id}-${file.filename || 'unknown.jpg'}`})
    })
    archive.append(JSON.stringify(metaData), {name: 'metadata.json'})

    const filename = `Workflow-${mapId}-${title}.zip`
    ctx.set('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)

    archive.finalize()

    ctx.body = archive
  },
  shareRead: async ctx => {
    const {map} = ctx.state

    ctx.body = map.share
  },
  shareWrite: async ctx => {
    ctx.throw(400, 'This endpoint is obsolete.')
  },
  sharePublicGet: async ctx => {
    const {map} = ctx.state
    ctx.body = map.share?.public || {}
  },
  sharePublicPost: async ctx => {
    const {map, auth} = ctx.state
    const payload = await ctx.request.json()
    const {isOwner} = ctx.state.access

    if (!isOwner) {
      ctx.throw(403, 'Only owners are allowed to share workflows.')
    } else if (!('enabled' in payload)) {
      ctx.throw(400, 'Badly formatted request.')
    } else if (payload.writeable && !payload.hidden && !auth?.roles.includes(ROLES.administrator)) {
      ctx.throw(403, 'Only administrators can set workflows public writeable')
    }

    if (!map.share) map.share = {}

    map.share.public = payload
    await map.save()

    ctx.body = {success: true}
  },
  shareAccessGet: async ctx => {
    const {map} = ctx.state
    ctx.body = map.share?.access || []
  },
  shareAccessPost: async ctx => {
    const {map} = ctx.state
    const payload = await ctx.request.json()
    const {isOwner} = ctx.state.access

    if (!isOwner) {
      ctx.throw(403, 'Only owners are allowed to share workflows.')
    } else if (!Array.isArray(payload)) {
      ctx.throw(400, 'Badly formatted request.')
    }

    if (!map.share) map.share = {}

    map.share.access = payload
    await map.save()

    ctx.body = {success: true}
  },
  writeable: async ctx => {
    const {isWriteable: writeable} = ctx.state.access

    ctx.body = {writeable}
  },
  nodeLimit: async ctx => {
    const {userId} = ctx.state.map

    let nodeLimit = false
    const user = await User.findOne({id: userId})
    if (user?.limitNodes) nodeLimit = user.limitNodes

    // Workaround for unfinished db TODO: Remove it
    if (ctx.state?.userId === userId && ctx.state?.auth) nodeLimit = ctx.state.auth.limitNodes

    //workaround role org_subscriber with unlimited maps/cards
    if (user.roles.includes(ROLES.org_subscriber)) nodeLimit = false

    ctx.body = {nodeLimit: nodeLimit}
  },
  addCategory: async ctx => {
    const {map} = ctx.state
    const request = await ctx.request.json()

    const {category} = request

    if (typeof category !== 'string' && category !== null) {
      ctx.abort(400, 'category has to be string')
    }

    map.category = category
    await map.save()

    ctx.body = {success: true}
  },
}

export default WorkflowController
