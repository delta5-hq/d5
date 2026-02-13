import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type RefObject } from 'react'

export interface UseEditableFieldOptions {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  commitOnEnter?: boolean
}

export interface UseEditableFieldReturn {
  isEditing: boolean
  editValue: string
  inputRef: RefObject<HTMLElement | null>
  startEditing: () => void
  setEditValue: (value: string) => void
  commitEdit: () => void
  cancelEdit: () => void
  handleKeyDown: (e: KeyboardEvent) => void
}

export function useEditableField({
  value,
  onChange,
  autoFocus = false,
  commitOnEnter = true,
}: UseEditableFieldOptions): UseEditableFieldReturn {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValueState] = useState(value)
  const inputRef = useRef<HTMLElement | null>(null)

  const isEditingRef = useRef(isEditing)
  const editValueRef = useRef(editValue)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)

  isEditingRef.current = isEditing
  editValueRef.current = editValue
  valueRef.current = value
  onChangeRef.current = onChange

  const setEditValue = useCallback((v: string) => {
    editValueRef.current = v
    setEditValueState(v)
  }, [])

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value)
    }
  }, [value, isEditing, setEditValue])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if ('select' in inputRef.current && typeof inputRef.current.select === 'function') {
        ;(inputRef.current as HTMLInputElement).select()
      }
    }
  }, [isEditing])

  useEffect(() => {
    if (autoFocus) {
      setIsEditing(true)
    }
  }, [autoFocus])

  useEffect(
    () => () => {
      if (isEditingRef.current && editValueRef.current !== valueRef.current) {
        onChangeRef.current(editValueRef.current)
      }
    },
    [],
  )

  const commitEdit = useCallback(() => {
    if (editValueRef.current !== valueRef.current) {
      onChangeRef.current(editValueRef.current)
    }
    setIsEditing(false)
  }, [])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditValue(valueRef.current)
  }, [setEditValue])

  const startEditing = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (commitOnEnter && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commitEdit()
      } else if (!commitOnEnter && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        commitEdit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelEdit()
      }
    },
    [commitOnEnter, commitEdit, cancelEdit],
  )

  return {
    isEditing,
    editValue,
    inputRef,
    startEditing,
    setEditValue,
    commitEdit,
    cancelEdit,
    handleKeyDown,
  }
}
