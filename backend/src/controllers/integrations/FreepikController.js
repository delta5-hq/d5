import fetch from 'node-fetch'
import {FREEPIK_API_KEY} from '../../constants'
import querystring from 'querystring'

const FreepikController = {
  getIcons: async ctx => {
    const apiKey = FREEPIK_API_KEY

    if (!apiKey) {
      ctx.throw(404, 'Freeepik Api Key is required')
    }

    const apiUrl = `https://api.freepik.com/v1/icons?${querystring.stringify(ctx.request.query)}`
    const requestOptions = {
      method: 'GET',
      headers: {
        'X-Freepik-API-Key': apiKey,
      },
      redirect: 'follow',
    }

    try {
      const response = await fetch(apiUrl, requestOptions)

      if (!response.ok) {
        ctx.throw(response.status, response.statusText)
      }

      const data = await response.json()

      ctx.body = data
    } catch (e) {
      console.error(e)
      throw (500, e.message)
    }
  },
  downloadIcon: async ctx => {
    const {id, png_size} = await ctx.request.json()
    const apiKey = FREEPIK_API_KEY

    if (!apiKey) {
      ctx.throw(404, 'Freeepik Api Key is required')
    }

    const apiUrl = `https://api.freepik.com/v1/icons/${id}/download?png_size=${png_size}`
    const requestOptions = {
      method: 'GET',
      headers: {
        'X-Freepik-API-Key': apiKey,
      },
      redirect: 'follow',
    }

    try {
      const response = await fetch(apiUrl, requestOptions)

      if (!response.ok) {
        ctx.throw(response.status, response.statusText)
      }

      const data = await response.json()

      ctx.body = data
    } catch (e) {
      console.error(e)
      throw (500, e.message)
    }
  },
}

export default FreepikController
