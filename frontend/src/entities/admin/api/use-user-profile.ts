import { useApiMutation, useApiQuery } from '@shared/composables'
import { queryKeys } from '@shared/config'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { FullUserStatistics, UserWorkflowStatistics } from '../model'

export const useUserProfile = (userId: string) => {
  const navigate = useNavigate()
  const { formatMessage } = useIntl()

  const mapsQuery = useApiQuery<UserWorkflowStatistics[]>({
    url: `/statistics/workflow/${userId}`,
    queryKey: queryKeys.userMaps(userId),
  })

  const userQuery = useApiQuery<FullUserStatistics>({
    url: `/statistics/users/${userId}`,
    queryKey: queryKeys.userProfile(userId),
  })

  const deleteUserMutation = useApiMutation<unknown, Error, void>({
    url: `/users/${userId}`,
    method: 'DELETE',
    onSuccess: () => {
      navigate('/admin/users')
      toast.success(formatMessage({ id: 'userProfileDeleteSuccess' }))
    },
    onError: err => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { status, message } = err as any
      if (status === 403) toast.error(formatMessage({ id: 'errorNoPermissions' }))
      else if (status === 404) toast.error(formatMessage({ id: 'errorLoginUsername' }))
      else if (message) toast.error(message)
      else toast.error(formatMessage({ id: 'errorUnknown' }))
    },
  })

  const updateCommentMutation = useApiMutation({
    url: `/statistics/users/${userId}/comment`,
    method: 'POST',
    onSuccess: () => {
      userQuery.refetch()
      toast.success(formatMessage({ id: 'admin.crm.userProfile.commentSaveSuccess' }))
    },
    onError: err => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { status, message } = err as any
      if (status === 401) toast.error(formatMessage({ id: 'errorLogin' }))
      else if (message) toast.error(message)
      else toast.error(formatMessage({ id: 'errorUnknown' }))
    },
  })

  return {
    userData: userQuery.data,
    mapsData: mapsQuery.data,

    isUserFetched: userQuery.isFetched,
    refetchUser: userQuery.refetch,
    deleteUser: deleteUserMutation.mutate,
    updateComment: updateCommentMutation.mutate,
    mapsQuery,
    userQuery,
    deleteUserMutation,
    updateCommentMutation,
  }
}
