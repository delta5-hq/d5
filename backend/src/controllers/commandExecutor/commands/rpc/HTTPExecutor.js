import {RPC_DEFAULT_TIMEOUT_MS, RPC_HTTP_METHOD} from '../../constants/rpc'

export class HTTPExecutor {
  async execute({url, method = RPC_HTTP_METHOD.POST, headers = {}, body = null, timeoutMs = RPC_DEFAULT_TIMEOUT_MS}) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const requestOptions = {
        method,
        headers,
        signal: controller.signal,
      }

      if (body !== null && method !== RPC_HTTP_METHOD.GET) {
        requestOptions.body = body
      }

      const response = await fetch(url, requestOptions)

      const responseBody = await response.text()

      return {
        status: response.status,
        body: responseBody,
        isError: !response.ok,
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`HTTP request timeout after ${timeoutMs}ms`)
      }
      throw new Error(`HTTP request failed: ${error.message}`)
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
