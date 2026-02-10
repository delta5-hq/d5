import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthPageLayout, useAuthContext, AuthFormTitle } from '@entities/auth'
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
        <AuthFormTitle messageId="loginTitle" />

        <UsernameField errors={errors} register={register} />
        <PasswordField errors={errors} register={register} />

        <SubmitButton isSubmitting={isSubmitting} />

        <div className="flex flex-col gap-3">
          <ForgotPasswordLink />
          <RegisterLink />
        </div>
      </form>
    </AuthPageLayout>
  )
}

export default LoginPage
