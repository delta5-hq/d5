import { test as base } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

import type { AuthCredentials } from '../helpers/api-auth'
import { e2eEnv } from '../utils/e2e-env-vars'
import { MAX_AUTH_RETRIES, establishWorkerSession } from './worker-session'

export { MAX_AUTH_RETRIES, establishWorkerSession }

const adminCredentials = (): AuthCredentials => ({
  usernameOrEmail: e2eEnv.E2E_ADMIN_USER,
  password: e2eEnv.E2E_ADMIN_PASS,
})

const subscriberCredentials = (): AuthCredentials => ({
  usernameOrEmail: e2eEnv.E2E_SUBSCRIBER_USER || 'subscriber',
  password: e2eEnv.E2E_SUBSCRIBER_PASS || 'P@ssw0rd!',
})

export const customerCredentials = (): AuthCredentials => ({
  usernameOrEmail: 'customer',
  password: 'P@ssw0rd!',
})

export const credentialsForWorker = (parallelIndex: number): AuthCredentials =>
  parallelIndex === 0 ? adminCredentials() : subscriberCredentials()

function workerScopedAuthTest(filePrefix: string, resolveCredentials: (parallelIndex: number) => AuthCredentials) {
  return base.extend<{}, { workerStorageState: string }>({
    storageState: ({ workerStorageState }, use) => use(workerStorageState),
    workerStorageState: [
      async ({ browser }, use, workerInfo) => {
        const dir = path.resolve(process.cwd(), 'playwright/.auth')
        fs.mkdirSync(dir, { recursive: true })

        const credentials = resolveCredentials(workerInfo.parallelIndex)
        const fileName = path.join(dir, `${filePrefix}.${workerInfo.project.name}.${workerInfo.parallelIndex}.json`)

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

export function createCustomerTest(filePrefix: string) {
  return workerScopedAuthTest(filePrefix, () => customerCredentials())
}
