import { useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod/v3'
import { FormattedMessage } from 'react-intl'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { isValidPassword, LoginDialog, useAuthContext, usePasswordRecovery, useResetTokenCheck } from '@entities/auth'
import { Logo } from '@shared/ui/logo'
import { Version } from '@shared/ui/version'
import { Label } from '@shared/ui/label'
import { Spinner } from '@shared/ui/spinner'
import { Copyright } from '@shared/ui/copyright'
import { useDialog } from '@entities/dialog'

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
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="absolute top-5 left-5">
        <Logo />
      </div>

      {isLoading ? <Spinner /> : null}

      {!isLoading && !isValid ? (
        <p className="text-center text-foreground text-xl">
          <FormattedMessage id="noDataAvailable" />
        </p>
      ) : null}

      {!isLoading && isValid ? (
        <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
          <form className="flex flex-col h-full justify-between gap-y-4" onSubmit={handleSubmit(onSubmit)}>
            <h2>
              <FormattedMessage id="resetPassword" />
            </h2>

            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="password">
                  <FormattedMessage id="password" />
                </Label>
                <Input
                  {...register('password')}
                  error={!!errors.password}
                  errorHelper={<FormattedMessage id={errors.password?.message} />}
                  id="password"
                  required
                  type="password"
                />
              </div>
              <div className="text-center text-foreground/40 text-sm">
                Version <Version /> - <Copyright />
              </div>
            </div>

            <div className="flex justify-between mt-4">
              <Button onClick={() => navigate('/')} variant="outline">
                <FormattedMessage id="buttonCancel" />
              </Button>
              <Button disabled={isSubmitting} type="submit">
                <FormattedMessage id="reset" />
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

export default ResetPassword
