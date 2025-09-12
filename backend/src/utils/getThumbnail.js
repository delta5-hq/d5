import fetch from 'node-fetch'
import debug from 'debug'
import Thumbnail from '../models/Thumbnail'

const log = debug('delta5:getThumbnail')
const logError = log.extend('ERROR', '::')

const getThumbnail = async (filter, url, options) => {
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

export default getThumbnail
