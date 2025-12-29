import { test, expect } from '@playwright/test'
import { adminLogin } from './utils'

test.describe('Header navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await adminLogin(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('primary navigation shows at least one item', async ({ page }) => {
    const primaryNav = page.locator('[data-testid="primary-sidebar"]')
    await expect(primaryNav).toBeVisible()
    
    const navItems = primaryNav.locator('[data-testid^="primary-nav-"]')
    await expect(navItems.first()).toBeVisible()
  })

  test('opens user menu and shows settings option', async ({ page }) => {
    const userMenuButton = page.locator('[data-type="user-settings"]')
    await userMenuButton.click()

    const accountSettings = page.getByRole('menuitem', { name: 'Settings' })
    await expect(accountSettings).toBeVisible()
  })

  test('opens help menu and shows support content', async ({ page }) => {
    const helpMenuButton = page.locator('button:has(svg.lucide-circle-question-mark)')
    await helpMenuButton.click()

    const helpContent = page.getByText('Help & Support', { exact: true })
    await expect(helpContent).toBeVisible()
  })
})
