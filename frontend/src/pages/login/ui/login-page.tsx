import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthPageLayout, useAuthContext } from '@entities/auth'
import { PasswordField, UsernameField } from './form-fields'
import { ForgotPasswordLink, RegisterLink } from './navigation-links'
import { SubmitButton } from './submit-button'
import { loginFormSchema, type LoginFormValues } from '../model/schema'

const LoginPage = () => {
  const navigate = useNavigate()
  const { login, isLoggedIn } = useAuthContext()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
  })

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/')
    }
  }, [isLoggedIn, navigate])

  const onSubmit = async (data: LoginFormValues) => {
    await login(data)
    navigate('/')
  }

  return (
    <AuthPageLayout maxWidth="md">
      <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
        <h1 className="text-2xl font-semibold text-card-foreground text-center">
          <FormattedMessage id="loginTitle" />
        </h1>

        <UsernameField errors={errors} register={register} />
        <PasswordField errors={errors} register={register} />

        <div className="flex flex-col gap-3">
          <ForgotPasswordLink />
          <RegisterLink />
        </div>

        <SubmitButton isSubmitting={isSubmitting} />
      </form>
    </AuthPageLayout>
  )
}

export default LoginPage
