import path from 'path'
import WorkflowFile from '../models/WorkflowFile'
import Thumbnail from '../models/Thumbnail'
import {bufferToStream, hashStream} from './utils/hashStream'
import readStreamToBuffer from '../utils/readStreamToBuffer'

const FileController = {
  load: async (ctx, next) => {
    const {fileId} = ctx.params

    let file = await WorkflowFile.findOne({_id: fileId})

    if (!file) {
      ctx.throw(404, 'File not found.')
    }
    ctx.state.file = file

    await next()
  },
  authorization: async (ctx, next) => {
    const {workflowId} = ctx.params
    const {file} = ctx.state

    if (file.metadata.workflowId !== workflowId) {
      ctx.throw(400, 'File is not associated with this workflow.')
    }

    await next()
  },
  list: async ctx => {
    const {workflowId} = ctx.params
    const {templateId} = ctx.params

    ctx.body = workflowId
      ? await WorkflowFile.find({'metadata.workflowId': workflowId})
      : await WorkflowFile.find({'metadata.templateId': templateId})
  },

  listInfo: async ctx => {
    const files = await WorkflowFile.find(
      {'metadata.workflowId': ctx.params.workflowId},
      {
        data: 0,
      },
    )

    ctx.body = files
  },

  get: async ctx => {
    const {file} = ctx.state

    ctx.body = file.read()
    if (file.filename) ctx.set('Content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
    ctx.type = file.metadata.contentType || path.extname(file.filename) || 'application/octet-stream'
  },

  create: async ctx => {
    // TODO: set count of selected items, so we can determine later if the image can be deleted
    const {
      request: {query: {filename = 'no-file-name-given'} = {}},
      headers: {'content-type': contentType},
      params: {workflowId},
      state: {userId},
    } = ctx

    try {
      const buffer = await readStreamToBuffer(ctx.req)
      const hash = await hashStream(bufferToStream(buffer))
      const metadata = {workflowId, contentType, userId, hash}

      const file = await WorkflowFile.write({filename, metadata}, bufferToStream(buffer))

      ctx.body = {_id: file._id}
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },

  delete: async ctx => {
    const {file} = ctx.state
    const {fileId} = ctx.params

    await Thumbnail.deleteMany({metadata: {fileId}})
    await file.unlink()

    ctx.body = {success: true}
  },

  hash: async ctx => {
    try {
      const {file} = ctx.state

      ctx.body = await hashStream(file.read())
    } catch (error) {
      ctx.throw(500, 'Failed to hash file')
    }
  },
}

export default FileController
