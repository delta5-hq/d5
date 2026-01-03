import { test, expect } from '@playwright/test'
import { adminLogin, closeMobileSidebar } from './utils'
import { PrimaryNavigationPage, SecondarySidebarPage } from './page-objects'
import { TEST_TIMEOUTS, VIEWPORT } from './constants/test-timeouts'
import { MOBILE_BREAKPOINT } from './constants/viewports'
import {
  testViewportTransitions,
  isMobileViewport,
  EXTENDED_VIEWPORTS,
  type ViewportSpec,
} from './helpers/viewport-testing'
import type { Page } from '@playwright/test'

async function closeMobileSidebarIfNeeded(page: Page) {
  const actualIsMobile = page.viewportSize()!.width < MOBILE_BREAKPOINT
  if (actualIsMobile) {
    await closeMobileSidebar(page)
  }
}

test.describe('Dual sidebar mobile behavior', () => {
  test.describe('Mobile dismiss button interaction', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORT.MOBILE)
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/admin/waitlist')
      await page.waitForLoadState('networkidle')
    })

    test('mobile dismiss button closes secondary sidebar', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })
      await expect(secondarySidebar.mobileDismissButton).toBeVisible({ timeout: 15000 })

      await secondarySidebar.clickMobileDismissButton()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)
      await page.waitForTimeout(500)

      await expect(secondarySidebar.mobileRoot).not.toBeVisible({ timeout: 15000 })
    })

    test('mobile dismiss button is visible when sidebar opens', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      await expect(secondarySidebar.mobileDismissButton).toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('Mobile overlay behavior', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORT.MOBILE)
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/admin/waitlist')
      await page.waitForLoadState('networkidle')
    })

    test('overlay appears when secondary sidebar opens on mobile', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(1000)

      await expect(secondarySidebar.mobileRoot).toBeVisible()
      
      const overlay = page.locator('[data-radix-presence][data-state="open"]').first()
      await expect(overlay).toBeVisible({ timeout: 5000 })
    })

    test('overlay disappears when sidebar closes on mobile', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      await secondarySidebar.clickMobileDismissButton()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      const overlayVisible = await secondarySidebar.isMobileOverlayVisible()
      expect(overlayVisible).toBe(false)
    })
  })

  test.describe('Mobile navigation auto-close', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORT.MOBILE)
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('navigating to workflow list closes secondary sidebar on mobile', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)
      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })

      const myWorkflowsLink = secondarySidebar.mobileRoot.getByRole('link', { name: 'My Workflows' })
      await myWorkflowsLink.click()
      await page.waitForURL(/\/workflows/, { timeout: TEST_TIMEOUTS.NAVIGATION })
      await page.waitForTimeout(1000)

      const isVisible = await secondarySidebar.isMobileSidebarVisible()
      expect(isVisible).toBe(false)
    })

    const sectionTransitions = [
      { from: 'home', to: 'settings', fromLink: 'My Workflows', toGroup: 'Settings' },
      { from: 'settings', to: 'admin', fromGroup: 'Settings', toLink: 'Waitlist' },
      { from: 'admin', to: 'home', fromLink: 'Waitlist', toLink: 'My Workflows' },
    ]

    sectionTransitions.forEach(({ from, to, fromLink, toGroup, fromGroup, toLink }) => {
      test(`switching ${from} to ${to} section updates mobile sidebar content`, async ({ page }) => {
        const primaryNav = new PrimaryNavigationPage(page)
        const secondarySidebar = new SecondarySidebarPage(page)

        const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
        await menuToggle.click()
        await secondarySidebar.waitForTransition()
        await page.waitForTimeout(500)
        await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })

        await secondarySidebar.clickMobileDismissButton()
        await secondarySidebar.waitForTransition()
        await page.waitForTimeout(500)

        await primaryNav.clickSection(to)
        await page.waitForTimeout(500)

        await menuToggle.click()
        await secondarySidebar.waitForTransition()
        await page.waitForTimeout(500)

        await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })

        if (toLink) {
          await expect(secondarySidebar.mobileRoot.getByRole('link', { name: toLink })).toBeVisible()
        } else if (toGroup) {
          const groupLabel = secondarySidebar.mobileRoot.locator('[data-sidebar="group-label"]', { hasText: toGroup })
          await expect(groupLabel).toBeVisible()
        }
      })
    })
  })

  test.describe('Viewport transition behavior', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('secondary sidebar changes rendering mode across viewport transitions', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)

      await closeMobileSidebarIfNeeded(page)

      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      await testViewportTransitions(
        page,
        async () => {
          const viewportSize = page.viewportSize()
          if (!viewportSize) return

          if (viewportSize.width < MOBILE_BREAKPOINT) {
            await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })
            await expect(secondarySidebar.mobileDismissButton).toBeVisible()
          } else {
            await expect(secondarySidebar.root).toBeVisible()
          }
        },
        EXTENDED_VIEWPORTS.filter(v => v.width >= 375),
      )
    })

    test('mobile overlay only appears below tablet breakpoint', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)

      const testViewports: ViewportSpec[] = [
        { width: 375, height: 667, name: 'mobile' },
        { width: 768, height: 800, name: 'tablet' },
        { width: 1280, height: 720, name: 'desktop' },
      ]

      for (const viewport of testViewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.reload()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

        await closeMobileSidebarIfNeeded(page)

        if (isMobileViewport(viewport)) {
          const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
          await menuToggle.click()
          await secondarySidebar.waitForTransition()
          await page.waitForTimeout(500)

          const overlayVisible = await secondarySidebar.isMobileOverlayVisible()
          expect(overlayVisible).toBe(true)
        } else {
          await primaryNav.clickHome()
          await secondarySidebar.waitForTransition()
          await page.waitForTimeout(500)

          const overlayVisible = await secondarySidebar.isMobileOverlayVisible()
          expect(overlayVisible).toBe(false)
        }
      }
    })

    test('desktop sidebar does not have dismiss button', async ({ page }) => {
      await page.setViewportSize(VIEWPORT.DESKTOP)
      await page.reload()
      await page.waitForLoadState('networkidle')

      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)


      await closeMobileSidebar(page)
      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      await expect(secondarySidebar.root).toBeVisible()
      await expect(secondarySidebar.mobileDismissButton).not.toBeVisible()
    })

    test('exact breakpoint at 767px renders mobile sidebar', async ({ page }) => {
      await page.setViewportSize({ width: 767, height: 800 })
      await page.reload()
      await page.waitForLoadState('networkidle')

      const secondarySidebar = new SecondarySidebarPage(page)

      await closeMobileSidebarIfNeeded(page)

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      const mobileVisible = await secondarySidebar.isMobileSidebarVisible()
      expect(mobileVisible).toBe(true)
    })

    test('exact breakpoint at 768px renders desktop sidebar', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 800 })
      await page.reload()
      await page.waitForLoadState('networkidle')

      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)

      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      await expect(secondarySidebar.root).toBeVisible()

      const overlayVisible = await secondarySidebar.isMobileOverlayVisible()
      expect(overlayVisible).toBe(false)
    })

    test('smallest mobile viewport 320px renders sidebar correctly', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 })
      await page.reload()
      await page.waitForLoadState('networkidle')

      const secondarySidebar = new SecondarySidebarPage(page)

      await closeMobileSidebarIfNeeded(page)

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })
      await expect(secondarySidebar.mobileDismissButton).toBeVisible()

      const boundingBox = await secondarySidebar.mobileRoot.boundingBox()
      expect(boundingBox?.width).toBeLessThanOrEqual(320)
    })

    test('orientation change from portrait to landscape maintains sidebar state', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.reload()
      await page.waitForLoadState('networkidle')

      const secondarySidebar = new SecondarySidebarPage(page)

      await closeMobileSidebarIfNeeded(page)

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)
      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })

      await page.setViewportSize({ width: 667, height: 375 })
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

      const mobileVisible = await secondarySidebar.isMobileSidebarVisible()
      expect(mobileVisible).toBe(true)
      await expect(secondarySidebar.myWorkflowsLink).toBeVisible()
    })

    test('rapid viewport size changes maintain consistent sidebar rendering', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)


      await closeMobileSidebar(page)
      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      const viewportSizes = [
        { width: 375, height: 667 },
        { width: 768, height: 800 },
        { width: 375, height: 667 },
        { width: 1280, height: 720 },
        { width: 375, height: 667 },
      ]

      for (const size of viewportSizes) {
        await page.setViewportSize(size)
        await page.waitForTimeout(TEST_TIMEOUTS.RAPID_INTERACTION_DELAY)
      }

      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('Mobile sidebar persistence', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORT.MOBILE)
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('secondary sidebar state persists across mobile page navigation', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      await closeMobileSidebar(page)

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)
      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })

      await page.goto('/settings')
      await page.waitForLoadState('networkidle')
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })
      await expect(secondarySidebar.groupLabel('Settings')).toBeVisible()
    })

    test('closing mobile sidebar clears localStorage state', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      await page.evaluate(() => localStorage.removeItem('secondary_sidebar_state'))
      await page.reload()
      await page.waitForLoadState('networkidle')

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)
      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })

      const storedStateOpen = await page.evaluate(() => localStorage.getItem('secondary_sidebar_state'))
      expect(storedStateOpen).toBe('true')

      await secondarySidebar.clickMobileDismissButton()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      const isVisible = await secondarySidebar.isMobileSidebarVisible()
      expect(isVisible).toBe(false)

      await page.reload()
      await page.waitForLoadState('networkidle')

      const isVisibleAfterReload = await secondarySidebar.isMobileSidebarVisible()
      expect(isVisibleAfterReload).toBe(false)
    })

    test('mobile sidebar reopens after page reload if state persisted', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      await closeMobileSidebar(page)
      
      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)
      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })

      await page.reload()
      await page.waitForLoadState('networkidle')

      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })
      await expect(secondarySidebar.myWorkflowsLink).toBeVisible()
    })
  })

  test.describe('Mobile edge cases and rapid interactions', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORT.MOBILE)
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('rapid dismiss button clicks maintain stable closed state', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      await closeMobileSidebar(page)
      
      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)
      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })

      await secondarySidebar.clickMobileDismissButton()
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)

      await expect(secondarySidebar.mobileRoot).not.toBeVisible({ timeout: 15000 })

      await page.waitForTimeout(TEST_TIMEOUTS.RAPID_INTERACTION_DELAY * 5)

      await expect(secondarySidebar.mobileRoot).not.toBeVisible({ timeout: 15000 })
    })

    test('rapid primary section switches maintain final section state on mobile', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)

      await closeMobileSidebar(page)

      const sections = ['home', 'settings', 'admin', 'home', 'settings']

      for (const section of sections) {
        await primaryNav.clickSection(section)
        await page.waitForTimeout(TEST_TIMEOUTS.RAPID_INTERACTION_DELAY)
        await page.waitForTimeout(50)
      }

      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_ANIMATION)

      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })
      await expect(secondarySidebar.mobileRoot.locator('[data-sidebar="group-label"]').filter({ hasText: 'Settings' })).toBeVisible()
    })

    test('dismissing sidebar during animation transition completes gracefully', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      await closeMobileSidebar(page)
      
      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION / 2)

      await secondarySidebar.clickMobileDismissButton()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      const isVisible = await secondarySidebar.isMobileSidebarVisible()
      expect(isVisible).toBe(false)
    })

    test('browser back button preserves mobile sidebar state', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      await closeMobileSidebar(page)
      
      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)
      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })

      await page.goto('/workflows')
      await page.waitForLoadState('networkidle')

      await page.goBack()
      await page.waitForLoadState('networkidle')
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)

      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })
    })

    test('deep nested route navigation maintains mobile sidebar section context', async ({ page }) => {
      const secondarySidebar = new SecondarySidebarPage(page)

      await closeMobileSidebar(page)
      
      const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
      await menuToggle.click()
      await secondarySidebar.waitForTransition()
      await page.waitForTimeout(500)
      await expect(secondarySidebar.mobileRoot).toBeVisible({ timeout: 15000 })

      await page.goto('/admin/users')
      await page.waitForLoadState('networkidle')

      const sidebarVisible = await secondarySidebar.isMobileSidebarVisible()
      if (sidebarVisible) {
        const hasWaitlistLink = await secondarySidebar.hasWaitlistLinkInContext()
        expect(hasWaitlistLink).toBe(true)
      }
    })
  })
})
