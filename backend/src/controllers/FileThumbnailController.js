import {promises as fs} from 'fs'
import path from 'path'
import send from 'koa-send'
import Thumbnail from '../models/Thumbnail'
import {DOCS_SERVICE_URL, PDF_SERVICE_URL} from '../constants'
import {container} from '../services/container'

const thumbnailService = container.get('thumbnailService')

const DOC_MIME_TYPES = [
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.text-template',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.presentation-template',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.spreadsheet-template',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-word.document.macroenabled.12',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/vnd.ms-word.template.macroenabled.12',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  'application/vnd.ms-excel.template.macroenabled.12',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint.presentation.macroenabled.12',
  'application/vnd.openxmlformats-officedocument.presentationml.template',
  'application/vnd.ms-powerpoint.template.macroenabled.12',
  'application/msword',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  'application/vnd.ms-excel.template.macroEnabled.12',
  'application/vnd.ms-excel.addin.macroEnabled.12',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-powerpoint',
]

const DOC_ENDINGS = [
  'odt',
  'ott',
  'odp',
  'otp',
  'ods',
  'ots',

  'doc',
  'dot',
  'docx',
  'docm',
  'dotx',
  'dotm',

  'xls',
  'xlt',
  'xla',
  'xlam',
  'xlsb',
  'xlsx',
  'xlsm',
  'xltx',
  'xltm',

  'ppt ',
  'pot ',
  'pps ',
  'ppa ',
  'pptx',
  'pptm',
  'potx',
  'potm',
]

const PDF_MIME_TYPES = ['application/pdf', 'application/x-pdf']

const getUrlFromType = endingOrMime => {
  if (DOC_ENDINGS.includes(endingOrMime) || DOC_MIME_TYPES.includes(endingOrMime)) {
    return DOCS_SERVICE_URL
  } else if (PDF_MIME_TYPES.includes(endingOrMime) || endingOrMime === 'pdf') {
    return PDF_SERVICE_URL
  }
}

const FileThumbnailController = {
  load: async (ctx, next) => {
    const {size = Thumbnail.SIZES.full} = ctx.query
    const {file} = ctx.state

    if (!Object.values(Thumbnail.SIZES).includes(size)) {
      ctx.throw(400, `Wrong size given (${size})`)
    }

    const url = getUrlFromType(file.metadata?.contentType || path.extname(file.filename).replace('.', ''))

    if (url) {
      const filter = {
        filename: file.filename,
        metadata: {fileId: file._id, ...file.metadata, size},
      }
      const options = {
        body: file.read(),
        headers: {
          'Content-Type': file.metadata?.contentType || 'application/octet-stream',
        },
      }
      ctx.state.thumbnail = await thumbnailService.generate(filter, url, options)
    }

    await next()
  },
  get: async ctx => {
    const {file} = ctx.state
    const {thumbnail} = ctx.state

    if (thumbnail) {
      ctx.body = thumbnail.read()

      if (thumbnail.filename)
        ctx.set('Content-disposition', `inline; filename=${encodeURIComponent(thumbnail.filename)}`)
      ctx.type = thumbnail.metadata.contentType || path.extname(thumbnail.filename) || 'application/octet-stream'
    } else {
      const extension = path.extname(file.filename).replace('.', '')

      let imagePath = `/assets/${extension}.png`
      const pathExists = await fs
        .access(`${process.cwd()}${imagePath}`)
        .then(() => true)
        .catch(() => false)
      if (!pathExists) {
        imagePath = '/assets/default.png'
      }

      await send(ctx, imagePath)
    }
  },
}

export default FileThumbnailController
