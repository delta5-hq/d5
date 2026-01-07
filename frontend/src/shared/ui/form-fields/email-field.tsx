import type { UseFormRegister, FieldErrors, FieldValues, Path } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { Label } from '@shared/ui/label'
import { Input } from '@shared/ui/input'

interface EmailFieldProps<T extends FieldValues> {
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  fieldName?: Path<T>
  autoFocus?: boolean
}

export const EmailField = <T extends FieldValues>({
  register,
  errors,
  fieldName = 'mail' as Path<T>,
  autoFocus = false,
}: EmailFieldProps<T>) => (
  <div className="flex flex-col gap-2">
    <Label className="text-sm font-medium" htmlFor={fieldName}>
      <FormattedMessage id="email" />
    </Label>
    <Input
      {...register(fieldName)}
      autoComplete="email"
      autoFocus={autoFocus}
      className="h-12 text-base"
      id={fieldName}
      type="email"
    />
    {errors[fieldName] ? (
      <span className="text-destructive text-sm">
        <FormattedMessage id={errors[fieldName].message as string} />
      </span>
    ) : null}
  </div>
)
