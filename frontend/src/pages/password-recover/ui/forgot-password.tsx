import {
  useAuthContext,
  usePasswordRecovery,
  type RequestRecoveryDto,
  AuthPageLayout,
  EmailSentDialog,
  AuthFormTitle,
  AuthFormField,
  LoginDialog,
} from '@entities/auth'
import { useDialog } from '@entities/dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
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
  const { showDialog } = useDialog()

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

      <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
        <AuthFormTitle messageId="accountRecovery" />

        <AuthFormField
          error={errors.usernameOrEmail?.message}
          htmlFor="usernameOrEmail"
          label={<FormattedMessage id="usernameOrEmail" />}
        >
          <Input {...register('usernameOrEmail')} autoFocus id="usernameOrEmail" required />
        </AuthFormField>

        <Button className="w-full" disabled={isSubmitting} type="submit" variant="accent">
          <FormattedMessage id="sendRecoveryLink" />
        </Button>

        <div className="flex flex-col gap-2">
          <button
            className="text-center text-sm text-link hover:text-link-hover hover:underline cursor-pointer"
            onClick={() => {
              navigate('/')
              showDialog(LoginDialog)
            }}
            type="button"
          >
            <FormattedMessage id="loginTitle" />
          </button>
          <button
            className="text-center text-sm text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
            onClick={() => navigate('/')}
            type="button"
          >
            <FormattedMessage id="buttonCancel" />
          </button>
        </div>
      </form>
    </AuthPageLayout>
  )
}

export default ForgotPassword
