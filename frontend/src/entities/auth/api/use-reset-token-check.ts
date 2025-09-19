import { useApiQuery } from '@shared/composables'
import { queryKeys } from '@shared/config'

export const useResetTokenCheck = (token: string) => {
  const { data, isLoading } = useApiQuery<{ success: boolean }>({
    queryKey: queryKeys.authPwdTokenCheck,
    url: `/auth/check-reset-token/${token}`,
  })

  return { isValid: !!data?.success, isLoading }
}
