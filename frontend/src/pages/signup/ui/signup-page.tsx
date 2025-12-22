import {
  isValidPassword,
  useAuthContext,
  validateUsernameOrEmail,
  AuthPageLayout,
  ThankYouDialog,
  LoginDialog,
} from '@entities/auth'
import { useDialog } from '@entities/dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { isEmail } from '@shared/lib/email'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import React, { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

const signupSchema = z.object({
  username: z
    .string()
    .min(1, { message: 'usernameRequired' })
    .refine(val => !val.includes('@'), {
      message: 'usernameCannotContainAtSymbol',
    })
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
    .min(7, { message: 'passwordMinLength' })
    .refine(val => isValidPassword(val), {
      message: 'invalidPassword',
    }),
})

type SignupForm = z.infer<typeof signupSchema>

const Signup: React.FC = () => {
  const navigate = useNavigate()
  const { isLoggedIn, signup } = useAuthContext()
  const [showThankYouDialog, setShowThankYouDialog] = useState(false)
  const { showDialog } = useDialog()

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/')
    }
  }, [isLoggedIn, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  })

  const onSignUp = useCallback(
    async (formData: SignupForm) => {
      await signup({
        ...formData,
        username: formData.username.trim(),
        mail: formData.mail.trim(),
      })
      setShowThankYouDialog(true)
    },
    [signup],
  )

  const onCloseThankYou = () => {
    setShowThankYouDialog(false)
    navigate('/')
  }

  return (
    <AuthPageLayout maxWidth="md">
      <ThankYouDialog onClose={onCloseThankYou} open={showThankYouDialog} />
      <form className="flex flex-col gap-6" noValidate onSubmit={handleSubmit(onSignUp)}>
        <h1 className="text-2xl font-semibold text-card-foreground text-center">
          <FormattedMessage id="signupTitle" />
        </h1>

        {/* Username */}
        <div>
          <Label className="block text-sm font-medium text-card-foreground" htmlFor="username">
            <FormattedMessage id="username" />
          </Label>
          <Input
            autoComplete="username"
            autoFocus
            id="username"
            type="text"
            {...register('username')}
            className={`block w-full rounded-md border ${errors.username ? 'border-destructive' : 'border-muted'} p-2`}
          />
          {errors.username ? (
            <p className="text-destructive text-sm">
              <FormattedMessage id={errors.username.message as string} />
            </p>
          ) : null}
        </div>

        {/* Email */}
        <div>
          <Label className="block text-sm font-medium text-card-foreground" htmlFor="mail">
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
          <Label className="block text-sm font-medium text-card-foreground" htmlFor="password">
            <FormattedMessage id="password" />
          </Label>
          <Input
            autoComplete="current-password"
            id="password"
            type="password"
            {...register('password')}
            className={`block w-full rounded-md border ${errors.password ? 'border-destructive' : 'border-muted'} p-2`}
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
            data-type="login"
            onClick={() => showDialog(LoginDialog)}
          >
            <FormattedMessage id="loginTitle" />
          </span>
        </div>

        <div className="flex justify-between">
          <Button className="px-4 py-2 rounded-md" onClick={() => navigate(-1)} type="button" variant="default">
            <FormattedMessage id="buttonCancel" />
          </Button>
          <Button
            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={isSubmitting}
            type="submit"
            variant="accent"
          >
            <FormattedMessage id="createAccount" />
          </Button>
        </div>
      </form>
    </AuthPageLayout>
  )
}

export default Signup
