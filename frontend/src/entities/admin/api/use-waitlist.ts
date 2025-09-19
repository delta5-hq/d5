import type { User } from '@shared/base-types'
import type { Paginated } from '@shared/base-types'
import { useApiQuery } from '@shared/composables'
import { queryKeys } from '@shared/config'

export const useWaitlist = (page = 1, limit = 25) => {
  const { data, isLoading, error, refetch } = useApiQuery<Paginated<User>>({
    queryKey: [queryKeys.waitlist, page, limit],
    url: `/statistics/waitlist?page=${page}&limit=${limit}`,
  })

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
