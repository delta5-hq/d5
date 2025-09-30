import { test, expect } from '@playwright/test'

test.describe('Main navigation (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.route('**/api/v1/auth/refresh', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )
    await page.route('**/api/v1/users/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'e2e-user', name: 'E2E User', mail: 'e2e@example.com', roles: [] }),
      })
    })
    await page.goto('/')
  })

  test('sees at least one main menu item', async ({ page }) => {
    const menuItems = page.locator('[data-sidebar="menu-button"]')
    await expect(menuItems.first()).toBeVisible()
  })

  test('opens user menu, sees at least one item', async ({ page }) => {
    const userMenuButton = page.locator('button:has(svg.lucide-user)')
    await userMenuButton.click()

    const accountSettings = page.getByText('Account Settings', { exact: true })
    await expect(accountSettings).toBeVisible()
  })

  test('opens help menu, sees at least one item', async ({ page }) => {
    const helpMenuButton = page.locator('button:has(svg.lucide-circle-question-mark)')
    await helpMenuButton.click()

    const accountSettings = page.getByText('Help & Support', { exact: true })
    await expect(accountSettings).toBeVisible()
  })
})

test.describe('Sidebar behavior (tablet width)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 800 })
    await page.route('**/api/v1/auth/refresh', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )
    await page.route('**/api/v1/users/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'e2e-user', name: 'E2E User', mail: 'e2e@example.com', roles: [] }),
      })
    })
    await page.goto('/')
  })

  test('sidebar toggles between collapsed and expanded', async ({ page }) => {
    const toggleButton = page.locator('[data-sidebar="trigger"]')
    const sidebar = page.locator('[data-slot="sidebar"]')

    await expect(sidebar).toHaveAttribute('data-state', 'collapsed')

    await toggleButton.click()
    await expect(sidebar).toHaveAttribute('data-state', 'expanded')

    await toggleButton.click()
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed')
  })
})

test.describe('Main navigation (mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.route('**/api/v1/auth/refresh', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )
    await page.route('**/api/v1/users/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'e2e-user', name: 'E2E User', mail: 'e2e@example.com', roles: [] }),
      })
    })
    await page.goto('/')
  })

  test('opens side nav, sees at least one item', async ({ page }) => {
    const menuButton = page.locator('button:has(svg.lucide-menu)')
    const sidebar = page.locator('[data-slot="sidebar"]')
    await menuButton.click()

    await expect(sidebar).toHaveAttribute('data-state', 'open')

    const menuItems = page.locator('[data-sidebar="menu-item"]')
    await expect(menuItems.first()).toBeVisible()
  })

  test('opens side nav, opens user menu, sees at least one item', async ({ page }) => {
    const menuButton = page.locator('button:has(svg.lucide-menu)')
    await menuButton.click()

    const userMenuButton = page.locator('button:has(svg.lucide-user)')
    await userMenuButton.click()

    const accountSettings = page.getByText('Account Settings', { exact: true })
    await expect(accountSettings).toBeVisible()
  })

  test('opens side nav, opens help menu, sees at least one item', async ({ page }) => {
    const menuButton = page.locator('button:has(svg.lucide-menu)')
    await menuButton.click()

    const helpMenuButton = page.locator('button:has(svg.lucide-circle-question-mark)')
    await helpMenuButton.click()

    const accountSettings = page.getByText('Help & Support', { exact: true })
    await expect(accountSettings).toBeVisible()
  })
})
