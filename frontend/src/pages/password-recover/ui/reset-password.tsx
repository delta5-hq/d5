import {
  isValidPassword,
  LoginDialog,
  useAuthContext,
  usePasswordRecovery,
  useResetTokenCheck,
  AuthPageLayout,
  AuthFormTitle,
  AuthFormField,
} from '@entities/auth'
import { useDialog } from '@entities/dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@shared/ui/button'
import { PasswordInput } from '@shared/ui/password-input'
import { Spinner } from '@shared/ui/spinner'
import { useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { useNavigate, useParams, Link } from 'react-router-dom'
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
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  })

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
        <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
          <AuthFormTitle messageId="resetPassword" />

          <AuthFormField
            error={errors.password ? <FormattedMessage id={errors.password?.message} /> : null}
            htmlFor="password"
            label={<FormattedMessage id="password" />}
          >
            <PasswordInput {...register('password')} autoComplete="new-password" id="password" required />
          </AuthFormField>

          <Button className="w-full" disabled={isSubmitting} type="submit" variant="accent">
            <FormattedMessage id="reset" />
          </Button>

          <Link className="text-center text-sm text-link hover:text-link-hover hover:underline" to="/">
            <FormattedMessage id="buttonCancel" />
          </Link>
        </form>
      ) : null}
    </AuthPageLayout>
  )
}

export default ResetPassword
