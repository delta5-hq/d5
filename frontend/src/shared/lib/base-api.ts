import { API_FULL_URL } from '@shared/config/api'
import logger from './logger'

interface ApiFetchOptions extends RequestInit {
  retry?: boolean
}

export const apiFetch = async <T = unknown>(url: string, options: ApiFetchOptions = {}): Promise<T> => {
  const res = await fetch(`${API_FULL_URL}${url}`, options)

  if (res.status === 401 && !options.retry) {
    const refreshRes = await fetch(`${API_FULL_URL}/refresh`, {
      method: 'POST',
      credentials: 'include',
    })

    if (!refreshRes.ok) {
      throw new Error('Unauthorized, refresh failed')
    }

    return apiFetch(url, { ...options, retry: true })
  }

  if (!res.ok) {
    let errorMessage = res.statusText

    try {
      const data = await res.json()
      if (data?.message) errorMessage = data.message
    } catch {
      logger.error('Failed to parse error response as JSON')
    }

    throw new Error(`HTTP ${res.status}: ${errorMessage}`)
  }

  return res.json()
}
