import {
  isValidPassword,
  useAuthContext,
  validateUsernameOrEmail,
  AuthPageLayout,
  ThankYouDialog,
  LoginDialog,
  AuthFormTitle,
  AuthFormField,
} from '@entities/auth'
import { useDialog } from '@entities/dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { isEmail } from '@shared/lib/email'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { PasswordInput } from '@shared/ui/password-input'
import { PasswordStrengthIndicator } from '@shared/ui/password-strength-indicator'
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
    watch,
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  })

  const passwordValue = watch('password', '')

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
        <AuthFormTitle messageId="signupTitle" />

        <AuthFormField
          error={errors.username ? <FormattedMessage id={errors.username.message as string} /> : null}
          htmlFor="username"
          label={<FormattedMessage id="username" />}
        >
          <Input autoComplete="username" autoFocus id="username" type="text" {...register('username')} />
        </AuthFormField>

        <AuthFormField
          error={errors.mail ? <FormattedMessage id={errors.mail.message as string} /> : null}
          htmlFor="mail"
          label={<FormattedMessage id="email" />}
        >
          <Input autoComplete="mail" id="mail" type="email" {...register('mail')} />
        </AuthFormField>

        <AuthFormField
          error={errors.password ? <FormattedMessage id={errors.password.message as string} /> : null}
          htmlFor="password"
          label={<FormattedMessage id="password" />}
        >
          <PasswordInput autoComplete="current-password" id="password" {...register('password')} />
          <PasswordStrengthIndicator className="mt-2" password={passwordValue} />
        </AuthFormField>

        <Button className="w-full" disabled={isSubmitting} type="submit" variant="accent">
          <FormattedMessage id="createAccount" />
        </Button>

        <div className="flex flex-col gap-2">
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

export default Signup
