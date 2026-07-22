import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { Label } from '@shared/ui/label'

interface FormFieldLabelProps {
  htmlFor: string
  labelId: string
  required?: boolean
}

export const FormFieldLabel: React.FC<FormFieldLabelProps> = ({ htmlFor, labelId, required = false }) => (
  <Label htmlFor={htmlFor}>
    <FormattedMessage id={labelId} />
    {required ? (
      <>
        {' '}
        <span aria-label="required" className="text-destructive">
          *
        </span>
      </>
    ) : null}
  </Label>
)
