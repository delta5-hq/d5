import type { UseFormRegister, FieldErrors, FieldValues, Path } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { Label } from '@shared/ui/label'
import { Input } from '@shared/ui/input'

interface UsernameFieldProps<T extends FieldValues> {
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  fieldName?: Path<T>
  autoFocus?: boolean
}

export const UsernameField = <T extends FieldValues>({
  register,
  errors,
  fieldName = 'username' as Path<T>,
  autoFocus = false,
}: UsernameFieldProps<T>) => (
  <div className="flex flex-col gap-2">
    <Label className="text-sm font-medium" htmlFor={fieldName}>
      <FormattedMessage id="username" />
    </Label>
    <Input
      {...register(fieldName)}
      autoComplete="username"
      autoFocus={autoFocus}
      className="h-12 text-base"
      id={fieldName}
      type="text"
    />
    {errors[fieldName] ? (
      <span className="text-destructive text-sm">
        <FormattedMessage id={errors[fieldName].message as string} />
      </span>
    ) : null}
  </div>
)
