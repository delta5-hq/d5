import { useApiMutation } from '@shared/composables'
import { useIntl } from 'react-intl'
import { toast } from 'sonner'
import type { RequestRecoveryDto, ResetPasswordDto } from '../model'
import { apiFetch } from '@shared/lib/base-api'

export const usePasswordRecovery = () => {
  const { formatMessage } = useIntl()

  const requestRecoveryMutation = useApiMutation<unknown, Error, RequestRecoveryDto>({
    url: '/auth/forgot-password',
    onError: (error: Error) => {
      const { message } = error
      if (message) {
        toast.error(message)
      } else {
        toast.error(formatMessage({ id: 'errorServer' }))
      }
    },
  })
  const resetPasswordMutation = useApiMutation<unknown, Error, ResetPasswordDto>({
    mutationFn: (data: ResetPasswordDto) => {
      const { password, token } = data
      return apiFetch(`/auth/reset-password/${token}`, { method: 'POST', body: JSON.stringify({ password }) })
    },
  })

  const requestRecover = async (dto: RequestRecoveryDto) => {
    await requestRecoveryMutation.mutateAsync(dto)
  }

  const resetPassword = async (dto: ResetPasswordDto) => {
    await resetPasswordMutation.mutateAsync(dto)
  }

  return {
    isRecovering: requestRecoveryMutation.isPending,
    isResetting: resetPasswordMutation.isPending,
    isRecoverySent: requestRecoveryMutation.isSuccess,

    requestRecover,
    resetPassword,
  }
}
