import type { ApiVersion } from '@shared/base-types'
import { apiFetch } from '@shared/lib/base-api'
import { useMutation, type UseMutationOptions } from '@tanstack/react-query'

interface ExtraMutationParams {
  url?: string
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
}

type ExtendedMutationOptions<TData, TError, TVariables> = UseMutationOptions<TData, TError, TVariables> &
  ExtraMutationParams & {
    version: ApiVersion
  }

export const useApiMutation = <TData = unknown, TError = Error, TVariables = unknown>(
  options: ExtendedMutationOptions<TData, TError, TVariables>,
) => {
  const { url, method = 'POST', ...rest } = options

  return useMutation<TData, TError, TVariables>({
    mutationFn: async (body?: TVariables) => {
      if (!url) {
        throw new Error('Url is required')
      }

      const headers: Record<string, string> = {}
      let processedBody: BodyInit | null = null

      if (body instanceof FormData) {
        processedBody = body
      } else if (typeof body === 'object' && body !== null && !(body instanceof ArrayBuffer)) {
        processedBody = JSON.stringify(body)
        headers['Content-Type'] = 'application/json'
      } else if (typeof body === 'string' || body instanceof ArrayBuffer) {
        processedBody = body
        headers['Content-Type'] = 'application/octet-stream'
      }

      return apiFetch(url, {
        method,
        body: processedBody,
        headers,
        version: options.version,
      })
    },
    ...rest,
  })
}
