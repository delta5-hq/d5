import { Input } from '@shared/ui/input'
import { PasswordInput } from '@shared/ui/password-input'
import { FormattedMessage } from 'react-intl'
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import type { LoginFormValues } from '../model/schema'
import { AuthFormField } from '@entities/auth'

interface LoginFormFieldsProps {
  register: UseFormRegister<LoginFormValues>
  errors: FieldErrors<LoginFormValues>
}

export const UsernameField = ({ register, errors }: LoginFormFieldsProps) => (
  <AuthFormField
    error={errors.usernameOrEmail ? <FormattedMessage id={errors.usernameOrEmail.message} /> : null}
    htmlFor="usernameOrEmail"
    label={<FormattedMessage id="usernameOrEmail" />}
  >
    <Input {...register('usernameOrEmail')} autoComplete="username" autoFocus id="usernameOrEmail" type="text" />
  </AuthFormField>
)

export const PasswordField = ({ register, errors }: LoginFormFieldsProps) => (
  <AuthFormField
    error={errors.password ? <FormattedMessage id={errors.password.message} /> : null}
    htmlFor="password"
    label={<FormattedMessage id="password" />}
  >
    <PasswordInput {...register('password')} autoComplete="current-password" id="password" />
  </AuthFormField>
)
