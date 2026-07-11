import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@shared/lib/base-api'

export function useSessionBootstrap(): boolean {
  const [isBootstrapped, setIsBootstrapped] = useState(false)
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    apiFetch('/auth/refresh', { method: 'POST' })
      .catch(() => {})
      .finally(() => setIsBootstrapped(true))
  }, [])

  return isBootstrapped
}
