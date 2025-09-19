import { apiFetch } from '@shared/lib/base-api'
import { useQuery, type DefinedInitialDataOptions } from '@tanstack/react-query'
import { useEffect } from 'react'

interface ExtraQueryParams<TData = unknown, TError = unknown> {
  url?: string
  onSuccess?: (data: TData) => void
  onError?: (error: TError) => void
}

type ExtendedOptions<TQueryFnData, TError, TData, TQueryKey extends readonly unknown[]> = DefinedInitialDataOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey
> &
  ExtraQueryParams<TData, TError>

const useApiQuery = <
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends readonly unknown[] = readonly unknown[],
>(
  options: ExtendedOptions<TQueryFnData, TError, TData, TQueryKey>,
) => {
  const { url, onSuccess, onError, ...rest } = options

  const query = useQuery<TQueryFnData, TError, TData, TQueryKey>({
    queryFn: async () => {
      if (!url) {
        throw new Error('Url is required')
      }
      return apiFetch(url)
    },
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

export default useApiQuery
