import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { FormattedMessage } from 'react-intl'
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import type { LoginFormValues } from '../model/schema'

interface LoginFormFieldsProps {
  register: UseFormRegister<LoginFormValues>
  errors: FieldErrors<LoginFormValues>
}

export const UsernameField = ({ register, errors }: LoginFormFieldsProps) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor="usernameOrEmail">
      <FormattedMessage id="usernameOrEmail" />
    </Label>
    <Input
      {...register('usernameOrEmail')}
      autoComplete="username"
      autoFocus
      className="border rounded-md px-3 py-2"
      id="usernameOrEmail"
      placeholder="Username or Email"
      type="text"
    />
    {errors.usernameOrEmail ? <span className="text-destructive text-sm">{errors.usernameOrEmail.message}</span> : null}
  </div>
)

export const PasswordField = ({ register, errors }: LoginFormFieldsProps) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor="password">
      <FormattedMessage id="password" />
    </Label>
    <Input
      {...register('password')}
      autoComplete="current-password"
      className="border rounded-md px-3 py-2"
      id="password"
      placeholder="Password"
      type="password"
    />
    {errors.password ? <span className="text-destructive text-sm">{errors.password.message}</span> : null}
  </div>
)
