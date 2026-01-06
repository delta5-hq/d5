import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import type { LoginDialogProps } from './types'
import { Input } from '@shared/ui/input'
import { PasswordInput } from '@shared/ui/password-input'
import { Label } from '@shared/ui/label'
import { Button } from '@shared/ui/button'
import { useEffect } from 'react'
import { useAuthContext } from '@entities/auth/model'

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
    <Dialog
      onOpenChange={val => {
        if (!val) onClose?.()
      }}
      open={open}
    >
      <DialogContent className="max-w-md w-full p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            <FormattedMessage id="loginTitle" />
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
          {/* Username / Email */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium" htmlFor="usernameOrEmail">
              <FormattedMessage id="usernameOrEmail" />
            </Label>
            <Input
              {...register('usernameOrEmail')}
              autoComplete="username"
              className="border rounded px-3 py-2"
              data-testid="login-username-input"
              name="usernameOrEmail"
              placeholder="Username or Email"
              type="text"
            />
            {errors.usernameOrEmail ? (
              <span className="text-red-500 text-sm">{errors.usernameOrEmail.message}</span>
            ) : null}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium" htmlFor="password">
              <FormattedMessage id="password" />
            </Label>
            <PasswordInput
              {...register('password')}
              autoComplete="current-password"
              className="border rounded px-3 py-2"
              data-testid="login-password-input"
              name="password"
              placeholder="Password"
            />
            {errors.password ? <span className="text-red-500 text-sm">{errors.password.message}</span> : null}
          </div>

          {/* Links */}
          <div className="flex flex-col items-center gap-2 text-sm">
            <span className="cursor-pointer hover:underline hover:text-link-hover text-link">
              <Link onClick={() => onClose?.()} to="/forgot-password">
                <FormattedMessage id="loginForgotPassword" />
              </Link>
            </span>

            <div className="flex flex-row nowrap gap-x-2">
              <span className="text-muted-foreground">
                <FormattedMessage id="notRegistered" />
              </span>
              <span className="cursor-pointer hover:underline hover:text-link-hover text-link">
                <Link onClick={() => onClose?.()} to="/register">
                  <FormattedMessage id="loginSignUp" />
                </Link>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              className="px-4 py-2 rounded border"
              data-type="cancel"
              onClick={() => onClose?.()}
              type="button"
              variant="default"
            >
              <FormattedMessage id="buttonCancel" />
            </Button>
            <Button
              className="px-4 py-2 rounded text-white disabled:opacity-50"
              data-testid="login-submit-button"
              data-type="confirm-login"
              disabled={isSubmitting}
              type="submit"
              variant="accent"
            >
              <FormattedMessage id="loginTitle" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default LoginDialog
