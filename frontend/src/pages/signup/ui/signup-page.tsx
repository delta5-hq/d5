import React, { useCallback, useEffect, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v3'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth, validateUsernameOrEmail, isValidPassword, LoginDialog } from '@entities/auth'
import { useNavigate } from 'react-router-dom'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import AlertDialog from '@shared/ui/alert-dialog'
import { isEmail } from '@shared/lib/email'
import { Version } from '@shared/ui/version'
import { Copyright } from '@shared/ui/copyright'
import { Logo } from '@shared/ui/logo'
import { Label } from '@shared/ui/label'
import { useDialog } from '@entities/dialog'

const signupSchema = z.object({
  username: z
    .string()
    .min(1, { message: 'usernameRequired' })
    .refine(val => !validateUsernameOrEmail(val), {
      message: 'fieldHaveSpacesBetweenChars',
    }),
  mail: z
    .string()
    .min(1, { message: 'emailRequired' })
    .refine(val => isEmail(val), {
      message: 'invalidEmailAddress',
    }),
  password: z
    .string()
    .min(1, { message: 'passwordRequired' })
    .refine(val => isValidPassword(val), {
      message: 'invalidPassword',
    }),
})

type SignupForm = z.infer<typeof signupSchema>

const Signup: React.FC = () => {
  const navigate = useNavigate()
  const { isLoggedIn, signup, isSuccessSignup: isSuccess } = useAuth()
  const [showAlertDialog, setShowAlertDialog] = useState(false)
  const { showDialog } = useDialog()

  if (isLoggedIn) {
    navigate('/')
  }

  useEffect(() => {
    if (isSuccess) {
      setShowAlertDialog(true)
    }
  }, [isSuccess])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  })

  const onSignUp = useCallback(
    (formData: SignupForm) => {
      signup({
        ...formData,
        username: formData.username.trim(),
        mail: formData.mail.trim(),
      })
    },
    [signup],
  )

  const onClose = () => {
    navigate('/')
  }

  return (
    <div className="flex justify-center items-center h-screen relative bg-muted">
      <div className="absolute top-5 left-5">
        <Logo />
      </div>
      {showAlertDialog ? (
        <AlertDialog
          onClose={onClose}
          onConfirm={onClose}
          open
          title={<FormattedMessage id="signupDialogTitle" />}
          translationKey="signupDialogMessage"
        />
      ) : null}
      {!isSuccess ? (
        <div className="bg-white shadow-md rounded-xl p-6 w-full max-w-sm sm:max-w-md">
          <form className="flex flex-col gap-y-3" noValidate onSubmit={handleSubmit(onSignUp)}>
            <h2 className="text-xl font-semibold">
              <FormattedMessage id="signupTitle" />
            </h2>

            {/* Username */}
            <div>
              <Label className="block text-sm font-medium text-foreground" htmlFor="username">
                <FormattedMessage id="username" />
              </Label>
              <Input
                autoComplete="username"
                autoFocus
                id="username"
                type="text"
                {...register('username')}
                className={`block w-full rounded-md border ${
                  errors.username ? 'border-destructive' : 'border-muted'
                } p-2`}
              />
              {errors.username ? (
                <p className="text-destructive text-sm">
                  <FormattedMessage id={errors.username.message as string} />
                </p>
              ) : null}
            </div>

            {/* Email */}
            <div>
              <Label className="block text-sm font-medium text-foreground" htmlFor="mail">
                <FormattedMessage id="email" />
              </Label>
              <Input
                autoComplete="mail"
                id="mail"
                type="email"
                {...register('mail')}
                className={`block w-full rounded-md border ${errors.mail ? 'border-destructive' : 'border-muted'} p-2`}
              />
              {errors.mail ? (
                <p className="text-destructive text-sm">
                  <FormattedMessage id={errors.mail.message as string} />
                </p>
              ) : null}
            </div>

            {/* Password */}
            <div>
              <Label className="block text-sm font-medium text-foreground" htmlFor="password">
                <FormattedMessage id="password" />
              </Label>
              <Input
                autoComplete="current-password"
                id="password"
                type="password"
                {...register('password')}
                className={`block w-full rounded-md border ${
                  errors.password ? 'border-destructive' : 'border-muted'
                } p-2`}
              />
              {errors.password ? (
                <p className="text-destructive text-sm">
                  <FormattedMessage id={errors.password.message as string} />
                </p>
              ) : null}
            </div>

            {/* Already have account */}
            <div className="flex gap-x-2 justify-center text-center text-sm">
              <FormattedMessage id="alreadyExistAccount" />{' '}
              <span
                className="cursor-pointer hover:underline hover:text-link-hover text-link"
                onClick={() => showDialog(LoginDialog)}
              >
                <FormattedMessage id="loginTitle" />
              </span>
            </div>

            {/* Version */}
            <div className="text-center text-xs text-foreground/40">
              Version <Version /> - <Copyright />
            </div>

            <div className="flex justify-between">
              <Button className="px-4 py-2 rounded-md" onClick={() => navigate(-1)} type="button">
                <FormattedMessage id="buttonCancel" />
              </Button>
              <Button
                className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={isSubmitting}
                type="submit"
              >
                <FormattedMessage id="createAccount" />
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

export default Signup
