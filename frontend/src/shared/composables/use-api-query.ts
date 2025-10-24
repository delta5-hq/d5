import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '@shared/lib/base-api'
import type { ApiVersion } from '@shared/base-types'

interface ExtraQueryParams<TData = unknown, TError = unknown> {
  url?: string
  onSuccess?: (data: TData) => void
  onError?: (error: TError) => void
}

type ExtendedOptions<TQueryFnData, TError, TData, TQueryKey extends readonly unknown[]> = UseQueryOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey
> &
  ExtraQueryParams<TData, TError> & {
    version?: ApiVersion
  }

export const useApiQuery = <
  TData = unknown,
  TQueryFnData = unknown,
  TError = Error,
  TQueryKey extends readonly unknown[] = readonly unknown[],
>(
  options: ExtendedOptions<TQueryFnData, TError, TData, TQueryKey>,
) => {
  const { url, onSuccess, onError, ...rest } = options

  const query = useQuery<TQueryFnData, TError, TData, TQueryKey>({
    queryFn: async () => {
      if (!url) throw new Error('Url is required')
      return apiFetch(url, { version: options.version })
    },
    retry: 0,
    ...rest,
  })

  useEffect(() => {
    if (query.data) onSuccess?.(query.data)
  }, [query.data, onSuccess])

  useEffect(() => {
    if (query.error) onError?.(query.error)
  }, [query.error, onError])

  return query
}
