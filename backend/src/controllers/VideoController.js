import fetch from 'node-fetch'
import {GOOGLE_API_KEY} from '../constants'

const VideoController = {
  getYoutubePreviewImage: async ctx => {
    const {videoId} = ctx.request.query

    if (!videoId) {
      ctx.throw(404, 'Video id is reqired')
    }

    try {
      const youtubeResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${GOOGLE_API_KEY}&part=snippet`,
      )

      if (youtubeResponse.status !== 200) {
        ctx.throw(youtubeResponse.status, youtubeResponse.text)
      }

      const data = await youtubeResponse.json()
      const videoInfo = data.items[0]
      const thubmnails = videoInfo.snippet.thumbnails

      let thubmnailUrl = ''

      if (thubmnails.maxres) {
        thubmnailUrl = videoInfo.snippet.thumbnails.maxres.url
      } else if (thubmnails.high) {
        thubmnailUrl = videoInfo.snippet.thumbnails.high.url
      } else if (thubmnails.medium) {
        thubmnailUrl = videoInfo.snippet.thumbnails.medium.url
      } else {
        thubmnailUrl = videoInfo.snippet.thumbnails.default.url
      }

      const imageResponse = await fetch(thubmnailUrl)

      if (imageResponse.status !== 200) {
        ctx.throw(imageResponse.status, imageResponse.text)
      }
      ctx.type = imageResponse.headers.get('content-type')

      ctx.body = imageResponse.body
    } catch (e) {
      ctx.throw('Error when trying to request google api: ' + e.message)
    }
  },

  getYoutubeVideo: async ctx => {
    const {videoId} = ctx.request.query

    if (!videoId) {
      ctx.throw(404, 'Video id is reqired')
    }

    try {
      const youtubeResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${GOOGLE_API_KEY}&part=player`,
      )

      if (youtubeResponse.status !== 200) {
        ctx.throw(youtubeResponse.status, youtubeResponse.text)
      }

      const data = await youtubeResponse.json()
      const videoInfo = data.items[0]
      const player = videoInfo.player.embedHtml

      ctx.contentType = 'text/html'
      ctx.body = player
    } catch (e) {
      ctx.throw('Error when trying to request google api: ' + e.message)
    }
  },
}

export default VideoController
