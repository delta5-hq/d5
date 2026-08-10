import type { RefObject } from 'react'
import { Textarea } from '@shared/ui/textarea'
import { cn } from '@shared/lib/utils'
import { useEditableField } from './use-editable-field'

export interface EditableTextAreaProps {
  value: string
  onChange: (value: string) => void
  displayValue?: string
  placeholder?: string
  className?: string
  editClassName?: string
  autoFocus?: boolean
  readOnlyClassName?: string
  title?: string
}

export const EditableTextArea = ({
  value,
  onChange,
  displayValue,
  placeholder,
  className,
  editClassName,
  autoFocus,
  readOnlyClassName,
  title,
}: EditableTextAreaProps) => {
  const { isEditing, editValue, inputRef, startEditing, setEditValue, commitEdit, handleKeyDown } = useEditableField({
    value,
    onChange,
    autoFocus,
    commitOnEnter: true,
  })

  if (isEditing) {
    return (
      <Textarea
        className={cn('min-h-24 resize-y text-sm leading-6', editClassName, className)}
        onBlur={commitEdit}
        onChange={e => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        ref={inputRef as RefObject<HTMLTextAreaElement>}
        value={editValue}
      />
    )
  }

  return (
    <span
      className={cn(
        'block cursor-text whitespace-pre-wrap rounded-md border border-transparent px-2 py-1 text-sm leading-6 transition-colors hover:border-border hover:bg-muted/70',
        !value && 'text-muted-foreground italic',
        readOnlyClassName,
        className,
      )}
      onDoubleClick={startEditing}
      style={{ touchAction: 'manipulation' }}
      title={title}
    >
      {(displayValue ?? value) || placeholder}
    </span>
  )
}
