import { test, expect } from '@playwright/test'
import { waitForIntegrationCategoryReady } from './wait-for-integration-category'
import { htmlPage, serveHtml } from './serve-html'

const BOTH_VISIBLE = htmlPage(
  `<button data-type="add-mcp">Add MCP</button><button data-type="add-rpc">Add RPC</button>`,
)
const MCP_ONLY = htmlPage(`<button data-type="add-mcp">Add MCP</button>`)
const RPC_ONLY = htmlPage(`<button data-type="add-rpc">Add RPC</button>`)
const NEITHER = htmlPage(`<p>no integration buttons</p>`)
const CSS_HIDDEN_BOTH = htmlPage(
  `<button data-type="add-mcp" style="display:none">Add MCP</button>` +
    `<button data-type="add-rpc" style="display:none">Add RPC</button>`,
)
const CSS_HIDDEN_MCP = htmlPage(
  `<button data-type="add-mcp" style="display:none">Add MCP</button>` +
    `<button data-type="add-rpc">Add RPC</button>`,
)
const CSS_HIDDEN_RPC = htmlPage(
  `<button data-type="add-mcp">Add MCP</button>` +
    `<button data-type="add-rpc" style="display:none">Add RPC</button>`,
)
const VISIBILITY_HIDDEN_BOTH = htmlPage(
  `<button data-type="add-mcp" style="visibility:hidden">Add MCP</button>` +
    `<button data-type="add-rpc" style="visibility:hidden">Add RPC</button>`,
)
const OPACITY_ZERO_BOTH = htmlPage(
  `<button data-type="add-mcp" style="opacity:0">Add MCP</button>` +
    `<button data-type="add-rpc" style="opacity:0">Add RPC</button>`,
)

test.describe('waitForIntegrationCategoryReady', () => {
  test.describe('immediate resolution', () => {
    test('resolves when both add-mcp and add-rpc are already visible in the DOM', async ({ page }) => {
      await page.route('**/*', serveHtml(BOTH_VISIBLE))
      await page.goto('/')
      await expect(waitForIntegrationCategoryReady(page)).resolves.toBeUndefined()
    })

    test('rejects within custom timeout when only add-mcp is present', async ({ page }) => {
      await page.route('**/*', serveHtml(MCP_ONLY))
      await page.goto('/')
      await expect(waitForIntegrationCategoryReady(page, 300)).rejects.toThrow()
    })

    test('rejects within custom timeout when only add-rpc is present', async ({ page }) => {
      await page.route('**/*', serveHtml(RPC_ONLY))
      await page.goto('/')
      await expect(waitForIntegrationCategoryReady(page, 300)).rejects.toThrow()
    })

    test('rejects within custom timeout when neither button is present', async ({ page }) => {
      await page.route('**/*', serveHtml(NEITHER))
      await page.goto('/')
      await expect(waitForIntegrationCategoryReady(page, 300)).rejects.toThrow()
    })
  })

  test.describe('late appearance', () => {
    test('resolves when add-mcp appears first then add-rpc is injected after', async ({ page }) => {
      await page.route('**/*', serveHtml(MCP_ONLY))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const btn = document.createElement('button')
          btn.setAttribute('data-type', 'add-rpc')
          btn.textContent = 'Add RPC'
          document.body.appendChild(btn)
        }, 80)
      })

      await expect(waitForIntegrationCategoryReady(page, 2000)).resolves.toBeUndefined()
    })

    test('resolves when add-rpc appears first then add-mcp is injected after', async ({ page }) => {
      await page.route('**/*', serveHtml(RPC_ONLY))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const btn = document.createElement('button')
          btn.setAttribute('data-type', 'add-mcp')
          btn.textContent = 'Add MCP'
          document.body.appendChild(btn)
        }, 80)
      })

      await expect(waitForIntegrationCategoryReady(page, 2000)).resolves.toBeUndefined()
    })

    test('resolves when both buttons are injected simultaneously after initial load', async ({ page }) => {
      await page.route('**/*', serveHtml(NEITHER))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const mcp = document.createElement('button')
          mcp.setAttribute('data-type', 'add-mcp')
          mcp.textContent = 'Add MCP'
          document.body.appendChild(mcp)

          const rpc = document.createElement('button')
          rpc.setAttribute('data-type', 'add-rpc')
          rpc.textContent = 'Add RPC'
          document.body.appendChild(rpc)
        }, 80)
      })

      await expect(waitForIntegrationCategoryReady(page, 2000)).resolves.toBeUndefined()
    })

    test('resolves when add-mcp transitions from display:none to visible', async ({ page }) => {
      await page.route('**/*', serveHtml(CSS_HIDDEN_MCP))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const el = document.querySelector('[data-type="add-mcp"]') as HTMLElement | null
          if (el) el.style.display = ''
        }, 80)
      })

      await expect(waitForIntegrationCategoryReady(page, 2000)).resolves.toBeUndefined()
    })

    test('resolves when add-rpc transitions from display:none to visible', async ({ page }) => {
      await page.route('**/*', serveHtml(CSS_HIDDEN_RPC))
      await page.goto('/')

      await page.evaluate(() => {
        setTimeout(() => {
          const el = document.querySelector('[data-type="add-rpc"]') as HTMLElement | null
          if (el) el.style.display = ''
        }, 80)
      })

      await expect(waitForIntegrationCategoryReady(page, 2000)).resolves.toBeUndefined()
    })
  })

  test.describe('timeout parameterisation', () => {
    test('accepts and respects a caller-supplied timeout', async ({ page }) => {
      await page.route('**/*', serveHtml(NEITHER))
      await page.goto('/')
      const start = Date.now()
      await expect(waitForIntegrationCategoryReady(page, 400)).rejects.toThrow()
      expect(Date.now() - start).toBeGreaterThanOrEqual(400)
    })
  })

  test.describe('css visibility model', () => {
    test('rejects when both buttons are hidden via display:none', async ({ page }) => {
      await page.route('**/*', serveHtml(CSS_HIDDEN_BOTH))
      await page.goto('/')
      await expect(waitForIntegrationCategoryReady(page, 400)).rejects.toThrow()
    })

    test('rejects when both buttons are hidden via visibility:hidden', async ({ page }) => {
      await page.route('**/*', serveHtml(VISIBILITY_HIDDEN_BOTH))
      await page.goto('/')
      await expect(waitForIntegrationCategoryReady(page, 400)).rejects.toThrow()
    })

    test('resolves when both buttons have opacity:0 — opacity is not a Playwright visibility criterion', async ({
      page,
    }) => {
      await page.route('**/*', serveHtml(OPACITY_ZERO_BOTH))
      await page.goto('/')
      await expect(waitForIntegrationCategoryReady(page, 2000)).resolves.toBeUndefined()
    })

    test('rejects when only add-mcp is hidden via display:none while add-rpc is visible', async ({ page }) => {
      await page.route('**/*', serveHtml(CSS_HIDDEN_MCP))
      await page.goto('/')
      await expect(waitForIntegrationCategoryReady(page, 400)).rejects.toThrow()
    })

    test('rejects when only add-rpc is hidden via display:none while add-mcp is visible', async ({ page }) => {
      await page.route('**/*', serveHtml(CSS_HIDDEN_RPC))
      await page.goto('/')
      await expect(waitForIntegrationCategoryReady(page, 400)).rejects.toThrow()
    })
  })

  test.describe('co-render contract', () => {
    test('parallel wait resolves even when rpc renders slightly after mcp in the same DOM tick', async ({ page }) => {
      await page.route('**/*', serveHtml(NEITHER))
      await page.goto('/')

      await page.evaluate(() => {
        const mcp = document.createElement('button')
        mcp.setAttribute('data-type', 'add-mcp')
        mcp.textContent = 'Add MCP'
        document.body.appendChild(mcp)

        setTimeout(() => {
          const rpc = document.createElement('button')
          rpc.setAttribute('data-type', 'add-rpc')
          rpc.textContent = 'Add RPC'
          document.body.appendChild(rpc)
        }, 50)
      })

      await expect(waitForIntegrationCategoryReady(page, 2000)).resolves.toBeUndefined()
    })

    test('rejects when add-mcp is the only button present throughout the full timeout', async ({ page }) => {
      await page.route('**/*', serveHtml(MCP_ONLY))
      await page.goto('/')
      await expect(waitForIntegrationCategoryReady(page, 300)).rejects.toThrow()
    })

    test('rejects when add-rpc is the only button present throughout the full timeout', async ({ page }) => {
      await page.route('**/*', serveHtml(RPC_ONLY))
      await page.goto('/')
      await expect(waitForIntegrationCategoryReady(page, 300)).rejects.toThrow()
    })
  })
})
