import { test, expect } from '@playwright/test'
import { waitForAuthenticatedState, waitForUnauthenticatedState } from './wait-for-auth'

const htmlWith = (inner: string) => `<!DOCTYPE html><html><body>${inner}</body></html>`

const TRIGGER_HTML = htmlWith(`<button data-testid="user-menu-trigger">Menu</button>`)
const BLANK_HTML = htmlWith(`<p>no menu</p>`)
const CSS_HIDDEN_TRIGGER_HTML = htmlWith(`<button data-testid="user-menu-trigger" style="display:none">Menu</button>`)

function serveHtml(html: string) {
  return (route: import('@playwright/test').Route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: html })
}

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
    test('resolves once trigger element is injected into the DOM after initial load', async ({ page }) => {
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

  test.describe('css-hidden trigger', () => {
    test('rejects when trigger is present in DOM but hidden via display:none', async ({ page }) => {
      await page.route('**/*', serveHtml(CSS_HIDDEN_TRIGGER_HTML))
      await page.goto('/')
      await expect(waitForAuthenticatedState(page, 400)).rejects.toThrow()
    })
  })
})

test.describe('waitForUnauthenticatedState', () => {
  test.describe('immediate resolution', () => {
    test('resolves when user-menu-trigger is absent from the DOM', async ({ page }) => {
      await page.route('**/*', serveHtml(BLANK_HTML))
      await page.goto('/')
      await expect(waitForUnauthenticatedState(page)).resolves.toBeUndefined()
    })

    test('rejects within custom timeout when trigger element is present', async ({ page }) => {
      await page.route('**/*', serveHtml(TRIGGER_HTML))
      await page.goto('/')
      await expect(waitForUnauthenticatedState(page, 300)).rejects.toThrow()
    })
  })

  test.describe('late disappearance', () => {
    test('resolves once trigger element is removed from the DOM after initial load', async ({ page }) => {
      await page.route('**/*', serveHtml(TRIGGER_HTML))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          document.querySelector('[data-testid="user-menu-trigger"]')?.remove()
        }, 80)
      })

      await expect(waitForUnauthenticatedState(page, 2000)).resolves.toBeUndefined()
    })
  })

  test.describe('timeout parameterisation', () => {
    test('accepts and respects a caller-supplied timeout', async ({ page }) => {
      await page.route('**/*', serveHtml(TRIGGER_HTML))
      await page.goto('/')
      const start = Date.now()
      await expect(waitForUnauthenticatedState(page, 400)).rejects.toThrow()
      expect(Date.now() - start).toBeGreaterThanOrEqual(400)
    })
  })

  test.describe('css-hidden trigger', () => {
    test('resolves when trigger is present in DOM but hidden via display:none', async ({ page }) => {
      await page.route('**/*', serveHtml(CSS_HIDDEN_TRIGGER_HTML))
      await page.goto('/')
      await expect(waitForUnauthenticatedState(page, 2000)).resolves.toBeUndefined()
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

  test('detects transition from authenticated to unauthenticated when trigger is removed', async ({ page }) => {
    await page.route('**/*', serveHtml(TRIGGER_HTML))
    await page.goto('/')

    await expect(waitForAuthenticatedState(page, 1000)).resolves.toBeUndefined()

    await page.evaluate(() => {
      setTimeout(() => {
        document.querySelector('[data-testid="user-menu-trigger"]')?.remove()
      }, 80)
    })

    await expect(waitForUnauthenticatedState(page, 2000)).resolves.toBeUndefined()
  })

  test('detects transition from unauthenticated to authenticated when trigger is added', async ({ page }) => {
    await page.route('**/*', serveHtml(BLANK_HTML))
    await page.goto('/')

    await expect(waitForUnauthenticatedState(page, 1000)).resolves.toBeUndefined()

    await page.evaluate(() => {
      setTimeout(() => {
        const btn = document.createElement('button')
        btn.setAttribute('data-testid', 'user-menu-trigger')
        document.body.appendChild(btn)
      }, 80)
    })

    await expect(waitForAuthenticatedState(page, 2000)).resolves.toBeUndefined()
  })
})
