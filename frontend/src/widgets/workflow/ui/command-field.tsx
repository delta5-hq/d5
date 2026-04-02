import { useState, useEffect, useRef, useCallback } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { cn } from '@shared/lib/utils'
import { safeLocalStorage } from '@shared/lib/storage'

interface CommandFieldProps {
  nodeId: string
  value: string
  onChange: (value: string) => void
  onEnter?: (committedValue: string) => void
  onCtrlEnter?: (committedValue: string) => void
  onShiftCtrlEnter?: (committedValue: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

const buildStorageKey = (nodeId: string) => `workflow:node:${nodeId}:command`
const IDLE_COMMIT_MS = 3000

export const CommandField = ({
  nodeId,
  value,
  onChange,
  onEnter,
  onCtrlEnter,
  onShiftCtrlEnter,
  placeholder,
  className,
  autoFocus,
}: CommandFieldProps) => {
  const storageKey = buildStorageKey(nodeId)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const valueRef = useRef(value)
  const textRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onEnterRef = useRef(onEnter)
  const onCtrlEnterRef = useRef(onCtrlEnter)
  const onShiftCtrlEnterRef = useRef(onShiftCtrlEnter)
  const commitRef = useRef<() => string>(() => textRef.current)
  onChangeRef.current = onChange
  onEnterRef.current = onEnter
  onCtrlEnterRef.current = onCtrlEnter
  onShiftCtrlEnterRef.current = onShiftCtrlEnter

  const [text, setText] = useState<string>(() => {
    const stored = safeLocalStorage.getItem(storageKey)
    return stored !== null ? stored : value
  })
  textRef.current = text

  useEffect(() => {
    valueRef.current = value
    const stored = safeLocalStorage.getItem(storageKey)
    setText(stored !== null ? stored : value)
  }, [storageKey, value])

  const commit = useCallback((): string => {
    const current = textRef.current
    const committed = valueRef.current
    safeLocalStorage.removeItem(storageKey)
    if (current !== committed) {
      valueRef.current = current
      onChangeRef.current(current)
    }
    return current
  }, [storageKey])
  commitRef.current = commit

  useEffect(() => () => void commitRef.current(), [])

  useEffect(() => {
    if (text === value) return
    const timer = setTimeout(commit, IDLE_COMMIT_MS)
    return () => clearTimeout(timer)
  }, [text, value, commit])

  const isDirty = text !== value

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value
      setText(v)
      if (v !== valueRef.current) {
        safeLocalStorage.setItem(storageKey, v)
      } else {
        safeLocalStorage.removeItem(storageKey)
      }
    },
    [storageKey],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey
      if (e.key === 'Enter' && isCtrlOrMeta && e.shiftKey) {
        e.preventDefault()
        const v = commit()
        onShiftCtrlEnterRef.current?.(v)
      } else if (e.key === 'Enter' && isCtrlOrMeta && !e.shiftKey) {
        e.preventDefault()
        const v = commit()
        onCtrlEnterRef.current?.(v)
      } else if (e.key === 'Enter' && !e.shiftKey && !isCtrlOrMeta) {
        if (!onEnterRef.current) return
        e.preventDefault()
        const v = commit()
        textareaRef.current?.blur()
        onEnterRef.current(v)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        safeLocalStorage.removeItem(storageKey)
        setText(valueRef.current)
      }
    },
    [commit, storageKey],
  )

  return (
    <textarea
      autoFocus={autoFocus}
      className={cn(
        'min-h-[80px] text-xs font-mono w-full rounded-md border border-input bg-background',
        'px-3 py-2 ring-offset-background placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        isDirty && 'border-amber-400 focus-visible:ring-amber-400',
        className,
      )}
      onBlur={() => commit()}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      ref={textareaRef}
      value={text}
    />
  )
}
