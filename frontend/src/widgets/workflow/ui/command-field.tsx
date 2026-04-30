import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { cn } from '@shared/lib/utils'
import { safeLocalStorage } from '@shared/lib/storage'
import { Popover, PopoverAnchor, PopoverContent } from '@shared/ui/popover'
import { getSupportedCommands, COMMAND_DESCRIPTIONS } from '@shared/lib/command-querytype-mapper'
import type { DynamicAlias } from '@shared/lib/command-querytype-mapper'
import { useAliases } from '@entities/aliases'

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

interface CommandSuggestion {
  command: string
  description: string
  badge: 'builtin' | 'mcp' | 'rpc'
}

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
  const { aliases } = useAliases()

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

  const [autocompleteOpen, setAutocompleteOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

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

  const allSuggestions = useMemo((): CommandSuggestion[] => {
    const builtins = getSupportedCommands().map(cmd => ({
      command: cmd,
      description: COMMAND_DESCRIPTIONS[cmd] || '',
      badge: 'builtin' as const,
    }))

    const dynamics = aliases.map(
      (alias: DynamicAlias): CommandSuggestion => ({
        command: alias.alias,
        description: alias.description || '',
        badge: alias.queryType?.startsWith('mcp:') ? 'mcp' : 'rpc',
      }),
    )

    return [...builtins, ...dynamics]
  }, [aliases])

  const shouldShowAutocomplete = useMemo((): boolean => {
    const lines = text.split('\n')
    const firstLine = lines[0] || ''

    if (!firstLine.startsWith('/')) return false

    const hasSpace = firstLine.includes(' ')
    if (hasSpace) return false

    return firstLine.length > 0
  }, [text])

  const filteredSuggestions = useMemo((): CommandSuggestion[] => {
    if (!shouldShowAutocomplete) return []

    const firstWord = text.split(/\s+/)[0] || ''
    const prefix = firstWord.toLowerCase()

    return allSuggestions.filter(s => s.command.toLowerCase().startsWith(prefix))
  }, [shouldShowAutocomplete, text, allSuggestions])

  useEffect(() => {
    if (filteredSuggestions.length > 0 && shouldShowAutocomplete) {
      setAutocompleteOpen(true)
      setSelectedIndex(0)
    } else {
      setAutocompleteOpen(false)
    }
  }, [filteredSuggestions, shouldShowAutocomplete])

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

  const selectSuggestion = useCallback(
    (suggestion: CommandSuggestion) => {
      const rest = text.replace(/^\/\S*/, '')
      const newText = `${suggestion.command} ${rest}`.trim() + ' '
      setText(newText)
      safeLocalStorage.setItem(storageKey, newText)
      setAutocompleteOpen(false)
      textareaRef.current?.focus()
    },
    [text, storageKey],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (autocompleteOpen && filteredSuggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setAutocompleteOpen(false)
          return
        }
        if ((e.key === 'Enter' || e.key === 'Tab') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault()
          selectSuggestion(filteredSuggestions[selectedIndex])
          return
        }
      }

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
    [commit, storageKey, autocompleteOpen, filteredSuggestions, selectedIndex, selectSuggestion],
  )

  return (
    <Popover onOpenChange={setAutocompleteOpen} open={autocompleteOpen}>
      <PopoverAnchor asChild>
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
          data-type="command-field"
          onBlur={() => commit()}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={textareaRef}
          value={text}
        />
      </PopoverAnchor>
      {autocompleteOpen && filteredSuggestions.length > 0 ? (
        <PopoverContent
          align="start"
          className="p-0 max-h-[300px] overflow-y-auto"
          onOpenAutoFocus={e => e.preventDefault()}
          onPointerDownOutside={e => e.preventDefault()}
          position="item-aligned"
          side="bottom"
          sideOffset={4}
        >
          <div className="py-1" data-type="autocomplete-suggestions" onPointerDown={e => e.stopPropagation()}>
            {filteredSuggestions.map((suggestion, idx) => (
              <button
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-accent cursor-pointer',
                  'flex items-center gap-2 border-none outline-none',
                  idx === selectedIndex && 'bg-accent',
                )}
                data-badge={suggestion.badge}
                data-command={suggestion.command}
                data-type="autocomplete-item"
                key={suggestion.command}
                onClick={() => selectSuggestion(suggestion)}
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setSelectedIndex(idx)}
                type="button"
              >
                <span className="font-mono font-semibold">{suggestion.command}</span>
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded',
                    suggestion.badge === 'mcp' && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
                    suggestion.badge === 'rpc' && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                    suggestion.badge === 'builtin' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                  )}
                  data-badge={suggestion.badge}
                >
                  {suggestion.badge}
                </span>
                {suggestion.description ? (
                  <span className="text-xs text-muted-foreground truncate flex-1">{suggestion.description}</span>
                ) : null}
              </button>
            ))}
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  )
}
