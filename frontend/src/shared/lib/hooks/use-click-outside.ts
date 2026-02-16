import { useEffect } from 'react'
import { useStableCallback } from './use-stable-callback'

export interface UseClickOutsideOptions {
  ref: { readonly current: HTMLElement | null }
  onClickOutside: (event: PointerEvent) => void
  enabled?: boolean
}

export function useClickOutside({ ref, onClickOutside, enabled = true }: UseClickOutsideOptions): void {
  const stableOnClickOutside = useStableCallback(onClickOutside)

  useEffect(() => {
    if (!enabled) return

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return

      const element = ref.current
      if (!element) return

      const target = event.target as Node | null
      if (!target) return

      if (!element.contains(target)) {
        stableOnClickOutside(event)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [ref, stableOnClickOutside, enabled])
}
