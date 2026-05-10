import { test as base } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

import { adminLogin, subscriberLogin } from '../utils'

export function createParallelUserTest(filePrefix: string) {
  return base.extend<{}, { workerStorageState: string }>({
    storageState: ({ workerStorageState }, use) => use(workerStorageState),
    workerStorageState: [
      async ({ browser }, use, workerInfo) => {
        const dir = path.resolve(process.cwd(), 'playwright/.auth')
        fs.mkdirSync(dir, { recursive: true })

        const fileName = path.join(dir, `${filePrefix}.${workerInfo.parallelIndex}.json`)
        const context = await browser.newContext({
          storageState: undefined,
          baseURL: workerInfo.project.use.baseURL,
        })
        const page = await context.newPage()

        if (workerInfo.parallelIndex === 0) {
          await adminLogin(page)
        } else {
          await subscriberLogin(page)
        }

        await context.storageState({ path: fileName })
        await context.close()

        await use(fileName)
      },
      { scope: 'worker' },
    ],
  })
}
