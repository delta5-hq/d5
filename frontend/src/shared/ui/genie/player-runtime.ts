import playerRuntimeUrl from '@shared/assets/genie/base-genie.player.js?url'
import type { TgsPlayerInstance } from './types'

declare global {
  interface Window {
    TgsPlayer?: new (data: unknown, containerId: string) => TgsPlayerInstance
  }
}

let playerRuntimePromise: Promise<boolean> | undefined

async function injectPlayerRuntime(): Promise<boolean> {
  const response = await fetch(playerRuntimeUrl)
  if (!response.ok) return false

  const script = document.createElement('script')
  script.textContent = await response.text()
  document.head.appendChild(script)

  return Boolean(window.TgsPlayer)
}

export async function loadPlayerRuntime(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (window.TgsPlayer) return true

  playerRuntimePromise ??= injectPlayerRuntime().catch(() => false)
  const loaded = await playerRuntimePromise

  if (!loaded) playerRuntimePromise = undefined
  return loaded
}
