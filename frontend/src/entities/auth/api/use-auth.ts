import { useApiMutation, useApiQuery } from '@shared/composables'
import { queryKeys } from '@shared/config'
import type { LoginCredentials, User } from '@shared/base-types'

export const useAuth = () => {
  const meQuery = useApiQuery<User>({
    queryKey: queryKeys.authMe,
    url: '/users/me',
  })

  const loginMutation = useApiMutation<unknown, unknown, LoginCredentials>({
    url: '/auth',
  })
  const refreshMutation = useApiMutation<unknown, unknown, void>({
    url: '/auth/refresh',
  })

  const login = async (data: LoginCredentials) => {
    await loginMutation.mutateAsync(data)
    await refreshMutation.mutateAsync()
    await meQuery.refetch()
  }

  const user = meQuery.data

  return {
    user,
    isLoggedIn: !!user,
    login,
  }
}
