import { useState, useCallback, useEffect, useRef } from 'react'
import { safeLocalStorage } from '@shared/lib/storage'

export interface UseFieldDraftOptions {
  storageKey: string
  committedValue: string
  onChange: (value: string) => void
}

export interface UseFieldDraftResult {
  draft: string
  isDirty: boolean
  setDraft: (value: string) => void
  commit: () => void
  discard: () => void
}

export function useFieldDraft({ storageKey, committedValue, onChange }: UseFieldDraftOptions): UseFieldDraftResult {
  const committedRef = useRef(committedValue)
  committedRef.current = committedValue

  const [draft, setDraftState] = useState<string>(() => {
    const stored = safeLocalStorage.getItem(storageKey)
    return stored !== null && stored !== '' ? stored : committedValue
  })

  useEffect(() => {
    const stored = safeLocalStorage.getItem(storageKey)
    if (stored !== null && stored !== '') {
      setDraftState(stored)
    } else {
      setDraftState(committedValue)
    }
  }, [storageKey, committedValue])

  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value)
      if (value !== committedRef.current) {
        safeLocalStorage.setItem(storageKey, value)
      } else {
        safeLocalStorage.removeItem(storageKey)
      }
    },
    [storageKey],
  )

  const commit = useCallback(() => {
    const current = draft
    safeLocalStorage.removeItem(storageKey)
    if (current !== committedRef.current) {
      onChange(current)
      setDraftState(committedRef.current)
    }
  }, [draft, storageKey, onChange])

  const discard = useCallback(() => {
    safeLocalStorage.removeItem(storageKey)
    setDraftState(committedRef.current)
  }, [storageKey])

  const isDirty = draft !== committedValue

  return { draft, isDirty, setDraft, commit, discard }
}
