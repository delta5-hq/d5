import { test, expect } from '@playwright/test'
import { adminLogin } from './utils'
import { VIEWPORT } from './constants/test-timeouts'

test.describe('User footer visibility based on auth - Issue #329', () => {
  test('unauthorized user should NOT see user icon in primary sidebar footer', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.DESKTOP)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const primarySidebar = page.locator('[data-testid="primary-sidebar"]')
    await expect(primarySidebar).toBeVisible()

    const userFooterIcon = primarySidebar.locator('button').filter({ has: page.locator('svg.lucide-user') })
    await expect(userFooterIcon).toHaveCount(0)
  })

  test('authorized user SHOULD see user icon in primary sidebar footer', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.DESKTOP)
    await page.goto('/')
    await adminLogin(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const primarySidebar = page.locator('[data-testid="primary-sidebar"]')
    await expect(primarySidebar).toBeVisible()

    const userFooterIcon = primarySidebar.locator('button').filter({ has: page.locator('svg.lucide-user') })
    await expect(userFooterIcon).toBeVisible()
  })

  test('user icon should trigger user popover when clicked', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.DESKTOP)
    await page.goto('/')
    await adminLogin(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const primarySidebar = page.locator('[data-testid="primary-sidebar"]')
    const userFooterIcon = primarySidebar.locator('button').filter({ has: page.locator('svg.lucide-user') })
    
    await userFooterIcon.click()
    await page.waitForTimeout(300)

    const userPopover = page.locator('[data-type="user-settings"]')
    await expect(userPopover).toBeVisible()
  })
})
