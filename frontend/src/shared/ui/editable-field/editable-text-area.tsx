import type { RefObject } from 'react'
import { cn } from '@shared/lib/utils'
import { useEditableField } from './use-editable-field'

export interface EditableTextAreaProps {
  value: string
  onChange: (value: string) => void
  onCtrlEnter?: () => void
  onEnterCommit?: () => void
  onEscape?: () => void
  onInput?: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export const EditableTextArea = ({
  value,
  onChange,
  onCtrlEnter,
  onEnterCommit,
  onEscape,
  onInput,
  placeholder,
  className,
  autoFocus,
}: EditableTextAreaProps) => {
  const { editValue, inputRef, handleInput, commitEdit, handleKeyDown } = useEditableField({
    value,
    onChange,
    autoFocus,
    commitOnEnter: false,
    onCtrlEnter,
    onEnterCommit,
    onEscape,
    onInput,
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
      onChange={e => handleInput(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      ref={inputRef as RefObject<HTMLTextAreaElement>}
      value={editValue}
    />
  )
}
