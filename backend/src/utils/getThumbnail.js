import fetch from 'node-fetch'
import debug from 'debug'
import Thumbnail from '../models/Thumbnail'

const log = debug('delta5:getThumbnail')
const logError = log.extend('ERROR', '::')

const getThumbnailReal = async (filter, url, options) => {
  let thumbnail = await Thumbnail.findOne(filter)

  if (!thumbnail) {
    // thumbnail is not in database, fetch it from
    const response = await fetch(url, {
      method: 'post',
      ...options,
    })
    console.log(response)
    if (response.status !== 200) {
      logError('Could not create thumbnail', response.status, await response.text())
      throw new Error('Cannot create thumbnail.')
    }

    // save response to database
    const saveThumbnail = new Thumbnail(filter)
    await saveThumbnail.write(response.body)

    thumbnail = await Thumbnail.findOne(filter)
  }

  return thumbnail
}

/* Noop implementation for E2E testing - returns fake 1x1 PNG without external service */
const getThumbnailNoop = async filter => {
  log('NOOP: getThumbnailNoop', filter)

  /* Return 1x1 transparent PNG in stream format matching Thumbnail model interface */
  const pngData = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01, // 1x1 dimensions
    0x08,
    0x06,
    0x00,
    0x00,
    0x00,
    0x1f,
    0x15,
    0xc4,
    0x89,
    0x00,
    0x00,
    0x00,
    0x0a,
    0x49,
    0x44,
    0x41,
    0x54, // IDAT chunk
    0x78,
    0x9c,
    0x63,
    0x00,
    0x01,
    0x00,
    0x00,
    0x05,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4e,
    0x44,
    0xae,
    0x42,
    0x60,
    0x82, // IEND
  ])

  return {
    read: () => pngData,
  }
}

/* Module-level decision: Mock external services in test environments */
const getThumbnail = process.env.MOCK_EXTERNAL_SERVICES === 'true' ? getThumbnailNoop : getThumbnailReal

export default getThumbnail
