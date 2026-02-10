import {
  useAuthContext,
  usePasswordRecovery,
  type RequestRecoveryDto,
  AuthPageLayout,
  EmailSentDialog,
  AuthFormTitle,
} from '@entities/auth'
import {
  EmailOrUsernameField,
  PrimarySubmitButton,
  LoginNavigationLink,
  CancelNavigationLink,
} from '@entities/auth/ui/login-dialog/components'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import * as z from 'zod'

const recoverySchema = z.object({
  usernameOrEmail: z.string().min(1, 'Required field'),
})

type RecoveryFormValues = z.infer<typeof recoverySchema>

const ForgotPassword = () => {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuthContext()
  const [showEmailSentDialog, setShowEmailSentDialog] = useState(false)

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/')
    }
  }, [isLoggedIn, navigate])

  const { requestRecover } = usePasswordRecovery()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoveryFormValues>({
    resolver: zodResolver(recoverySchema),
  })

  const onSubmit = useCallback(
    async (formData: RequestRecoveryDto) => {
      await requestRecover(formData)
      setShowEmailSentDialog(true)
    },
    [requestRecover],
  )

  const onCloseEmailDialog = () => {
    setShowEmailSentDialog(false)
    navigate('/')
  }

  return (
    <AuthPageLayout maxWidth="md">
      <EmailSentDialog onClose={onCloseEmailDialog} open={showEmailSentDialog} />

      <form className="flex flex-col gap-8" onSubmit={handleSubmit(onSubmit)}>
        <AuthFormTitle messageId="accountRecovery" />

        <EmailOrUsernameField autoFocus errors={errors} fieldName="usernameOrEmail" register={register} />

        <PrimarySubmitButton isLoading={isSubmitting}>
          <FormattedMessage id="sendRecoveryLink" />
        </PrimarySubmitButton>

        <div className="flex flex-col gap-2">
          <LoginNavigationLink />
          <CancelNavigationLink />
        </div>
      </form>
    </AuthPageLayout>
  )
}

export default ForgotPassword
