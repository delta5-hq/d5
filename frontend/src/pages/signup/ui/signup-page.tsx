import {
  isValidPassword,
  useAuthContext,
  validateUsernameOrEmail,
  AuthPageLayout,
  ThankYouDialog,
} from '@entities/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { isEmail } from '@shared/lib/email'
import { UsernameField, EmailField, PasswordFieldWithStrength } from '@shared/ui/form-fields'
import { LoginLink } from '@entities/auth/ui/navigation-links'
import { PrimarySubmitButton } from '@entities/auth/ui/login-dialog/components/primary-submit-button'
import { SecondaryTextLink } from '@entities/auth/ui/login-dialog/components/secondary-text-link'
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
      <form className="flex flex-col gap-8" noValidate onSubmit={handleSubmit(onSignUp)}>
        <div className="text-center">
          <h1 className="text-2xl font-semibold">
            <FormattedMessage id="signupTitle" />
          </h1>
        </div>

        <UsernameField autoFocus errors={errors} register={register} />

        <EmailField errors={errors} register={register} />

        <PasswordFieldWithStrength errors={errors} passwordValue={passwordValue} register={register} />

        <div className="flex flex-col gap-3">
          <PrimarySubmitButton isLoading={isSubmitting} testId="signup-submit-button">
            <FormattedMessage id="createAccount" />
          </PrimarySubmitButton>

          <LoginLink />

          <SecondaryTextLink onClick={() => navigate('/')}>
            <FormattedMessage id="buttonCancel" />
          </SecondaryTextLink>
        </div>
      </form>
    </AuthPageLayout>
  )
}

export default Signup
