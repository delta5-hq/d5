import fetch from 'node-fetch'

const extractApiKeyFromAuthorizationHeader = ctx => {
  const authHeader = ctx.headers.authorization
  if (!authHeader) return null

  const parts = authHeader.split(' ')
  return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null
}

const createProxyHeaders = apiKey => {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json',
  }

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  return headers
}

const proxyToCustomLLM = async (ctx, endpoint) => {
  const {url, ...requestParams} = await ctx.request.json('infinity')

  if (!url) {
    ctx.throw(400, 'URL parameter is required')
  }

  const apiKey = extractApiKeyFromAuthorizationHeader(ctx)
  const targetUrl = `${url}${endpoint}`
  const headers = createProxyHeaders(apiKey)

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      body: JSON.stringify(requestParams),
      headers,
    })

    const responseText = await response.text()

    if (!response.ok) {
      ctx.throw(response.status, responseText || response.statusText)
    }

    ctx.body = JSON.parse(responseText)
  } catch (error) {
    const statusCode = error.status || error.code === 'ECONNREFUSED' ? 503 : 500
    ctx.throw(statusCode, error.message || 'Custom LLM proxy error')
  }
}

const CustomLLMController = {
  chatCompletions: async ctx => {
    await proxyToCustomLLM(ctx, '/chat/completions')
  },

  embeddings: async ctx => {
    await proxyToCustomLLM(ctx, '/embeddings')
  },
}

export default CustomLLMController
