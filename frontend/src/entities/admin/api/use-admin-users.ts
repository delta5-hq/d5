import { useEffect } from 'react'
import type { Paginated } from '@shared/base-types'
import { useApiQuery } from '@shared/composables'
import { queryKeys } from '@shared/config'
import type { FullUserStatistics } from '../model'

interface UseAdminUsersProps {
  page?: number
  limit?: number
  search?: string
}

export const useAdminUsers = ({ page = 1, limit = 25, search = '' }: UseAdminUsersProps) => {
  const { data, isLoading, error, refetch } = useApiQuery<Paginated<FullUserStatistics>>({
    queryKey: [queryKeys.waitlist],
    url: `/statistics/users?page=${page}&limit=${limit}&search=${search}`,
  })

  useEffect(() => {
    refetch()
  }, [page, limit, search, refetch])

  return {
    users: data?.data ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    limit: data?.limit ?? limit,

    isLoading,
    error,
  }
}
