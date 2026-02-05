import { type ReactNode, useEffect } from 'react'
import { genieStateStore } from '@shared/lib/genie-state-store'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const ProgressStreamProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    genieStateStore.connectToProgressStream(API_BASE_URL)

    return () => {
      genieStateStore.disconnectFromProgressStream()
    }
  }, [])

  return children
}
