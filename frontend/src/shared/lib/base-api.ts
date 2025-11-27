import type { ApiVersion } from '@shared/base-types'
import { API_BASE_PATH, API_V2_BASE_PATH } from '@shared/config/api'
import logger from './logger'

interface ApiFetchOptions extends RequestInit {
  retry?: boolean
  version?: ApiVersion
}

let refreshPromise: Promise<Response> | null = null

async function refreshToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_PATH}/refresh`, {
      method: 'POST',
      credentials: 'include',
    }).finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

export const apiFetch = async <T = unknown>(url: string, options: ApiFetchOptions = {}): Promise<T> => {
  const basePath = options.version === 'v2' ? API_V2_BASE_PATH : API_BASE_PATH
  const res = await fetch(`${basePath}${url}`, options)

  if (res.status === 401 && !url.startsWith('/auth') && !options.retry) {
    const refreshRes = await refreshToken()

    if (!refreshRes.ok) {
      throw new Error('Unauthorized, refresh failed')
    }

    return apiFetch<T>(url, { ...options, retry: true })
  }

  if (!res.ok) {
    let errorMessage = res.statusText

    try {
      const data = await res.json()
      if (data?.message) errorMessage = data.message
    } catch {
      logger.error('Failed to parse error response as JSON')
    }

    throw new Error(errorMessage)
  }

  const contentType = res.headers.get('Content-Type') || ''

  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>
  }

  if (contentType.startsWith('text/')) {
    return res.text() as unknown as Promise<T>
  }

  return res.blob() as unknown as Promise<T>
}
