import type { Browser } from '@playwright/test'

import { authenticateViaAPI, type AuthCredentials } from '../helpers/api-auth'

export const MAX_AUTH_RETRIES = 8
export const AUTH_RETRY_BASE_DELAY_MS = 300
export const AUTH_MAX_DELAY_MS = 8000

export function exponentialDelay(attempt: number): number {
  const base = AUTH_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
  const jitter = Math.random() * AUTH_RETRY_BASE_DELAY_MS
  return Math.min(base + jitter, AUTH_MAX_DELAY_MS)
}

export async function establishWorkerSession(
  browser: Browser,
  baseURL: string | undefined,
  credentials: AuthCredentials,
  filePath: string,
  parallelIndex: number = 0,
  retryDelay: (attempt: number) => number = exponentialDelay,
): Promise<void> {
  if (parallelIndex > 0) {
    await new Promise(resolve => setTimeout(resolve, parallelIndex * 500))
  }

  for (let attempt = 1; attempt <= MAX_AUTH_RETRIES; attempt++) {
    const context = await browser.newContext({ storageState: undefined, baseURL })
    const result = await authenticateViaAPI(context.request, credentials)

    if (result.ok) {
      await context.storageState({ path: filePath })
      await context.close()
      return
    }

    await context.close()

    if (attempt < MAX_AUTH_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, retryDelay(attempt)))
    } else {
      throw new Error(
        `Worker auth failed after ${MAX_AUTH_RETRIES} attempts at ${result.phase ?? 'login'}: ${result.error ?? 'authentication failed'}`,
      )
    }
  }
}
