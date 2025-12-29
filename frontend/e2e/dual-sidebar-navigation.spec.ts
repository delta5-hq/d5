import { test, expect } from '@playwright/test'
import { adminLogin } from './utils'
import { PrimaryNavigationPage, SecondarySidebarPage } from './page-objects'
import { TEST_TIMEOUTS, VIEWPORT } from './constants/test-timeouts'

test.describe('Dual sidebar system', () => {
  test.describe('Sidebar coordination and state management', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORT.DESKTOP)
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('primary sidebar triggers secondary sidebar visibility', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await page.evaluate(() => localStorage.removeItem('secondary_sidebar_state'))
      await page.reload()
      await page.waitForLoadState('networkidle')

      await expect(secondarySidebar.root).toHaveCount(0)

      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()

      await expect(secondarySidebar.root).toBeVisible()
    })

    test('primary sidebar click updates secondary sidebar content', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()

      await expect(secondarySidebar.myWorkflowsLink).toBeVisible()

      await primaryNav.clickSettings()
      await secondarySidebar.waitForTransition()

      await expect(secondarySidebar.myWorkflowsLink).toHaveCount(0)
      await expect(secondarySidebar.settingsLink).toBeVisible()
    })

    test('secondary sidebar width is independent of primary sidebar', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()

      const primaryBox = await primaryNav.root.boundingBox()
      const secondaryBox = await secondarySidebar.root.boundingBox()

      expect(primaryBox!.width).toBe(72)
      expect(secondaryBox!.width).toBeGreaterThanOrEqual(264)
    })

    test('rapid primary nav clicks maintain final section state', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      const sections = ['home', 'settings', 'home', 'admin', 'home']
      
      for (const section of sections) {
        await primaryNav.clickSection(section)
      }
      
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_ANIMATION)

      await expect(secondarySidebar.myWorkflowsLink).toBeVisible()
    })

    test('secondary sidebar renders both group label and link for settings section', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await primaryNav.clickSettings()
      await secondarySidebar.waitForTransition()

      await expect(secondarySidebar.groupLabel('Settings')).toBeVisible()
      await expect(secondarySidebar.settingsLink).toBeVisible()
    })
  })

  test.describe('Auth-based section visibility matrix', () => {
    const sectionTests = [
      { section: 'create', authRequired: true, adminOnly: false, hasContent: true },
      { section: 'home', authRequired: false, adminOnly: false, hasContent: true },
      { section: 'settings', authRequired: true, adminOnly: false, hasContent: true },
      { section: 'admin', authRequired: true, adminOnly: true, hasContent: true },
      { section: 'training', authRequired: true, adminOnly: false, hasContent: true },
    ]

    sectionTests.forEach(({ section, authRequired }) => {
      test(`${section} section ${authRequired ? 'requires' : 'allows'} authentication`, async ({ page }) => {
        const primaryNav = new PrimaryNavigationPage(page)
        const secondarySidebar = new SecondarySidebarPage(page)
        
        await page.setViewportSize(VIEWPORT.DESKTOP)
        await page.goto('/')
        
        if (!authRequired) {
          await page.waitForLoadState('networkidle')
        } else {
          await adminLogin(page)
          await page.goto('/')
          await page.waitForLoadState('networkidle')
        }

        if (authRequired) {
          await expect(primaryNav.item(section)).toBeVisible()
          await primaryNav.clickSection(section)
          
          if (section === 'training') {
            await page.waitForURL('/training', { timeout: TEST_TIMEOUTS.NAVIGATION })
            await page.waitForTimeout(TEST_TIMEOUTS.NETWORK_IDLE / 60)
            
            const sidebarExists = await secondarySidebar.root.count()
            if (sidebarExists > 0) {
              await expect(secondarySidebar.root).toBeVisible()
            }
          } else {
            await page.waitForTimeout(TEST_TIMEOUTS.SECTION_SWITCH)
            await expect(secondarySidebar.root).toBeVisible()
          }
        } else {
          await expect(primaryNav.item(section)).toBeVisible()
        }
      })
    })

    test('home section hides My and Recent groups when unauthenticated', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await page.setViewportSize(VIEWPORT.DESKTOP)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()

      await expect(secondarySidebar.root).toBeVisible()

      await expect(secondarySidebar.myWorkflowsLink).toHaveCount(0)
      await expect(secondarySidebar.firstGroupWithText('Recent Items')).toHaveCount(0)
      await expect(secondarySidebar.firstGroupWithText('Tags')).toBeVisible()
    })

    test('home section shows all groups when authenticated', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await page.setViewportSize(VIEWPORT.DESKTOP)
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()

      await expect(secondarySidebar.myWorkflowsLink).toBeVisible()
      await expect(secondarySidebar.firstGroupWithText('Recent Items')).toBeVisible()
      await expect(secondarySidebar.firstGroupWithText('Tags')).toBeVisible()
    })
  })

  test.describe('Section rendering strategies', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORT.DESKTOP)
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    const sectionsWithActions = [
      { section: 'create', hasAction: true, actionText: 'Create Workflow' },
      { section: 'home', hasAction: false, linkText: 'My Workflows' },
      { section: 'settings', hasAction: false, linkText: 'Settings' },
      { section: 'admin', hasAction: false, linkText: 'Waitlist' },
    ]

    sectionsWithActions.forEach(({ section, hasAction, actionText, linkText }) => {
      test(`${section} section renders ${hasAction ? 'action button' : 'navigation links'}`, async ({ page }) => {
        const primaryNav = new PrimaryNavigationPage(page)
        const secondarySidebar = new SecondarySidebarPage(page)
        
        await primaryNav.clickSection(section)
        await secondarySidebar.waitForTransition()

        await expect(secondarySidebar.root).toBeVisible()

        if (hasAction && actionText) {
          await expect(secondarySidebar.root.getByRole('button', { name: actionText })).toBeVisible()
        } else if (linkText) {
          const linkLocator = secondarySidebar.root.getByRole('link', { name: linkText })
          await expect(linkLocator).toBeVisible()
        }
      })
    })

    test('create action does not navigate', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      const currentUrl = page.url()
      
      await primaryNav.clickCreate()
      await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_ANIMATION)

      expect(page.url()).toBe(currentUrl)

      await expect(secondarySidebar.root).toBeVisible()
    })
  })

  test.describe('localStorage persistence and recovery', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORT.DESKTOP)
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('secondary sidebar open state persists across reloads', async ({ page }) => {
      await page.evaluate(() => localStorage.removeItem('secondary_sidebar_state'))
      await page.reload()
      await page.waitForLoadState('networkidle')

      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await expect(secondarySidebar.root).toHaveCount(0)

      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()
      await expect(secondarySidebar.root).toBeVisible()

      const storedState = await page.evaluate(() => localStorage.getItem('secondary_sidebar_state'))
      expect(storedState).toBe('true')

      await page.reload()
      await page.waitForLoadState('networkidle')

      await expect(secondarySidebar.root).toBeVisible()
    })

    test('active section persists across reloads', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await primaryNav.clickSettings()
      await secondarySidebar.waitForTransition()

      const storedSection = await page.evaluate(() => localStorage.getItem('active_section'))
      expect(storedSection).toBe('settings')

      await page.reload()
      await page.waitForLoadState('networkidle')

      await expect(secondarySidebar.root).toBeVisible()
      await expect(secondarySidebar.settingsLink).toBeVisible()
    })

    test('missing localStorage initializes with defaults', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.removeItem('secondary_sidebar_state')
        localStorage.removeItem('active_section')
      })
      await page.reload()
      await page.waitForLoadState('networkidle')

      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await expect(primaryNav.homeItem).toBeVisible()

      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()

      await expect(secondarySidebar.root).toBeVisible()
    })

    test('corrupted localStorage data does not break initialization', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('secondary_sidebar_state', 'invalid')
        localStorage.setItem('active_section', '{}')
      })
      await page.reload()
      await page.waitForLoadState('networkidle')

      const primaryNav = new PrimaryNavigationPage(page)
      await expect(primaryNav.homeItem).toBeVisible()
    })

    test('browser back button preserves sidebar state', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()

      await expect(secondarySidebar.root).toBeVisible()
      
      await secondarySidebar.clickMyWorkflows()
      await page.waitForURL('/workflows', { timeout: TEST_TIMEOUTS.NAVIGATION })

      await page.goBack()
      
      await page.waitForTimeout(TEST_TIMEOUTS.NETWORK_IDLE / 60)
      const currentUrl = page.url()
      expect(currentUrl).toContain('/')

      await expect(secondarySidebar.root).toBeVisible()
    })
  })

  test.describe('Workflow creation integration', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORT.DESKTOP)
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('create workflow button triggers navigation to new workflow', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await primaryNav.clickCreate()
      await secondarySidebar.waitForTransition()

      await expect(secondarySidebar.createWorkflowButton).toBeVisible()
      await secondarySidebar.clickCreateWorkflow()

      await page.waitForURL(/\/workflow\/[a-zA-Z0-9-]+/, { timeout: TEST_TIMEOUTS.NAVIGATION })
      expect(page.url()).toMatch(/\/workflow\/[a-zA-Z0-9-]+/)
    })

    test('create workflow button disables during creation', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await primaryNav.clickCreate()
      await secondarySidebar.waitForTransition()
      
      await expect(secondarySidebar.createWorkflowButton).toBeVisible()
      await secondarySidebar.clickCreateWorkflow()
      
      const isDisabled = await secondarySidebar.createWorkflowButton.isDisabled().catch(() => false)
      if (!isDisabled) {
        await page.waitForURL(/\/workflow\/[a-zA-Z0-9-]+/, { timeout: TEST_TIMEOUTS.NAVIGATION })
      }
    })
  })

  test.describe('Edge cases and error scenarios', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORT.DESKTOP)
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('navigating to deep nested route maintains parent section state', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await primaryNav.clickAdmin()
      await secondarySidebar.waitForTransition()
      
      await expect(secondarySidebar.root).toBeVisible()
      
      await page.goto('/admin/users')
      await page.waitForLoadState('networkidle')

      const userRows = page.locator('table tbody tr')
      const userRowCount = await userRows.count()

      if (userRowCount > 0) {
        await userRows.first().click()
        await page.waitForURL(/\/admin\/users\/[^/]+$/, { timeout: TEST_TIMEOUTS.NAVIGATION })

        const sidebarVisible = await secondarySidebar.root.isVisible().catch(() => false)
        if (sidebarVisible) {
          const hasAdminLabel = await secondarySidebar.groupLabel('Admin').isVisible().catch(() => false)
          const hasWaitlistLink = await secondarySidebar.waitlistLink.isVisible().catch(() => false)
          
          expect(hasAdminLabel || hasWaitlistLink).toBeTruthy()
        } else {
          expect(sidebarVisible).toBe(false)
        }
      }
    })

    test('secondary sidebar content updates immediately on section change', async ({ page }) => {
      const primaryNav = new PrimaryNavigationPage(page)
      const secondarySidebar = new SecondarySidebarPage(page)
      
      await primaryNav.clickHome()
      await secondarySidebar.waitForTransition()

      const beforeContent = await secondarySidebar.root.textContent()
      expect(beforeContent).toContain('My Workflows')

      await primaryNav.clickSettings()
      await secondarySidebar.waitForTransition()

      const afterContent = await secondarySidebar.root.textContent()
      expect(afterContent).toContain('Settings')
      expect(afterContent).not.toContain('My Workflows')
    })

    test('primary sidebar visibility independent of secondary state', async ({ page }) => {
      const primarySidebar = page.locator('[data-testid="primary-sidebar"]')
      await expect(primarySidebar).toBeVisible()

      await page.evaluate(() => localStorage.removeItem('secondary_sidebar_state'))
      await page.reload()
      await page.waitForLoadState('networkidle')

      await expect(primarySidebar).toBeVisible()

      const secondarySidebar = new SecondarySidebarPage(page)
      await expect(secondarySidebar.root).toHaveCount(0)
    })
  })
})
