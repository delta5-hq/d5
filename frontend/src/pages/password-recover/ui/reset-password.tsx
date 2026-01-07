import {
  isValidPassword,
  LoginDialog,
  useAuthContext,
  usePasswordRecovery,
  useResetTokenCheck,
  AuthPageLayout,
  AuthFormTitle,
} from '@entities/auth'
import {
  PrimarySubmitButton,
  LoginNavigationLink,
  CancelNavigationLink,
} from '@entities/auth/ui/login-dialog/components'
import { useDialog } from '@entities/dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { PasswordFieldWithStrength } from '@shared/ui/form-fields'
import { Spinner } from '@shared/ui/spinner'
import { useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { useNavigate, useParams } from 'react-router-dom'
import * as z from 'zod'

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(1, 'passwordRequired')
    .refine(val => isValidPassword(val), 'invalidPassword'),
})

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

const ResetPassword = () => {
  const navigate = useNavigate()
  const { pwdResetToken } = useParams<{ pwdResetToken: string }>()
  const { isLoggedIn } = useAuthContext()
  const { showDialog } = useDialog()

  const { isValid, isLoading } = useResetTokenCheck(pwdResetToken)
  const { resetPassword } = usePasswordRecovery()

  useEffect(() => {
    if (isLoggedIn) navigate('/')
  }, [isLoggedIn, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const passwordValue = watch('password', '')

  const onSubmit = useCallback(
    async (data: ResetPasswordForm) => {
      if (!pwdResetToken) return
      await resetPassword({ ...data, token: pwdResetToken })
      navigate('/')
      showDialog(LoginDialog)
    },
    [resetPassword, pwdResetToken, showDialog, navigate],
  )

  return (
    <AuthPageLayout maxWidth="md" showFooter={false}>
      {isLoading ? <Spinner /> : null}

      {!isLoading && !isValid ? (
        <p className="text-center text-foreground text-xl">
          <FormattedMessage id="noDataAvailable" />
        </p>
      ) : null}

      {!isLoading && isValid ? (
        <form className="flex flex-col gap-8" onSubmit={handleSubmit(onSubmit)}>
          <AuthFormTitle messageId="resetPassword" />

          <PasswordFieldWithStrength
            errors={errors}
            fieldName="password"
            passwordValue={passwordValue}
            register={register}
          />

          <PrimarySubmitButton isLoading={isSubmitting}>
            <FormattedMessage id="reset" />
          </PrimarySubmitButton>

          <div className="flex flex-col gap-2">
            <LoginNavigationLink />
            <CancelNavigationLink />
          </div>
        </form>
      ) : null}
    </AuthPageLayout>
  )
}

export default ResetPassword
