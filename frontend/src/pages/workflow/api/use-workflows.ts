import { useEffect, useMemo, useState } from 'react'
import type { Paginated, PaginationQuery } from '@shared/base-types'
import { useApiQuery } from '@shared/composables'
import type { MapShareFilters, WorkflowItem } from '@widgets/workflow'
import { toast } from 'sonner'
import { useSearch } from '@shared/context'

interface WorkflowsParams extends PaginationQuery {
  isPublic?: boolean
  filter?: MapShareFilters
  debounceMs?: number
}

export const useWorkflows = ({ isPublic = false, page, limit, filter, debounceMs = 400 }: WorkflowsParams) => {
  const { query } = useSearch()
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), debounceMs)
    return () => clearTimeout(handler)
  }, [query, debounceMs])

  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    params.append('public', isPublic ? 'true' : 'false')
    if (page) params.append('page', page.toString())
    if (limit) params.append('limit', limit.toString())
    if (!isPublic && filter) params.append('filter', filter)
    if (debouncedQuery) params.append('search', debouncedQuery)
    return params.toString() ? `?${params.toString()}` : ''
  }, [isPublic, page, limit, filter, debouncedQuery])

  const url = `/workflow${queryParams}`

  const {
    data: workflows,
    isLoading,
    error,
  } = useApiQuery<Paginated<WorkflowItem>>({
    queryKey: ['workflows', isPublic, limit, page, filter, debouncedQuery],
    url,
    onError: error => {
      toast.error(error.message)
    },
  })

  return {
    workflows: workflows?.data || [],
    isLoading,
    error,
    total: workflows?.total,
  }
}
