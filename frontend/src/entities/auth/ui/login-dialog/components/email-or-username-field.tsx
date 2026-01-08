import { Label } from '@shared/ui/label'
import { Input } from '@shared/ui/input'
import type { UseFormRegister, FieldErrors, FieldError, Path } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'

interface EmailOrUsernameFieldProps<T extends Record<string, any>> {
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  fieldName?: Path<T>
  autoFocus?: boolean
  testId?: string
}

export const EmailOrUsernameField = <T extends Record<string, any>>({
  register,
  errors,
  fieldName = 'usernameOrEmail' as Path<T>,
  autoFocus = false,
  testId,
}: EmailOrUsernameFieldProps<T>) => {
  const error = errors[fieldName] as FieldError | undefined

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium" htmlFor={String(fieldName)}>
        <FormattedMessage id="usernameOrEmail" />
      </Label>
      <Input
        {...register(fieldName)}
        autoComplete="username"
        autoFocus={autoFocus}
        className="h-12 text-base"
        data-testid={testId}
        id={String(fieldName)}
        placeholder="Username or Email"
        type="text"
      />
      {error?.message ? <span className="text-destructive text-sm">{error.message}</span> : null}
    </div>
  )
}
