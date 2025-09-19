import { useForm } from 'react-hook-form'
import { z } from 'zod/v3'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@shared/ui/dialog'
import type { LoginDialogProps } from './types'
import { Input } from '@shared/ui/input'
import { Button } from '@shared/ui/button'
import { useState } from 'react'

const LoginSchema = z.object({
  usernameOrEmail: z.string().nonempty('Username or email is required'),
  password: z.string().nonempty('Password is required'),
})

type LoginFormValues = z.infer<typeof LoginSchema>

export const LoginDialog = ({ children, login }: LoginDialogProps) => {
  const [open, setOpen] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(LoginSchema),
  })

  const onSubmit = async (data: LoginFormValues) => {
    await login(data)
    setOpen(false)
  }

  return (
    <Dialog onOpenChange={() => setOpen(prev => !prev)} open={open}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="max-w-md w-full p-6">
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage id="loginTitle" />
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>

        <form className="flex flex-col gap-4 mt-4" onSubmit={handleSubmit(onSubmit)}>
          {/* Username / Email */}
          <div className="flex flex-col">
            <Input
              {...register('usernameOrEmail')}
              autoFocus
              className="border rounded px-3 py-2"
              placeholder="Username or Email"
              type="text"
            />
            {errors.usernameOrEmail ? (
              <span className="text-red-500 text-sm mt-1">{errors.usernameOrEmail.message}</span>
            ) : null}
          </div>

          {/* Password */}
          <div className="flex flex-col">
            <Input
              {...register('password')}
              className="border rounded px-3 py-2"
              placeholder="Password"
              type="password"
            />
            {errors.password ? <span className="text-red-500 text-sm mt-1">{errors.password.message}</span> : null}
          </div>

          {/* Links */}
          <div className="flex flex-col items-center gap-2 text-sm mt-2">
            <span className="cursor-pointer hover:underline hover:text-link-hover text-link">
              <Link to="/forgot-password">
                <FormattedMessage id="loginForgotPassword" />
              </Link>
            </span>

            <div className="flex flex-row nowrap gap-x-2">
              <span className="text-muted-foreground">
                <FormattedMessage id="notRegistered" />
              </span>
              <span className="cursor-pointer hover:underline hover:text-link-hover text-link">
                <Link to="/register">
                  <FormattedMessage id="loginSignUp" />
                </Link>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <Button
              className="px-4 py-2 rounded border"
              onClick={() => setOpen(false)}
              type="button"
              variant="secondary"
            >
              <FormattedMessage id="buttonCancel" />
            </Button>
            <Button
              className="px-4 py-2 rounded text-white disabled:opacity-50"
              disabled={isSubmitting}
              type="submit"
              variant="default"
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
