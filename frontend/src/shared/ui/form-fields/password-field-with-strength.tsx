import type { UseFormRegister, FieldErrors, FieldValues, Path } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { Label } from '@shared/ui/label'
import { PasswordInput } from '@shared/ui/password-input'
import { PasswordStrengthIndicator } from '@shared/ui/password-strength-indicator'

interface PasswordFieldWithStrengthProps<T extends FieldValues> {
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  passwordValue: string
  fieldName?: Path<T>
  autoFocus?: boolean
}

export const PasswordFieldWithStrength = <T extends FieldValues>({
  register,
  errors,
  passwordValue,
  fieldName = 'password' as Path<T>,
  autoFocus = false,
}: PasswordFieldWithStrengthProps<T>) => (
  <div className="flex flex-col gap-2">
    <Label className="text-sm font-medium" htmlFor={fieldName}>
      <FormattedMessage id="password" />
    </Label>
    <PasswordInput
      {...register(fieldName)}
      autoComplete="current-password"
      autoFocus={autoFocus}
      className="h-12 text-base"
      id={fieldName}
    />
    {errors[fieldName] ? (
      <span className="text-destructive text-sm">
        <FormattedMessage id={errors[fieldName].message as string} />
      </span>
    ) : null}
    <PasswordStrengthIndicator className="mt-2" password={passwordValue} />
  </div>
)
