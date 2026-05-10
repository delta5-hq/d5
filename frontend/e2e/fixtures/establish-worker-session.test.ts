import { test, expect, type Browser } from '@playwright/test'

import { establishWorkerSession, MAX_AUTH_RETRIES } from './parallel-user-test'

const CREDENTIALS = { usernameOrEmail: 'worker@test.com', password: 'secret' }
const SESSION_PATH = '/tmp/pw-unit-test-session.json'

interface AttemptSpec {
  login: number
  refresh?: number
}

interface AttemptRecord {
  storageStateCalled: boolean
  savedPath: string | undefined
  closeCalled: boolean
  newContextOpts: { storageState: unknown; baseURL: string | undefined }
}

function buildMockBrowser(attempts: AttemptSpec[]): { browser: Browser; records: AttemptRecord[] } {
  const records: AttemptRecord[] = []

  const browser = {
    newContext: async (opts: { storageState: unknown; baseURL: string | undefined }) => {
      const idx = records.length
      const spec = attempts[idx] ?? { login: 200 }
      const record: AttemptRecord = {
        storageStateCalled: false,
        savedPath: undefined,
        closeCalled: false,
        newContextOpts: opts,
      }
      records.push(record)

      return {
        request: {
          post: async (url: string) => {
            if (url.includes('/auth/login')) {
              return { ok: () => spec.login >= 200 && spec.login < 300, status: () => spec.login }
            }
            const refreshStatus = spec.refresh ?? 200
            return { ok: () => refreshStatus >= 200 && refreshStatus < 300, status: () => refreshStatus }
          },
        },
        storageState: async ({ path }: { path: string }) => {
          record.storageStateCalled = true
          record.savedPath = path
        },
        close: async () => {
          record.closeCalled = true
        },
      }
    },
  } as unknown as Browser

  return { browser, records }
}

test.describe('establishWorkerSession', () => {
  test.describe('first-attempt success', () => {
    test('resolves without creating additional contexts', async () => {
      const { browser, records } = buildMockBrowser([{ login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records).toHaveLength(1)
    })

    test('writes storage state to the supplied file path', async () => {
      const { browser, records } = buildMockBrowser([{ login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records[0].savedPath).toBe(SESSION_PATH)
    })

    test('closes the context after writing storage state', async () => {
      const { browser, records } = buildMockBrowser([{ login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records[0].closeCalled).toBe(true)
    })

    test('creates the context with storageState: undefined to prevent session carryover', async () => {
      const { browser, records } = buildMockBrowser([{ login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records[0].newContextOpts.storageState).toBeUndefined()
    })

    test('forwards baseURL to the browser context constructor', async () => {
      const { browser, records } = buildMockBrowser([{ login: 200 }])
      await establishWorkerSession(browser, 'http://app.test:5173', CREDENTIALS, SESSION_PATH)
      expect(records[0].newContextOpts.baseURL).toBe('http://app.test:5173')
    })
  })

  test.describe('single transient failure then success', () => {
    test('retries after a login-phase failure and resolves on the next attempt', async () => {
      const { browser, records } = buildMockBrowser([{ login: 401 }, { login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records).toHaveLength(2)
      expect(records[1].storageStateCalled).toBe(true)
    })

    test('retries after a refresh-phase failure and resolves on the next attempt', async () => {
      const { browser, records } = buildMockBrowser([{ login: 200, refresh: 503 }, { login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records).toHaveLength(2)
      expect(records[1].storageStateCalled).toBe(true)
    })

    test('does not write storage state for the failed attempt', async () => {
      const { browser, records } = buildMockBrowser([{ login: 401 }, { login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records[0].storageStateCalled).toBe(false)
    })

    test('closes the failed context before opening the retry context', async () => {
      const { browser, records } = buildMockBrowser([{ login: 401 }, { login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records[0].closeCalled).toBe(true)
      expect(records[1].storageStateCalled).toBe(true)
    })

    test('creates each retry context with storageState: undefined', async () => {
      const { browser, records } = buildMockBrowser([{ login: 401 }, { login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records[0].newContextOpts.storageState).toBeUndefined()
      expect(records[1].newContextOpts.storageState).toBeUndefined()
    })
  })

  test.describe('two consecutive failures then success (boundary at MAX_AUTH_RETRIES - 1)', () => {
    test('retries twice and resolves on the third attempt', async () => {
      const { browser, records } = buildMockBrowser([{ login: 500 }, { login: 503 }, { login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records).toHaveLength(MAX_AUTH_RETRIES)
      expect(records[MAX_AUTH_RETRIES - 1].storageStateCalled).toBe(true)
    })

    test('closes every failed context before the next attempt', async () => {
      const { browser, records } = buildMockBrowser([{ login: 500 }, { login: 503 }, { login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records[0].closeCalled).toBe(true)
      expect(records[1].closeCalled).toBe(true)
      expect(records[0].storageStateCalled).toBe(false)
      expect(records[1].storageStateCalled).toBe(false)
    })
  })

  test.describe('all retries exhausted', () => {
    test(`throws after ${MAX_AUTH_RETRIES} consecutive failures`, async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
      const { browser } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH),
      ).rejects.toThrow()
    })

    test(`error message reports the attempt count (${MAX_AUTH_RETRIES})`, async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
      const { browser } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH),
      ).rejects.toThrow(new RegExp(`${MAX_AUTH_RETRIES} attempts`))
    })

    test('error message includes the failure phase when login is the last failing step', async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
      const { browser } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH),
      ).rejects.toThrow(/login/)
    })

    test('error message includes the failure phase when refresh is the last failing step', async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 200, refresh: 500 }))
      const { browser } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH),
      ).rejects.toThrow(/refresh/)
    })

    test(`does not create more than ${MAX_AUTH_RETRIES} contexts`, async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
      const { browser, records } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH),
      ).rejects.toThrow()
      expect(records).toHaveLength(MAX_AUTH_RETRIES)
    })

    test('closes all contexts even when every attempt fails', async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
      const { browser, records } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH),
      ).rejects.toThrow()
      for (const record of records) {
        expect(record.closeCalled).toBe(true)
      }
    })

    test('never writes storage state when all attempts fail', async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
      const { browser, records } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH),
      ).rejects.toThrow()
      for (const record of records) {
        expect(record.storageStateCalled).toBe(false)
      }
    })
  })

  test.describe('non-2xx status code coverage', () => {
    test('treats 403 login response as a failure', async () => {
      const { browser, records } = buildMockBrowser([{ login: 403 }, { login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records[0].storageStateCalled).toBe(false)
      expect(records[1].storageStateCalled).toBe(true)
    })

    test('treats 500 login response as a failure', async () => {
      const { browser, records } = buildMockBrowser([{ login: 500 }, { login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records[0].storageStateCalled).toBe(false)
      expect(records[1].storageStateCalled).toBe(true)
    })

    test('treats 401 refresh response as a failure', async () => {
      const { browser, records } = buildMockBrowser([{ login: 200, refresh: 401 }, { login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records[0].storageStateCalled).toBe(false)
      expect(records[1].storageStateCalled).toBe(true)
    })
  })
})
