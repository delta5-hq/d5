import { test, expect } from '@playwright/test'
import { waitForElementWidth } from './wait-for-layout'
import { htmlPage, serveHtml } from './serve-html'

const SELECTOR = '[data-testid="target"]'

const WIDE = htmlPage(`<div data-testid="target" style="width:200px;height:50px">box</div>`)
const ZERO_WIDTH = htmlPage(`<div data-testid="target" style="width:0;height:50px">box</div>`)
const ZERO_HEIGHT = htmlPage(`<div data-testid="target" style="width:200px;height:0">box</div>`)
const ABSENT = htmlPage(`<p>no target here</p>`)
const DISPLAY_NONE = htmlPage(`<div data-testid="target" style="display:none">box</div>`)
const VISIBILITY_HIDDEN = htmlPage(
  `<div data-testid="target" style="visibility:hidden;width:200px;height:50px">box</div>`,
)
const OPACITY_ZERO = htmlPage(`<div data-testid="target" style="opacity:0;width:200px;height:50px">box</div>`)
const TWO_TARGETS_FIRST_ZERO = htmlPage(
  `<div data-testid="target" style="width:0">first</div>` +
    `<div data-testid="target" style="width:200px">second</div>`,
)

test.describe('waitForElementWidth', () => {
  test.describe('immediate resolution — element present at page load', () => {
    test('resolves when element has positive layout width', async ({ page }) => {
      await page.route('**/*', serveHtml(WIDE))
      await page.goto('/')
      await expect(waitForElementWidth(page, SELECTOR, 2000)).resolves.toBeUndefined()
    })

    test('rejects when element is absent from the DOM', async ({ page }) => {
      await page.route('**/*', serveHtml(ABSENT))
      await page.goto('/')
      await expect(waitForElementWidth(page, SELECTOR, 400)).rejects.toThrow()
    })

    test('rejects when element is present with explicit width:0', async ({ page }) => {
      await page.route('**/*', serveHtml(ZERO_WIDTH))
      await page.goto('/')
      await expect(waitForElementWidth(page, SELECTOR, 400)).rejects.toThrow()
    })
  })

  test.describe('default parameter', () => {
    test('resolves using the default timeout when no timeout argument is supplied', async ({ page }) => {
      await page.route('**/*', serveHtml(WIDE))
      await page.goto('/')
      await expect(waitForElementWidth(page, SELECTOR)).resolves.toBeUndefined()
    })
  })

  test.describe('CSS layout model — distinguishes layout presence from visual presence', () => {
    test('rejects when element is hidden via display:none — getBoundingClientRect returns zero width', async ({
      page,
    }) => {
      await page.route('**/*', serveHtml(DISPLAY_NONE))
      await page.goto('/')
      await expect(waitForElementWidth(page, SELECTOR, 400)).rejects.toThrow()
    })

    test('resolves when element is hidden via visibility:hidden — element retains layout dimensions', async ({
      page,
    }) => {
      await page.route('**/*', serveHtml(VISIBILITY_HIDDEN))
      await page.goto('/')
      await expect(waitForElementWidth(page, SELECTOR, 2000)).resolves.toBeUndefined()
    })

    test('resolves when element has opacity:0 — opacity does not affect layout dimensions', async ({ page }) => {
      await page.route('**/*', serveHtml(OPACITY_ZERO))
      await page.goto('/')
      await expect(waitForElementWidth(page, SELECTOR, 2000)).resolves.toBeUndefined()
    })

    test('resolves when element has positive width but zero height', async ({ page }) => {
      await page.route('**/*', serveHtml(ZERO_HEIGHT))
      await page.goto('/')
      await expect(waitForElementWidth(page, SELECTOR, 2000)).resolves.toBeUndefined()
    })
  })

  test.describe('late availability — element or width arrives after initial load', () => {
    test('resolves when element is injected into the DOM after initial page load', async ({ page }) => {
      await page.route('**/*', serveHtml(ABSENT))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const el = document.createElement('div')
          el.setAttribute('data-testid', 'target')
          el.style.cssText = 'width:200px;height:50px'
          document.body.appendChild(el)
        }, 80)
      })

      await expect(waitForElementWidth(page, SELECTOR, 2000)).resolves.toBeUndefined()
    })

    test('resolves when element starts at zero width and gains positive width after a delay', async ({ page }) => {
      await page.route('**/*', serveHtml(ZERO_WIDTH))
      await page.goto('/')

      await page.evaluate(sel => {
        setTimeout(() => {
          const el = document.querySelector(sel) as HTMLElement | null
          if (el) el.style.width = '200px'
        }, 80)
      }, SELECTOR)

      await expect(waitForElementWidth(page, SELECTOR, 2000)).resolves.toBeUndefined()
    })

    test('rejects when injected element arrives with zero width', async ({ page }) => {
      await page.route('**/*', serveHtml(ABSENT))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const el = document.createElement('div')
          el.setAttribute('data-testid', 'target')
          el.style.cssText = 'width:0;height:50px'
          document.body.appendChild(el)
        }, 80)
      })

      await expect(waitForElementWidth(page, SELECTOR, 500)).rejects.toThrow()
    })

    test('resolves when element transitions from display:none to block — layout dimensions become available', async ({
      page,
    }) => {
      await page.route('**/*', serveHtml(DISPLAY_NONE))
      await page.goto('/')

      await page.evaluate(sel => {
        setTimeout(() => {
          const el = document.querySelector(sel) as HTMLElement | null
          if (el) el.style.display = 'block'
        }, 80)
      }, SELECTOR)

      await expect(waitForElementWidth(page, SELECTOR, 2000)).resolves.toBeUndefined()
    })
  })

  test.describe('timeout parameterisation', () => {
    test('rejects no sooner than the supplied timeout when element never acquires width', async ({ page }) => {
      await page.route('**/*', serveHtml(ABSENT))
      await page.goto('/')

      const start = Date.now()
      await expect(waitForElementWidth(page, SELECTOR, 400)).rejects.toThrow()
      expect(Date.now() - start).toBeGreaterThanOrEqual(400)
    })

    test('resolves before the timeout when element appears within the timeout window', async ({ page }) => {
      await page.route('**/*', serveHtml(ABSENT))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const el = document.createElement('div')
          el.setAttribute('data-testid', 'target')
          el.style.cssText = 'width:200px;height:50px'
          document.body.appendChild(el)
        }, 80)
      })

      const start = Date.now()
      await expect(waitForElementWidth(page, SELECTOR, 2000)).resolves.toBeUndefined()
      expect(Date.now() - start).toBeLessThan(2000)
    })
  })

  test.describe('querySelector semantics — first matching element governs the result', () => {
    test('rejects when the first matching element has zero width even if a later match has positive width', async ({
      page,
    }) => {
      await page.route('**/*', serveHtml(TWO_TARGETS_FIRST_ZERO))
      await page.goto('/')
      await expect(waitForElementWidth(page, SELECTOR, 400)).rejects.toThrow()
    })

    test('resolves for any valid CSS selector expression including attribute selectors', async ({ page }) => {
      const html = htmlPage(`<div data-testid="custom-element" style="width:120px;height:50px">content</div>`)
      await page.route('**/*', serveHtml(html))
      await page.goto('/')
      await expect(waitForElementWidth(page, '[data-testid="custom-element"]', 2000)).resolves.toBeUndefined()
    })
  })
})
