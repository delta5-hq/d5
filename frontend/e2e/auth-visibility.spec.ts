import { test, expect } from '@playwright/test'
import { adminLogin, closeMobileSidebar } from './utils'
import { CreateWorkflowActionsPage, UserMenuPage } from './page-objects'
import { VIEWPORT } from './constants/test-timeouts'

test.describe('Auth-dependent UI visibility', () => {
  test.describe('Unauthenticated state', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('user menu trigger hidden in sidebar footer', async ({ page }) => {
      await page.setViewportSize(VIEWPORT.DESKTOP)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const primarySidebar = page.locator('[data-testid="primary-sidebar"]')
      await expect(primarySidebar).toBeVisible()

      const userMenuTrigger = page.locator('[data-testid="user-menu-trigger"]')
      await expect(userMenuTrigger).toHaveCount(0)
    })

    test('create workflow action hidden', async ({ page }) => {
      const createNav = page.locator('[data-testid="primary-nav-create"]')
      await expect(createNav).toHaveCount(0)
    })
  })

  test.describe('Authenticated state', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('login button hidden in header', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.goto('/workflows')

      await expect(page.locator('[data-type="login"]')).toHaveCount(0)
    })

    test('user menu trigger visible in sidebar footer', async ({ page }) => {
      await page.setViewportSize(VIEWPORT.DESKTOP)
      
      const userMenu = new UserMenuPage(page)
      await expect(userMenu.menuTrigger).toBeVisible()
    })

    test('user menu popover opens on trigger click', async ({ page }) => {
      await page.setViewportSize(VIEWPORT.DESKTOP)
      
      const userMenu = new UserMenuPage(page)
      await userMenu.openUserMenu()
      await expect(userMenu.popoverContainer).toBeVisible()
    })

    test('create workflow action visible', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.goto('/workflows')
      
      const createActions = new CreateWorkflowActionsPage(page)
      await expect(createActions.createNavItem).toBeVisible()
    })

    test('desktop shows user controls, no login button', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.goto('/workflows')

      await expect(page.locator('[data-type="login"]')).toHaveCount(0)
      
      const userMenu = new UserMenuPage(page)
      await expect(userMenu.menuTrigger).toBeVisible()
      await expect(page.locator('button:has(svg.lucide-circle-question-mark)')).toBeVisible()
    })

    test('mobile shows create workflow, no login button', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/workflows')
      await closeMobileSidebar(page)

      await expect(page.locator('[data-type="login"]')).toHaveCount(0)
      
      const createActions = new CreateWorkflowActionsPage(page)
      await expect(createActions.createNavItem).toBeVisible()
    })

    test('mobile sidebar shows user controls when authenticated', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/workflows')

      const userMenu = new UserMenuPage(page)
      await expect(userMenu.menuTrigger).toBeVisible()

      await expect(page.locator('[data-type="login"]')).toHaveCount(0)
    })
  })
})
