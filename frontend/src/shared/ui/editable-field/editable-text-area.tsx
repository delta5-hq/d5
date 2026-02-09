import type { RefObject } from 'react'
import { cn } from '@shared/lib/utils'
import { useEditableField } from './use-editable-field'

export interface EditableTextAreaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export const EditableTextArea = ({ value, onChange, placeholder, className, autoFocus }: EditableTextAreaProps) => {
  const { editValue, inputRef, setEditValue, commitEdit, handleKeyDown } = useEditableField({
    value,
    onChange,
    autoFocus,
    commitOnEnter: false,
  })

  return (
    <textarea
      className={cn(
        'min-h-[80px] text-xs font-mono w-full rounded-md border border-input bg-background',
        'px-3 py-2 ring-offset-background placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      onBlur={commitEdit}
      onChange={e => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      ref={inputRef as RefObject<HTMLTextAreaElement>}
      value={editValue}
    />
  )
}
