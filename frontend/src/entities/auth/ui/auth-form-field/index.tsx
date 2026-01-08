import type { ReactNode } from 'react'
import { Label } from '@shared/ui/label'

interface AuthFormFieldProps {
  children: ReactNode
  error?: ReactNode
  htmlFor: string
  label: ReactNode
}

export const AuthFormField = ({ children, error, htmlFor, label }: AuthFormFieldProps) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
    {error ? <span className="text-destructive text-sm">{error}</span> : null}
  </div>
)
