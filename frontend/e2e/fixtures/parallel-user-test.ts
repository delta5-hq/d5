import { test as base, type Browser } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

import { authenticateViaAPI, type AuthCredentials } from '../helpers/api-auth'
import { e2eEnv } from '../utils/e2e-env-vars'

export const MAX_AUTH_RETRIES = 8
const AUTH_RETRY_BASE_DELAY_MS = 300
const AUTH_MAX_DELAY_MS = 8000

const adminCredentials = (): AuthCredentials => ({
  usernameOrEmail: e2eEnv.E2E_ADMIN_USER,
  password: e2eEnv.E2E_ADMIN_PASS,
})

const subscriberCredentials = (): AuthCredentials => ({
  usernameOrEmail: e2eEnv.E2E_SUBSCRIBER_USER || 'subscriber',
  password: e2eEnv.E2E_SUBSCRIBER_PASS || 'P@ssw0rd!',
})

const credentialsForWorker = (parallelIndex: number): AuthCredentials =>
  parallelIndex === 0 ? adminCredentials() : subscriberCredentials()

const exponentialDelay = (attempt: number): number => {
  const base = AUTH_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
  const jitter = Math.random() * AUTH_RETRY_BASE_DELAY_MS
  return Math.min(base + jitter, AUTH_MAX_DELAY_MS)
}

const SESSION_VERIFY_PATH = '/api/v2/integration'

async function verifySession(baseURL: string | undefined, filePath: string, browser: Browser): Promise<boolean> {
  const context = await browser.newContext({ storageState: filePath, baseURL })
  try {
    const response = await context.request.get(SESSION_VERIFY_PATH)
    return response.ok()
  } finally {
    await context.close()
  }
}

export async function establishWorkerSession(
  browser: Browser,
  baseURL: string | undefined,
  credentials: AuthCredentials,
  filePath: string,
  parallelIndex: number = 0,
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

      const sessionValid = await verifySession(baseURL, filePath, browser)
      if (sessionValid) return
    } else {
      await context.close()
    }

    if (attempt < MAX_AUTH_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, exponentialDelay(attempt)))
    } else {
      throw new Error(`Worker auth failed after ${MAX_AUTH_RETRIES} attempts at ${result.phase ?? 'verify'}: ${result.error ?? 'session verification failed'}`)
    }
  }
}

function workerScopedAuthTest(filePrefix: string, resolveCredentials: (parallelIndex: number) => AuthCredentials) {
  return base.extend<{}, { workerStorageState: string }>({
    storageState: ({ workerStorageState }, use) => use(workerStorageState),
    workerStorageState: [
      async ({ browser }, use, workerInfo) => {
        const dir = path.resolve(process.cwd(), 'playwright/.auth')
        fs.mkdirSync(dir, { recursive: true })

        const credentials = resolveCredentials(workerInfo.parallelIndex)
        const fileName = path.join(
          dir,
          `${filePrefix}.${workerInfo.project.name}.${workerInfo.parallelIndex}.json`,
        )

        await establishWorkerSession(
          browser,
          workerInfo.project.use.baseURL,
          credentials,
          fileName,
          workerInfo.parallelIndex,
        )

        await use(fileName)
      },
      { scope: 'worker' },
    ],
  })
}

export function createParallelUserTest(filePrefix: string) {
  return workerScopedAuthTest(filePrefix, credentialsForWorker)
}

export function createAdminTest(filePrefix: string) {
  return workerScopedAuthTest(filePrefix, () => adminCredentials())
}
