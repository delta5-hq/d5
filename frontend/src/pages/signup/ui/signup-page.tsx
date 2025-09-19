import React, { useCallback, useEffect, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v3'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth, validateUsernameOrEmail, isValidPassword } from '@entities/auth'
import { LoginButton } from '@widgets/app-layout/ui/header'
import { useNavigate } from 'react-router-dom'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import AlertDialog from '@shared/ui/alert-dialog'
import { isEmail } from '@shared/lib/email'
import { Version } from '@shared/ui/version'
import { Copyright } from '@shared/ui/copyright'
import { Logo } from '@shared/ui/logo'

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
  const { isLoggedIn, login, signup, isSuccessSignup: isSuccess } = useAuth()
  const [showAlertDialog, setShowAlertDialog] = useState(false)

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
    <div className="flex justify-center items-center h-screen relative bg-gray-50">
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
          <form noValidate onSubmit={handleSubmit(onSignUp)}>
            <h2 className="text-xl font-semibold mb-4">
              <FormattedMessage id="signupTitle" />
            </h2>

            {/* Username */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700" htmlFor="username">
                <FormattedMessage id="username" />
              </label>
              <Input
                autoComplete="username"
                autoFocus
                id="username"
                type="text"
                {...register('username')}
                className={`mt-1 block w-full rounded-md border ${
                  errors.username ? 'border-red-500' : 'border-gray-300'
                } p-2`}
              />
              {errors.username ? (
                <p className="text-red-500 text-sm mt-1">
                  <FormattedMessage id={errors.username.message as string} />
                </p>
              ) : null}
            </div>

            {/* Email */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700" htmlFor="mail">
                <FormattedMessage id="email" />
              </label>
              <Input
                autoComplete="mail"
                id="mail"
                type="email"
                {...register('mail')}
                className={`mt-1 block w-full rounded-md border ${
                  errors.mail ? 'border-red-500' : 'border-gray-300'
                } p-2`}
              />
              {errors.mail ? (
                <p className="text-red-500 text-sm mt-1">
                  <FormattedMessage id={errors.mail.message as string} />
                </p>
              ) : null}
            </div>

            {/* Password */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700" htmlFor="password">
                <FormattedMessage id="password" />
              </label>
              <Input
                autoComplete="current-password"
                id="password"
                type="password"
                {...register('password')}
                className={`mt-1 block w-full rounded-md border ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                } p-2`}
              />
              {errors.password ? (
                <p className="text-red-500 text-sm mt-1">
                  <FormattedMessage id={errors.password.message as string} />
                </p>
              ) : null}
            </div>

            {/* Already have account */}
            <div className="mt-4 text-center text-sm">
              <FormattedMessage id="alreadyExistAccount" /> <LoginButton login={login} />
            </div>

            {/* Version */}
            <div className="mt-6 text-center text-xs text-gray-500">
              Version <Version /> - <Copyright />
            </div>

            <div className="mt-6 flex justify-between">
              <Button
                className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800"
                onClick={() => navigate(-1)}
                type="button"
              >
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
