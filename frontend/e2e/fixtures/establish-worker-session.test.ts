import { test, expect, type Browser } from '@playwright/test'

import { establishWorkerSession, exponentialDelay, MAX_AUTH_RETRIES, AUTH_RETRY_BASE_DELAY_MS, AUTH_MAX_DELAY_MS } from './worker-session'

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

  test.describe('two consecutive failures then success', () => {
    test('retries twice and resolves on the third attempt', async () => {
      const { browser, records } = buildMockBrowser([{ login: 500 }, { login: 503 }, { login: 200 }])
      await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH)
      expect(records).toHaveLength(3)
      expect(records[2].storageStateCalled).toBe(true)
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
    const noDelay = () => 0

    test(`throws after ${MAX_AUTH_RETRIES} consecutive failures`, async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
      const { browser } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay),
      ).rejects.toThrow()
    })

    test(`error message reports the attempt count (${MAX_AUTH_RETRIES})`, async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
      const { browser } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay),
      ).rejects.toThrow(new RegExp(`${MAX_AUTH_RETRIES} attempts`))
    })

    test('error message includes the failure phase when login is the last failing step', async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
      const { browser } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay),
      ).rejects.toThrow(/login/)
    })

    test('error message includes the failure phase when refresh is the last failing step', async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 200, refresh: 500 }))
      const { browser } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay),
      ).rejects.toThrow(/refresh/)
    })

    test(`does not create more than ${MAX_AUTH_RETRIES} contexts`, async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
      const { browser, records } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay),
      ).rejects.toThrow()
      expect(records).toHaveLength(MAX_AUTH_RETRIES)
    })

    test('closes all contexts even when every attempt fails', async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
      const { browser, records } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay),
      ).rejects.toThrow()
      for (const record of records) {
        expect(record.closeCalled).toBe(true)
      }
    })

    test('never writes storage state when all attempts fail', async () => {
      const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
      const { browser, records } = buildMockBrowser(failAll)
      await expect(
        establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay),
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

test.describe('exponentialDelay', () => {
  test.describe('return type', () => {
    test('returns a number', () => {
      expect(typeof exponentialDelay(1)).toBe('number')
    })

    test('never returns a negative value', () => {
      for (let attempt = 1; attempt <= 10; attempt++) {
        expect(exponentialDelay(attempt)).toBeGreaterThanOrEqual(0)
      }
    })
  })

  test.describe('cap contract', () => {
    test('never exceeds AUTH_MAX_DELAY_MS', () => {
      for (let attempt = 1; attempt <= 20; attempt++) {
        expect(exponentialDelay(attempt)).toBeLessThanOrEqual(AUTH_MAX_DELAY_MS)
      }
    })

    test('returns exactly AUTH_MAX_DELAY_MS once base alone exceeds the cap', () => {
      for (let run = 0; run < 20; run++) {
        expect(exponentialDelay(6)).toBe(AUTH_MAX_DELAY_MS)
      }
    })

    test('large attempt numbers are also capped at AUTH_MAX_DELAY_MS', () => {
      expect(exponentialDelay(50)).toBe(AUTH_MAX_DELAY_MS)
      expect(exponentialDelay(100)).toBe(AUTH_MAX_DELAY_MS)
    })
  })

  test.describe('base contract', () => {
    test('at attempt 1, result is at least AUTH_RETRY_BASE_DELAY_MS (jitter only adds)', () => {
      for (let run = 0; run < 20; run++) {
        expect(exponentialDelay(1)).toBeGreaterThanOrEqual(AUTH_RETRY_BASE_DELAY_MS)
      }
    })

    test('at attempt 1, result is less than 2 * AUTH_RETRY_BASE_DELAY_MS (base + max jitter)', () => {
      for (let run = 0; run < 20; run++) {
        expect(exponentialDelay(1)).toBeLessThan(2 * AUTH_RETRY_BASE_DELAY_MS)
      }
    })

    test('attempt 2 base exceeds attempt 1 maximum (exponential growth separates ranges)', () => {
      const maxAttempt1 = 2 * AUTH_RETRY_BASE_DELAY_MS - 1
      for (let run = 0; run < 20; run++) {
        expect(exponentialDelay(2)).toBeGreaterThan(maxAttempt1)
      }
    })
  })
})

test.describe('retryDelay invocation contract', () => {
  function makeSpyDelay(): { fn: (attempt: number) => number; calls: number[] } {
    const calls: number[] = []
    return { fn: (attempt: number) => { calls.push(attempt); return 0 }, calls }
  }

  test('not called when first attempt succeeds', async () => {
    const { browser } = buildMockBrowser([{ login: 200 }])
    const { fn, calls } = makeSpyDelay()
    await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, fn)
    expect(calls).toHaveLength(0)
  })

  test('called once between the first failure and the second attempt', async () => {
    const { browser } = buildMockBrowser([{ login: 401 }, { login: 200 }])
    const { fn, calls } = makeSpyDelay()
    await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, fn)
    expect(calls).toHaveLength(1)
  })

  test('called with attempt number 1 after the first failure', async () => {
    const { browser } = buildMockBrowser([{ login: 401 }, { login: 200 }])
    const { fn, calls } = makeSpyDelay()
    await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, fn)
    expect(calls[0]).toBe(1)
  })

  test('called with monotonically increasing attempt numbers across retries', async () => {
    const { browser } = buildMockBrowser([{ login: 401 }, { login: 401 }, { login: 401 }, { login: 200 }])
    const { fn, calls } = makeSpyDelay()
    await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, fn)
    expect(calls).toEqual([1, 2, 3])
  })

  test('not called after the final exhausted attempt (no delay before throwing)', async () => {
    const failAll = Array.from({ length: MAX_AUTH_RETRIES }, () => ({ login: 401 }))
    const { browser } = buildMockBrowser(failAll)
    const { fn, calls } = makeSpyDelay()
    await expect(
      establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, fn),
    ).rejects.toThrow()
    expect(calls).toHaveLength(MAX_AUTH_RETRIES - 1)
  })

  test('called exactly N-1 times when success arrives at attempt N', async () => {
    const n = 4
    const specs = [...Array.from({ length: n - 1 }, () => ({ login: 503 })), { login: 200 }]
    const { browser } = buildMockBrowser(specs)
    const { fn, calls } = makeSpyDelay()
    await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, fn)
    expect(calls).toHaveLength(n - 1)
  })
})

test.describe('success at the last allowed attempt', () => {
  const noDelay = () => 0

  test(`resolves when attempt ${MAX_AUTH_RETRIES} succeeds after ${MAX_AUTH_RETRIES - 1} failures`, async () => {
    const specs = [
      ...Array.from({ length: MAX_AUTH_RETRIES - 1 }, () => ({ login: 503 })),
      { login: 200 },
    ]
    const { browser, records } = buildMockBrowser(specs)
    await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay)
    expect(records).toHaveLength(MAX_AUTH_RETRIES)
    expect(records[MAX_AUTH_RETRIES - 1].storageStateCalled).toBe(true)
  })

  test('writes storage state only for the final successful attempt', async () => {
    const specs = [
      ...Array.from({ length: MAX_AUTH_RETRIES - 1 }, () => ({ login: 503 })),
      { login: 200 },
    ]
    const { browser, records } = buildMockBrowser(specs)
    await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay)
    for (let i = 0; i < MAX_AUTH_RETRIES - 1; i++) {
      expect(records[i].storageStateCalled).toBe(false)
    }
    expect(records[MAX_AUTH_RETRIES - 1].storageStateCalled).toBe(true)
  })

  test('closes all prior contexts before writing storage state on the last attempt', async () => {
    const specs = [
      ...Array.from({ length: MAX_AUTH_RETRIES - 1 }, () => ({ login: 503 })),
      { login: 200 },
    ]
    const { browser, records } = buildMockBrowser(specs)
    await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay)
    for (let i = 0; i < MAX_AUTH_RETRIES - 1; i++) {
      expect(records[i].closeCalled).toBe(true)
    }
  })
})

test.describe('mixed-phase failure sequences', () => {
  const noDelay = () => 0

  test('recovers when login fails on one attempt and refresh fails on the next', async () => {
    const { browser, records } = buildMockBrowser([{ login: 401 }, { login: 200, refresh: 503 }, { login: 200 }])
    await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay)
    expect(records).toHaveLength(3)
    expect(records[2].storageStateCalled).toBe(true)
  })

  test('does not write storage state for login-failed or refresh-failed attempts', async () => {
    const { browser, records } = buildMockBrowser([{ login: 401 }, { login: 200, refresh: 503 }, { login: 200 }])
    await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay)
    expect(records[0].storageStateCalled).toBe(false)
    expect(records[1].storageStateCalled).toBe(false)
    expect(records[2].storageStateCalled).toBe(true)
  })

  test('error message phase reflects the last failing step when all attempts exhausted', async () => {
    const failAll = [
      ...Array.from({ length: MAX_AUTH_RETRIES - 1 }, () => ({ login: 401 })),
      { login: 200, refresh: 500 },
    ]
    const { browser } = buildMockBrowser(failAll)
    await expect(
      establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay),
    ).rejects.toThrow(/refresh/)
  })

  test('all contexts closed regardless of which phase failed', async () => {
    const { browser, records } = buildMockBrowser([{ login: 401 }, { login: 200, refresh: 503 }, { login: 200 }])
    await establishWorkerSession(browser, undefined, CREDENTIALS, SESSION_PATH, 0, noDelay)
    expect(records[0].closeCalled).toBe(true)
    expect(records[1].closeCalled).toBe(true)
  })
})

