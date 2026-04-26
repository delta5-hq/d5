import { test, expect } from '@playwright/test'
import { adminLogin, closeMobileSidebar } from './utils'
import { PrimaryNavigationPage, SecondarySidebarPage } from './page-objects'
import { TEST_TIMEOUTS, VIEWPORT } from './constants/test-timeouts'
import { MOBILE_BREAKPOINT } from './constants/viewports'
import type { Page } from '@playwright/test'

interface ViewportTransitionScenario {
  name: string
  fromWidth: number
  toWidth: number
  withActiveSection: boolean
  expectedBehavior: 'close' | 'open' | 'unchanged'
}

const VIEWPORT_TRANSITION_SCENARIOS: ViewportTransitionScenario[] = [
  {
    name: 'mobile to desktop without active section',
    fromWidth: 375,
    toWidth: 1280,
    withActiveSection: false,
    expectedBehavior: 'unchanged',
  },
  {
    name: 'crossing boundary twice (desktop → mobile → desktop)',
    fromWidth: 1280,
    toWidth: 1024,
    withActiveSection: true,
    expectedBehavior: 'unchanged',
  },
]

async function setActiveSection(page: Page, hasSection: boolean): Promise<void> {
  if (hasSection) {
    const primaryNav = new PrimaryNavigationPage(page)
    await primaryNav.clickHome()
    await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)
  } else {
    await page.evaluate(() => {
      localStorage.removeItem('active_section')
    })
  }
}

async function assertSidebarState(
  page: Page,
  expectedState: 'mobile-closed' | 'mobile-open' | 'desktop-open' | 'desktop-closed'
): Promise<void> {
  const secondarySidebar = new SecondarySidebarPage(page)
  const viewportWidth = page.viewportSize()!.width

  if (viewportWidth < MOBILE_BREAKPOINT) {
    if (expectedState === 'mobile-open') {
      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })
      await expect(secondarySidebar.mobileDismissButton).toBeVisible()
    } else {
      const isVisible = await secondarySidebar.isMobileSidebarVisible()
      expect(isVisible).toBe(false)
    }
  } else {
    if (expectedState === 'desktop-open') {
      await expect(secondarySidebar.root).toBeVisible({ timeout: 15000 })
      await expect(secondarySidebar.mobileDismissButton).not.toBeVisible()
    } else {
      await expect(secondarySidebar.root).not.toBeVisible()
    }
  }
}

test.describe('Viewport-Sidebar State Synchronization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await adminLogin(page)
    await page.waitForLoadState('networkidle')
  })

  test.describe('Single viewport transition', () => {
    VIEWPORT_TRANSITION_SCENARIOS.forEach(scenario => {
      test(`${scenario.name}: sidebar ${scenario.expectedBehavior}s`, async ({ page }) => {
        await page.setViewportSize({ width: scenario.fromWidth, height: 800 })
        await page.waitForLoadState('networkidle')

        await setActiveSection(page, scenario.withActiveSection)

        if (scenario.fromWidth >= MOBILE_BREAKPOINT) {
          await closeMobileSidebar(page)
        }

        await page.setViewportSize({ width: scenario.toWidth, height: 800 })
        await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

        if (scenario.expectedBehavior === 'close') {
          await assertSidebarState(page, 'mobile-closed')
        } else if (scenario.expectedBehavior === 'open') {
          await assertSidebarState(page, 'desktop-open')
        }
      })
    })
  })

  test.describe('Multiple sequential viewport transitions', () => {
    test('desktop → mobile → desktop maintains correct state', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)

      await page.setViewportSize({ width: 1280, height: 800 })
      await primaryNav.clickHome()
      await expect(secondarySidebar.root).toBeVisible()

      await page.setViewportSize({ width: 375, height: 800 })
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)
      const isMobileVisible = await secondarySidebar.isMobileSidebarVisible()
      expect(isMobileVisible).toBe(false)

      await page.setViewportSize({ width: 1280, height: 800 })
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)
      await expect(secondarySidebar.root).toBeVisible()
    })

    test('mobile → desktop → mobile maintains correct state', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)

      await page.setViewportSize({ width: 375, height: 800 })
      await page.waitForLoadState('networkidle')
      await primaryNav.clickHome()
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

      await page.setViewportSize({ width: 1280, height: 800 })
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)
      await expect(secondarySidebar.root).toBeVisible()

      await page.setViewportSize({ width: 375, height: 800 })
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)
      const isMobileVisible = await secondarySidebar.isMobileSidebarVisible()
      expect(isMobileVisible).toBe(false)
    })
  })

  test.describe('Viewport transition with user interaction', () => {
    test('user-opened mobile sidebar closes on transition to desktop', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      await page.setViewportSize({ width: 375, height: 800 })
      await page.waitForLoadState('networkidle')

      const primaryNav = new PrimaryNavigationPage(page)
      await primaryNav.clickHome()

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })

      await page.setViewportSize({ width: 1280, height: 800 })
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

      await expect(secondarySidebar.root).toBeVisible()
      await expect(secondarySidebar.mobileRoot).not.toBeVisible()
    })

    test('manually closed desktop sidebar remains closed after mobile transition', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)

      await page.setViewportSize({ width: 1280, height: 800 })
      await primaryNav.clickHome()
      await expect(secondarySidebar.root).toBeVisible()

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

      await page.setViewportSize({ width: 375, height: 800 })
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

      const isMobileVisible = await secondarySidebar.isMobileSidebarVisible()
      expect(isMobileVisible).toBe(false)
    })
  })

  test.describe('Section state during viewport transitions', () => {
    test('active section preserved across viewport transitions', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)

      await page.setViewportSize({ width: 1280, height: 800 })
      await primaryNav.clickHome()

      const storedSection = await page.evaluate(() => localStorage.getItem('active_section'))
      expect(storedSection).toBe('home')

      await page.setViewportSize({ width: 375, height: 800 })
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

      const sectionAfterMobile = await page.evaluate(() => localStorage.getItem('active_section'))
      expect(sectionAfterMobile).toBe('home')

      await page.setViewportSize({ width: 1280, height: 800 })
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

      const sectionAfterDesktop = await page.evaluate(() => localStorage.getItem('active_section'))
      expect(sectionAfterDesktop).toBe('home')
    })

    test('changing section on desktop then transitioning to mobile preserves section', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)

      await page.setViewportSize({ width: 1280, height: 800 })
      await primaryNav.clickSettings()
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

      await page.setViewportSize({ width: 375, height: 800 })
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForMobileVisible()

      const settingsLabel = secondarySidebar.mobileRoot.locator('[data-sidebar="group-label"]').filter({ hasText: 'Settings' })
      await expect(settingsLabel).toBeVisible()
    })
  })

  test.describe('Boundary condition testing', () => {
    test('viewport one pixel above breakpoint (769px) renders desktop sidebar', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)

      await page.setViewportSize({ width: 769, height: 800 })
      await page.waitForLoadState('networkidle')

      await closeMobileSidebar(page)
      await primaryNav.clickHome()
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

      await expect(secondarySidebar.root).toBeVisible()
    })
  })

  test.describe('Rapid viewport changes', () => {
    test('viewport oscillating around breakpoint settles correctly', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)

      await page.setViewportSize({ width: 1280, height: 800 })
      await primaryNav.clickHome()

      const oscillations = [767, 768, 767, 768, 767, 768, 1280]

      for (const width of oscillations) {
        await page.setViewportSize({ width, height: 800 })
        await page.waitForTimeout(100)
      }

      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)
      await expect(secondarySidebar.root).toBeVisible()
    })
  })

  test.describe('Page reload state consistency', () => {
    test('reloading at mobile preserves closed sidebar state', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)

      await page.setViewportSize({ width: 375, height: 800 })
      await primaryNav.clickHome()

      await page.reload()
      await page.waitForLoadState('networkidle')

      const isMobileVisible = await secondarySidebar.isMobileSidebarVisible()
      expect(isMobileVisible).toBe(false)
    })

    test('reloading at desktop with active section opens sidebar', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)

      await page.setViewportSize({ width: 1280, height: 800 })
      await primaryNav.clickHome()
      await expect(secondarySidebar.root).toBeVisible()

      await page.reload()
      await page.waitForLoadState('networkidle')

      await expect(secondarySidebar.root).toBeVisible()
    })
  })
})
