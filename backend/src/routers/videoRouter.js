import Router from '@koa/router'

import VideoController from '../controllers/VideoController'

const videoRouter = new Router({prefix: '/videos'})

videoRouter
  .get('/youtube_image', VideoController.getYoutubePreviewImage)
  .get('/youtube_video', VideoController.getYoutubeVideo)

export default videoRouter
