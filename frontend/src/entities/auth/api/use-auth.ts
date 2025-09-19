import { useApiMutation, useApiQuery } from '@shared/composables'
import { queryKeys } from '@shared/config'
import type { LoginCredentials, User } from '@shared/base-types'
import { toast } from 'sonner'
import { useIntl } from 'react-intl'

export const useAuth = () => {
  const { formatMessage } = useIntl()

  const meQuery = useApiQuery<User>({
    queryKey: queryKeys.authMe,
    url: '/users/me',
  })

  const loginMutation = useApiMutation<unknown, Error, LoginCredentials>({
    url: '/auth',
    onError: async (error: Error) => {
      toast.error(error.message)
    },
  })
  const refreshMutation = useApiMutation<unknown, unknown, void>({
    url: '/auth/refresh',
  })
  const signupMutation = useApiMutation<unknown, Error, unknown>({
    url: '/auth/signup',
    onError: async (error: Error) => {
      const { message } = error
      if (message) {
        toast.error(message)
      } else {
        toast.error(formatMessage({ id: 'errorServer' }))
      }
    },
  })

  const login = async (data: LoginCredentials) => {
    await loginMutation.mutateAsync(data)
    await refreshMutation.mutateAsync()
    await meQuery.refetch()
  }

  const signup = async (data: unknown) => {
    await signupMutation.mutateAsync(data)
  }

  const user = meQuery.data

  return {
    user,
    isLoggedIn: !!user,
    isLoading: meQuery.isLoading || loginMutation.isPending || signupMutation.isPending,
    isSuccessSignup: signupMutation.isSuccess,

    login,
    signup,
  }
}
