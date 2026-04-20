import { type ReactNode, useEffect } from 'react'
import { genieStateStore } from '@shared/lib/genie-state-store'

export const ProgressStreamProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    const baseUrl = window.location.origin
    genieStateStore.connectToProgressStream(baseUrl)

    return () => {
      genieStateStore.disconnectFromProgressStream()
    }
  }, [])

  return children
}
