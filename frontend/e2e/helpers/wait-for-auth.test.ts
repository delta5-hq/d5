import { test, expect } from '@playwright/test'
import { waitForAuthenticatedState, waitForUnauthenticatedState, waitForRegisterPageReady } from './wait-for-auth'
import { htmlPage, serveHtml } from './serve-html'

const TRIGGER_HTML = htmlPage(`<button data-testid="user-menu-trigger">Menu</button>`)
const BLANK_HTML = htmlPage(`<p>no menu</p>`)
const CSS_HIDDEN_TRIGGER_HTML = htmlPage(`<button data-testid="user-menu-trigger" style="display:none">Menu</button>`)
const VISIBILITY_HIDDEN_TRIGGER_HTML = htmlPage(
  `<button data-testid="user-menu-trigger" style="visibility:hidden">Menu</button>`,
)
const OPACITY_ZERO_TRIGGER_HTML = htmlPage(`<button data-testid="user-menu-trigger" style="opacity:0">Menu</button>`)
const SPAN_LOGIN_HTML = htmlPage(`<span data-type="login">Log in</span>`)
const BUTTON_LOGIN_HTML = htmlPage(`<button data-type="login">Log in</button>`)
const CSS_HIDDEN_SPAN_LOGIN_HTML = htmlPage(`<span data-type="login" style="display:none">Log in</span>`)
const VISIBILITY_HIDDEN_SPAN_LOGIN_HTML = htmlPage(`<span data-type="login" style="visibility:hidden">Log in</span>`)
const OPACITY_ZERO_SPAN_LOGIN_HTML = htmlPage(`<span data-type="login" style="opacity:0">Log in</span>`)

test.describe('waitForAuthenticatedState', () => {
  test.describe('immediate resolution', () => {
    test('resolves when user-menu-trigger is already visible in the DOM', async ({ page }) => {
      await page.route('**/*', serveHtml(TRIGGER_HTML))
      await page.goto('/')
      await expect(waitForAuthenticatedState(page)).resolves.toBeUndefined()
    })

    test('rejects within custom timeout when trigger element is absent', async ({ page }) => {
      await page.route('**/*', serveHtml(BLANK_HTML))
      await page.goto('/')
      await expect(waitForAuthenticatedState(page, 300)).rejects.toThrow()
    })
  })

  test.describe('late appearance', () => {
    test('resolves when trigger element is injected into the DOM after initial load', async ({ page }) => {
      await page.route('**/*', serveHtml(BLANK_HTML))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const btn = document.createElement('button')
          btn.setAttribute('data-testid', 'user-menu-trigger')
          document.body.appendChild(btn)
        }, 80)
      })

      await expect(waitForAuthenticatedState(page, 2000)).resolves.toBeUndefined()
    })

    test('resolves when trigger transitions from display:none to visible', async ({ page }) => {
      await page.route('**/*', serveHtml(CSS_HIDDEN_TRIGGER_HTML))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const btn = document.querySelector('[data-testid="user-menu-trigger"]') as HTMLElement | null
          if (btn) btn.style.display = ''
        }, 80)
      })

      await expect(waitForAuthenticatedState(page, 2000)).resolves.toBeUndefined()
    })

    test('resolves when trigger transitions from visibility:hidden to visible', async ({ page }) => {
      await page.route('**/*', serveHtml(VISIBILITY_HIDDEN_TRIGGER_HTML))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const btn = document.querySelector('[data-testid="user-menu-trigger"]') as HTMLElement | null
          if (btn) btn.style.visibility = ''
        }, 80)
      })

      await expect(waitForAuthenticatedState(page, 2000)).resolves.toBeUndefined()
    })
  })

  test.describe('timeout parameterisation', () => {
    test('accepts and respects a caller-supplied timeout', async ({ page }) => {
      await page.route('**/*', serveHtml(BLANK_HTML))
      await page.goto('/')
      const start = Date.now()
      await expect(waitForAuthenticatedState(page, 400)).rejects.toThrow()
      expect(Date.now() - start).toBeGreaterThanOrEqual(400)
    })
  })

  test.describe('css visibility model', () => {
    test('rejects when trigger is hidden via display:none', async ({ page }) => {
      await page.route('**/*', serveHtml(CSS_HIDDEN_TRIGGER_HTML))
      await page.goto('/')
      await expect(waitForAuthenticatedState(page, 400)).rejects.toThrow()
    })

    test('rejects when trigger is hidden via visibility:hidden', async ({ page }) => {
      await page.route('**/*', serveHtml(VISIBILITY_HIDDEN_TRIGGER_HTML))
      await page.goto('/')
      await expect(waitForAuthenticatedState(page, 400)).rejects.toThrow()
    })

    test('resolves when trigger has opacity:0 — opacity is not a Playwright visibility criterion', async ({ page }) => {
      await page.route('**/*', serveHtml(OPACITY_ZERO_TRIGGER_HTML))
      await page.goto('/')
      await expect(waitForAuthenticatedState(page, 2000)).resolves.toBeUndefined()
    })
  })
})

test.describe('waitForUnauthenticatedState', () => {
  test.describe('immediate resolution', () => {
    test('resolves when a span element with [data-type="login"] is visible', async ({ page }) => {
      await page.route('**/*', serveHtml(SPAN_LOGIN_HTML))
      await page.goto('/')
      await expect(waitForUnauthenticatedState(page)).resolves.toBeUndefined()
    })

    test('resolves when a button element with [data-type="login"] is visible', async ({ page }) => {
      await page.route('**/*', serveHtml(BUTTON_LOGIN_HTML))
      await page.goto('/')
      await expect(waitForUnauthenticatedState(page)).resolves.toBeUndefined()
    })

    test('rejects within custom timeout when no [data-type="login"] element is present', async ({ page }) => {
      await page.route('**/*', serveHtml(BLANK_HTML))
      await page.goto('/')
      await expect(waitForUnauthenticatedState(page, 300)).rejects.toThrow()
    })
  })

  test.describe('late appearance', () => {
    test('resolves when a span [data-type="login"] is injected into the DOM after initial load', async ({ page }) => {
      await page.route('**/*', serveHtml(BLANK_HTML))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const span = document.createElement('span')
          span.setAttribute('data-type', 'login')
          span.textContent = 'Log in'
          document.body.appendChild(span)
        }, 80)
      })

      await expect(waitForUnauthenticatedState(page, 2000)).resolves.toBeUndefined()
    })

    test('resolves when a button [data-type="login"] is injected into the DOM after initial load', async ({ page }) => {
      await page.route('**/*', serveHtml(BLANK_HTML))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const btn = document.createElement('button')
          btn.setAttribute('data-type', 'login')
          btn.textContent = 'Log in'
          document.body.appendChild(btn)
        }, 80)
      })

      await expect(waitForUnauthenticatedState(page, 2000)).resolves.toBeUndefined()
    })

    test('resolves when login element transitions from display:none to visible', async ({ page }) => {
      await page.route('**/*', serveHtml(CSS_HIDDEN_SPAN_LOGIN_HTML))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const el = document.querySelector('span[data-type="login"]') as HTMLElement | null
          if (el) el.style.display = ''
        }, 80)
      })

      await expect(waitForUnauthenticatedState(page, 2000)).resolves.toBeUndefined()
    })

    test('resolves when login element transitions from visibility:hidden to visible', async ({ page }) => {
      await page.route('**/*', serveHtml(VISIBILITY_HIDDEN_SPAN_LOGIN_HTML))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const el = document.querySelector('span[data-type="login"]') as HTMLElement | null
          if (el) el.style.visibility = ''
        }, 80)
      })

      await expect(waitForUnauthenticatedState(page, 2000)).resolves.toBeUndefined()
    })
  })

  test.describe('timeout parameterisation', () => {
    test('accepts and respects a caller-supplied timeout', async ({ page }) => {
      await page.route('**/*', serveHtml(BLANK_HTML))
      await page.goto('/')
      const start = Date.now()
      await expect(waitForUnauthenticatedState(page, 400)).rejects.toThrow()
      expect(Date.now() - start).toBeGreaterThanOrEqual(400)
    })
  })

  test.describe('css visibility model', () => {
    test('rejects when login element is hidden via display:none', async ({ page }) => {
      await page.route('**/*', serveHtml(CSS_HIDDEN_SPAN_LOGIN_HTML))
      await page.goto('/')
      await expect(waitForUnauthenticatedState(page, 400)).rejects.toThrow()
    })

    test('rejects when login element is hidden via visibility:hidden', async ({ page }) => {
      await page.route('**/*', serveHtml(VISIBILITY_HIDDEN_SPAN_LOGIN_HTML))
      await page.goto('/')
      await expect(waitForUnauthenticatedState(page, 400)).rejects.toThrow()
    })

    test('resolves when login element has opacity:0 — opacity is not a Playwright visibility criterion', async ({
      page,
    }) => {
      await page.route('**/*', serveHtml(OPACITY_ZERO_SPAN_LOGIN_HTML))
      await page.goto('/')
      await expect(waitForUnauthenticatedState(page, 2000)).resolves.toBeUndefined()
    })
  })
})

test.describe('waitForRegisterPageReady', () => {
  test.describe('resolves and returns locator', () => {
    test('returns a Locator pointing to the visible span[data-type="login"]', async ({ page }) => {
      await page.route('**/*', serveHtml(SPAN_LOGIN_HTML))
      await page.goto('/')
      const link = await waitForRegisterPageReady(page)
      await expect(link).toHaveText('Log in')
    })

    test('resolves when span[data-type="login"] is injected into the DOM after initial load', async ({ page }) => {
      await page.route('**/*', serveHtml(BLANK_HTML))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const span = document.createElement('span')
          span.setAttribute('data-type', 'login')
          span.textContent = 'Log in'
          document.body.appendChild(span)
        }, 80)
      })

      await expect(waitForRegisterPageReady(page, 2000)).resolves.toBeDefined()
    })

    test('resolves when span[data-type="login"] has opacity:0 — opacity is not a Playwright visibility criterion', async ({
      page,
    }) => {
      await page.route('**/*', serveHtml(OPACITY_ZERO_SPAN_LOGIN_HTML))
      await page.goto('/')
      await expect(waitForRegisterPageReady(page, 2000)).resolves.toBeDefined()
    })
  })

  test.describe('rejects on absence or wrong tag', () => {
    test('rejects when span[data-type="login"] is absent', async ({ page }) => {
      await page.route('**/*', serveHtml(BLANK_HTML))
      await page.goto('/')
      await expect(waitForRegisterPageReady(page, 300)).rejects.toThrow()
    })

    test('rejects when only button[data-type="login"] is present — span-specific selector enforced', async ({
      page,
    }) => {
      await page.route('**/*', serveHtml(BUTTON_LOGIN_HTML))
      await page.goto('/')
      await expect(waitForRegisterPageReady(page, 300)).rejects.toThrow()
    })

    test('rejects when span[data-type="login"] is hidden via display:none', async ({ page }) => {
      await page.route('**/*', serveHtml(CSS_HIDDEN_SPAN_LOGIN_HTML))
      await page.goto('/')
      await expect(waitForRegisterPageReady(page, 400)).rejects.toThrow()
    })

    test('rejects when span[data-type="login"] is hidden via visibility:hidden', async ({ page }) => {
      await page.route('**/*', serveHtml(VISIBILITY_HIDDEN_SPAN_LOGIN_HTML))
      await page.goto('/')
      await expect(waitForRegisterPageReady(page, 400)).rejects.toThrow()
    })
  })
})

test.describe('symmetry contract', () => {
  test('waitForAuthenticatedState and waitForUnauthenticatedState respond to opposite DOM states', async ({ page }) => {
    await page.route('**/*', serveHtml(TRIGGER_HTML))
    await page.goto('/')

    await expect(waitForAuthenticatedState(page, 1000)).resolves.toBeUndefined()
    await expect(waitForUnauthenticatedState(page, 300)).rejects.toThrow()
  })

  test('detects transition from authenticated to unauthenticated when trigger is removed and login element appears', async ({
    page,
  }) => {
    await page.route('**/*', serveHtml(TRIGGER_HTML))
    await page.goto('/')

    await expect(waitForAuthenticatedState(page, 1000)).resolves.toBeUndefined()

    await page.evaluate(() => {
      setTimeout(() => {
        document.querySelector('[data-testid="user-menu-trigger"]')?.remove()
        const span = document.createElement('span')
        span.setAttribute('data-type', 'login')
        span.textContent = 'Log in'
        document.body.appendChild(span)
      }, 80)
    })

    await expect(waitForUnauthenticatedState(page, 2000)).resolves.toBeUndefined()
  })

  test('detects transition from unauthenticated to authenticated when login element is removed and trigger appears', async ({
    page,
  }) => {
    await page.route('**/*', serveHtml(SPAN_LOGIN_HTML))
    await page.goto('/')

    await expect(waitForUnauthenticatedState(page, 1000)).resolves.toBeUndefined()

    await page.evaluate(() => {
      setTimeout(() => {
        document.querySelector('[data-type="login"]')?.remove()
        const btn = document.createElement('button')
        btn.setAttribute('data-testid', 'user-menu-trigger')
        document.body.appendChild(btn)
      }, 80)
    })

    await expect(waitForAuthenticatedState(page, 2000)).resolves.toBeUndefined()
  })

  test('waitForRegisterPageReady resolves on span[data-type="login"] but not on button[data-type="login"] — tag contract enforced', async ({
    page,
  }) => {
    await page.route('**/*', serveHtml(BUTTON_LOGIN_HTML))
    await page.goto('/')

    await expect(waitForUnauthenticatedState(page, 1000)).resolves.toBeUndefined()
    await expect(waitForRegisterPageReady(page, 300)).rejects.toThrow()
  })

  test('waitForRegisterPageReady resolves on span[data-type="login"] but not on user-menu-trigger', async ({
    page,
  }) => {
    await page.route('**/*', serveHtml(SPAN_LOGIN_HTML))
    await page.goto('/')

    await expect(waitForRegisterPageReady(page, 1000)).resolves.toBeDefined()
    await expect(waitForAuthenticatedState(page, 300)).rejects.toThrow()
  })

  test('waitForAuthenticatedState resolves on user-menu-trigger but not on span[data-type="login"] or button[data-type="login"]', async ({
    page,
  }) => {
    await page.route('**/*', serveHtml(TRIGGER_HTML))
    await page.goto('/')

    await expect(waitForAuthenticatedState(page, 1000)).resolves.toBeUndefined()
    await expect(waitForRegisterPageReady(page, 300)).rejects.toThrow()
  })
})
