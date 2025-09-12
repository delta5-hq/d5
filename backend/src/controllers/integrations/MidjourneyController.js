import fetch from 'node-fetch'
import {GOAPI_API_KEY} from '../../constants'
import {delay} from '../utils/delay'

const MidjourneyController = {
  create: async ctx => {
    const {prompt, process_mode} = await ctx.request.json()
    const apiKey = GOAPI_API_KEY

    if (!apiKey) {
      ctx.throw(404, 'Api Key is required')
    }

    const imagineUrl = 'https://api.midjourneyapi.xyz/mj/v2/imagine'
    const fetchUrl = 'https://api.midjourneyapi.xyz/mj/v2/fetch'

    try {
      const imagineResponse = await fetch(imagineUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({
          prompt: `${prompt} --v 5.2`,
          process_mode,
        }),
      })

      const {task_id, message} = await imagineResponse.json()

      if (imagineResponse.status !== 200) {
        ctx.throw(imagineResponse.status, message)
      }

      let attempts = 200

      const fetchOptions = {
        method: 'POST',
        body: JSON.stringify({
          task_id,
        }),
      }

      while (attempts) {
        const response = await fetch(fetchUrl, fetchOptions)

        if (response.status !== 200) {
          ctx.throw(response.status, response.statusText)
          break
        }

        attempts -= 1

        const fetchJson = await response.json()
        const {status} = fetchJson

        if (status === 'finished' || status === 'failed' || !attempts) {
          ctx.body = fetchJson
          break
        }

        await delay(3500)
      }
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },

  upscale: async ctx => {
    const data = await ctx.request.json()
    const apiKey = GOAPI_API_KEY

    if (!apiKey) {
      ctx.throw(404, 'Api Key is required')
    }

    const upscaleUrl = 'https://api.midjourneyapi.xyz/mj/v2/upscale'
    const fetchUrl = 'https://api.midjourneyapi.xyz/mj/v2/fetch'

    try {
      const upscaleResponse = await fetch(upscaleUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify(data),
      })

      const {task_id, message} = await upscaleResponse.json()

      if (upscaleResponse.status !== 200) {
        ctx.throw(upscaleResponse.status, message)
      }

      let attempts = 200

      const fetchOptions = {
        method: 'POST',
        body: JSON.stringify({
          task_id,
        }),
      }

      while (attempts) {
        const response = await fetch(fetchUrl, fetchOptions)

        if (response.status !== 200) {
          ctx.throw(response.status, response.statusText)
          break
        }

        attempts -= 1

        const fetchJson = await response.json()
        const {status} = fetchJson

        if (status === 'finished' || status === 'failed' || !attempts) {
          ctx.body = fetchJson
          break
        }

        await delay(3500)
      }
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },
}

export default MidjourneyController
