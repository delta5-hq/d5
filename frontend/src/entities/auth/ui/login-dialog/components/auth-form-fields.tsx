import { Label } from '@shared/ui/label'
import { Input } from '@shared/ui/input'
import { PasswordInput } from '@shared/ui/password-input'
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'

interface LoginFormValues {
  usernameOrEmail: string
  password: string
}

interface AuthFormFieldsProps {
  register: UseFormRegister<LoginFormValues>
  errors: FieldErrors<LoginFormValues>
}

export const UsernameEmailField = ({ register, errors }: AuthFormFieldsProps) => (
  <div className="flex flex-col gap-2">
    <Label className="text-sm font-medium" htmlFor="usernameOrEmail">
      <FormattedMessage id="usernameOrEmail" />
    </Label>
    <Input
      {...register('usernameOrEmail')}
      autoComplete="username"
      autoFocus
      className="h-12 text-base"
      data-testid="login-username-input"
      id="usernameOrEmail"
      placeholder="Username or Email"
      type="text"
    />
    {errors.usernameOrEmail ? <span className="text-destructive text-sm">{errors.usernameOrEmail.message}</span> : null}
  </div>
)

export const PasswordField = ({ register, errors }: AuthFormFieldsProps) => (
  <div className="flex flex-col gap-2">
    <Label className="text-sm font-medium" htmlFor="password">
      <FormattedMessage id="password" />
    </Label>
    <PasswordInput
      {...register('password')}
      autoComplete="current-password"
      className="h-12 text-base"
      data-testid="login-password-input"
      id="password"
      placeholder="Password"
    />
    {errors.password ? <span className="text-destructive text-sm">{errors.password.message}</span> : null}
  </div>
)
