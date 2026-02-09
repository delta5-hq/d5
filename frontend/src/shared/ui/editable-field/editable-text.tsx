import type { RefObject } from 'react'
import { Input } from '@shared/ui/input'
import { cn } from '@shared/lib/utils'
import { useEditableField } from './use-editable-field'

export interface EditableTextProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  readOnlyClassName?: string
  /** Native tooltip shown on the read-only span (hidden while editing) */
  title?: string
}

export const EditableText = ({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  readOnlyClassName,
  title,
}: EditableTextProps) => {
  const { isEditing, editValue, inputRef, startEditing, setEditValue, commitEdit, handleKeyDown } = useEditableField({
    value,
    onChange,
    autoFocus,
    commitOnEnter: true,
  })

  if (isEditing) {
    return (
      <Input
        className={cn('h-7 text-sm', className)}
        onBlur={commitEdit}
        onChange={e => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        ref={inputRef as RefObject<HTMLInputElement>}
        value={editValue}
      />
    )
  }

  return (
    <span
      className={cn(
        'cursor-text rounded px-1 py-0.5 hover:bg-muted',
        !value && 'text-muted-foreground italic',
        readOnlyClassName,
        className,
      )}
      onDoubleClick={startEditing}
      style={{ touchAction: 'manipulation' }}
      title={title}
    >
      {value || placeholder}
    </span>
  )
}
