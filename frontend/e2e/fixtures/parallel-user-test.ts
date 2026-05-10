import { test as base, type Browser } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

import { authenticateViaAPI, type AuthCredentials } from '../helpers/api-auth'
import { e2eEnv } from '../utils/e2e-env-vars'

export const MAX_AUTH_RETRIES = 3
const AUTH_RETRY_BASE_DELAY_MS = 500

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

export async function establishWorkerSession(
  browser: Browser,
  baseURL: string | undefined,
  credentials: AuthCredentials,
  filePath: string,
): Promise<void> {
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
      await new Promise(resolve => setTimeout(resolve, AUTH_RETRY_BASE_DELAY_MS * attempt))
    } else {
      throw new Error(
        `Worker auth failed after ${MAX_AUTH_RETRIES} attempts at ${result.phase}: ${result.error}`,
      )
    }
  }
}

export function createParallelUserTest(filePrefix: string) {
  return base.extend<{}, { workerStorageState: string }>({
    storageState: ({ workerStorageState }, use) => use(workerStorageState),
    workerStorageState: [
      async ({ browser }, use, workerInfo) => {
        const dir = path.resolve(process.cwd(), 'playwright/.auth')
        fs.mkdirSync(dir, { recursive: true })

        const fileName = path.join(dir, `${filePrefix}.${workerInfo.parallelIndex}.json`)
        const credentials = credentialsForWorker(workerInfo.parallelIndex)

        await establishWorkerSession(browser, workerInfo.project.use.baseURL, credentials, fileName)

        await use(fileName)
      },
      { scope: 'worker' },
    ],
  })
}
