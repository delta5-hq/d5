import { test, expect } from '@playwright/test'
import { adminLogin } from './utils'
import { PrimaryNavigationPage, SecondarySidebarPage } from './page-objects'
import { TEST_TIMEOUTS, VIEWPORT } from './constants/test-timeouts'

test.describe('Primary nav active state on child routes', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT.DESKTOP)
    await page.goto('/')
    await adminLogin(page)
    await page.waitForLoadState('networkidle')
  })

  test('home is active when navigating to /workflows', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)

    await page.goto('/workflows')
    await page.waitForLoadState('networkidle')

    await expect(primaryNav.activeItem('home')).toBeVisible()
  })

  test('home is active when navigating to /templates', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)

    await page.goto('/templates')
    await page.waitForLoadState('networkidle')

    await expect(primaryNav.activeItem('home')).toBeVisible()
  })

  test('home is active at root /', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(primaryNav.activeItem('home')).toBeVisible()
  })

  test('home is inactive on unrelated routes', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await expect(primaryNav.inactiveItem('home')).toBeVisible()
    await expect(primaryNav.activeItem('settings')).toBeVisible()
  })

  test('admin is active on /admin/waitlist child route', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)

    await page.goto('/admin/waitlist')
    await page.waitForLoadState('networkidle')

    await expect(primaryNav.activeItem('admin')).toBeVisible()
    await expect(primaryNav.inactiveItem('home')).toBeVisible()
  })

  test('only one primary nav item is active per route', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)

    await page.goto('/workflows')
    await page.waitForLoadState('networkidle')

    await expect(primaryNav.allActiveItems).toHaveCount(1)
  })

  test('active primary nav item renders highlighted indicator bar', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)

    await page.goto('/workflows')
    await page.waitForLoadState('networkidle')

    await expect(primaryNav.activeItem('home')).toBeVisible()
    expect(await primaryNav.hasVisibleIndicatorBar('home')).toBe(true)
  })

  test('inactive primary nav item has no indicator bar', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)

    await page.goto('/workflows')
    await page.waitForLoadState('networkidle')

    await expect(primaryNav.inactiveItem('settings')).toBeVisible()
    expect(await primaryNav.hasVisibleIndicatorBar('settings')).toBe(false)
  })
})

test.describe('Secondary sidebar active item hover styling', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT.DESKTOP)
    await page.goto('/')
    await adminLogin(page)
    await page.waitForLoadState('networkidle')
  })

  test('active menu item hover produces readable text contrast', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)
    const secondarySidebar = new SecondarySidebarPage(page)

    await primaryNav.clickHome()
    await secondarySidebar.waitForTransition()
    await secondarySidebar.clickMyWorkflows()
    await page.waitForURL('/workflows', { timeout: TEST_TIMEOUTS.NAVIGATION })

    const menuButton = secondarySidebar.menuButtonByText('My Workflows')
    await expect(menuButton).toBeVisible()

    await menuButton.hover()
    await page.waitForTimeout(TEST_TIMEOUTS.RAPID_INTERACTION_DELAY)

    const { textColor, backgroundColor } = await menuButton.evaluate(button => {
      const textSpan = button.querySelector('span')
      const textStyle = textSpan ? getComputedStyle(textSpan) : getComputedStyle(button)
      const bgStyle = getComputedStyle(button)
      return {
        textColor: textStyle.color,
        backgroundColor: bgStyle.backgroundColor,
      }
    })

    expect(textColor).not.toBe(backgroundColor)
  })

  test('active menu item indicator bar has no gap to container edge', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)
    const secondarySidebar = new SecondarySidebarPage(page)

    await primaryNav.clickHome()
    await secondarySidebar.waitForTransition()
    await secondarySidebar.clickMyWorkflows()
    await page.waitForURL('/workflows', { timeout: TEST_TIMEOUTS.NAVIGATION })

    const menuItem = secondarySidebar.menuItemByText('My Workflows')
    await expect(menuItem).toBeVisible()

    const { itemRightEdge, sidebarRightEdge } = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="secondary-sidebar"]')
      const items = sidebar?.querySelectorAll('[data-sidebar="menu-item"]') ?? []
      let activeItem: Element | null = null
      for (const item of items) {
        if (item.querySelector('a[href="/workflows"]')) {
          activeItem = item
          break
        }
      }
      if (!activeItem || !sidebar) return { itemRightEdge: 0, sidebarRightEdge: 0 }
      const itemRect = activeItem.getBoundingClientRect()
      const sidebarRect = sidebar.getBoundingClientRect()
      return {
        itemRightEdge: Math.round(itemRect.right),
        sidebarRightEdge: Math.round(sidebarRect.right),
      }
    })

    const gap = Math.abs(sidebarRightEdge - itemRightEdge)
    expect(gap).toBeLessThanOrEqual(1)
  })

  test('active menu item hover rounds right corners flush with indicator bar', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)
    const secondarySidebar = new SecondarySidebarPage(page)

    await primaryNav.clickHome()
    await secondarySidebar.waitForTransition()
    await secondarySidebar.clickMyWorkflows()
    await page.waitForURL('/workflows', { timeout: TEST_TIMEOUTS.NAVIGATION })

    const menuButton = secondarySidebar.menuButtonByText('My Workflows')
    await expect(menuButton).toBeVisible()

    const classString = await menuButton.getAttribute('class') ?? ''
    expect(classString).toContain('hover:rounded-r-none')
    expect(classString).not.toContain('hover:rounded-l-none')
  })

  test('inactive menu item does not have indicator bar', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)
    const secondarySidebar = new SecondarySidebarPage(page)

    await primaryNav.clickHome()
    await secondarySidebar.waitForTransition()
    await secondarySidebar.clickMyWorkflows()
    await page.waitForURL('/workflows', { timeout: TEST_TIMEOUTS.NAVIGATION })

    const templatesItem = secondarySidebar.menuItemByText('My templates')
    await expect(templatesItem).toBeVisible()

    const hasIndicatorBar = await templatesItem.evaluate(li => {
      const after = getComputedStyle(li, '::after')
      return after.content !== 'none' && after.content !== ''
    })

    expect(hasIndicatorBar).toBe(false)
  })
})
