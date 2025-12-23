import { useState, useRef, useEffect } from 'react'
import type { PublicShare } from '@shared/base-types'
import logger from '@shared/lib/logger'

interface UseVisibilityUpdateOptions {
  updateVisibility: (state: Partial<PublicShare>) => Promise<void>
  timeoutMs: number
}

interface UseVisibilityUpdateReturn {
  isPersisting: boolean
  updateWithTimeout: (state: Partial<PublicShare>) => Promise<void>
}

export const useVisibilityUpdate = ({ updateVisibility }: UseVisibilityUpdateOptions): UseVisibilityUpdateReturn => {
  const [isPersisting, setIsPersisting] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    },
    [],
  )

  const updateWithTimeout = async (newState: Partial<PublicShare>): Promise<void> => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (abortControllerRef.current) abortControllerRef.current.abort()

    setIsPersisting(true)
    abortControllerRef.current = new AbortController()
    const currentController = abortControllerRef.current

    return new Promise((resolve, reject) => {
      timeoutRef.current = setTimeout(async () => {
        if (currentController.signal.aborted) {
          resolve()
          return
        }

        try {
          await updateVisibility(newState)
          setIsPersisting(false)
          resolve()
        } catch (error) {
          logger.error('Visibility update failed', error)
          setIsPersisting(false)
          reject(error)
        }
      }, 300)
    })
  }

  return {
    isPersisting,
    updateWithTimeout,
  }
}
