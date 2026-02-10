import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormattedMessage } from 'react-intl'
import { GlassAuthDialog } from '@shared/ui/glass-auth-dialog'
import type { LoginDialogProps } from './types'
import { useEffect } from 'react'
import { useAuthContext } from '@entities/auth/model'
import { UsernameEmailField, PasswordField } from './components/auth-form-fields'
import { PrimarySubmitButton } from './components/primary-submit-button'
import { SecondaryTextLink } from './components/secondary-text-link'
import { ForgotPasswordLink, SignUpLink } from './components/navigation-links'

const LoginSchema = z.object({
  usernameOrEmail: z.string().nonempty('Username or email is required'),
  password: z.string().nonempty('Password is required'),
})

type LoginFormValues = z.infer<typeof LoginSchema>

export const LoginDialog = ({ open, onClose }: LoginDialogProps) => {
  const { login } = useAuthContext()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(LoginSchema),
  })

  useEffect(() => {
    if (!open) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = async (data: LoginFormValues) => {
    await login(data)
    onClose?.()
  }

  return (
    <GlassAuthDialog onClose={onClose} open={open} title={<FormattedMessage id="loginTitle" />}>
      <form className="flex flex-col gap-8" onSubmit={handleSubmit(onSubmit)}>
        <UsernameEmailField errors={errors} register={register} />
        <PasswordField errors={errors} register={register} />

        <div className="flex flex-col items-center gap-3">
          <ForgotPasswordLink onClose={onClose} />
          <SignUpLink onClose={onClose} />
        </div>

        <div className="flex flex-col gap-3">
          <PrimarySubmitButton isLoading={isSubmitting} testId="login-submit-button">
            <FormattedMessage id="loginTitle" />
          </PrimarySubmitButton>
          <SecondaryTextLink onClick={onClose}>
            <FormattedMessage id="buttonCancel" />
          </SecondaryTextLink>
        </div>
      </form>
    </GlassAuthDialog>
  )
}

export default LoginDialog
