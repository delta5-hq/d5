import { useCallback, useRef } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any

/**
 * Stable-identity callback that always invokes the latest closure.
 * Equivalent to the proposed React `useEvent` — ref swap on every render,
 * memoized wrapper never changes.
 */
export function useStableCallback<T extends AnyFunction>(callback: T): T {
  const ref = useRef<T>(callback)
  ref.current = callback
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T
}
