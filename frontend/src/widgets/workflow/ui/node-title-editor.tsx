import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { Input } from '@shared/ui/input'
import { cn } from '@shared/lib/utils'
import { useIntl } from 'react-intl'

interface NodeTitleEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export const NodeTitleEditor = ({ value, onChange, placeholder, className, autoFocus }: NodeTitleEditorProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const { formatMessage } = useIntl()

  const resolvedPlaceholder = placeholder ?? formatMessage({ id: 'workflowTree.node.untitled' })

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    if (autoFocus) {
      setIsEditing(true)
    }
  }, [autoFocus])

  const commitEdit = useCallback(() => {
    setIsEditing(false)
    if (editValue !== value) {
      onChange(editValue)
    }
  }, [editValue, value, onChange])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditValue(value)
  }, [value])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitEdit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelEdit()
      }
    },
    [commitEdit, cancelEdit],
  )

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true)
  }, [])

  if (isEditing) {
    return (
      <Input
        className={cn('h-7 text-sm', className)}
        onBlur={commitEdit}
        onChange={e => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={resolvedPlaceholder}
        ref={inputRef}
        value={editValue}
      />
    )
  }

  return (
    <span
      className={cn(
        'cursor-text rounded px-1 py-0.5 hover:bg-muted',
        !value && 'text-muted-foreground italic',
        className,
      )}
      onDoubleClick={handleDoubleClick}
      title={formatMessage({ id: 'workflowTree.node.editHint' })}
    >
      {value || resolvedPlaceholder}
    </span>
  )
}
