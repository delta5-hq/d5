import type { PaginationQuery, User } from '@shared/base-types'
import type { Paginated } from '@shared/base-types'
import { useApiQuery } from '@shared/composables'
import { queryKeys } from '@shared/config'
import { useEffect } from 'react'

interface UseWaitlistProps extends PaginationQuery {}

export const useWaitlist = ({ page = 1, limit = 25, search = '' }: UseWaitlistProps) => {
  const { data, isLoading, error, refetch } = useApiQuery<Paginated<User>>({
    queryKey: [queryKeys.waitlist],
    url: `/statistics/waitlist?page=${page}&limit=${limit}&search=${search}`,
  })

  useEffect(() => {
    refetch()
  }, [page, limit, search, refetch])

  return {
    users: data?.data ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    limit: data?.limit ?? limit,
    refresh: refetch,

    isLoading,
    error,
  }
}
