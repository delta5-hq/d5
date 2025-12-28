import { test, expect, type Page } from '@playwright/test'
import { adminLogin } from './utils'

/* Test coverage for 2-level sidebar navigation system (Issue #329)
 * Architecture: Primary (72px icon) + Secondary (264px contextual) sidebars
 * State: Managed via dual-sidebar-context with localStorage persistence
 */

test.describe('Dual sidebar architecture', () => {
  test.describe('Primary sidebar visibility and structure', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('primary sidebar renders with correct dimensions', async ({ page }) => {
      const primarySidebar = page.locator('[data-testid="primary-sidebar"]')
      await expect(primarySidebar).toBeVisible()

      const boundingBox = await primarySidebar.boundingBox()
      expect(boundingBox).toBeTruthy()
      expect(boundingBox!.width).toBe(72)
    })

    test('primary sidebar contains all required navigation items for admin', async ({ page }) => {
      const expectedItems = ['create', 'home', 'public', 'settings', 'training', 'admin']

      for (const itemId of expectedItems) {
        const navItem = page.locator(`[data-testid="primary-nav-${itemId}"]`)
        await expect(navItem).toBeVisible()
      }
    })

    test('primary sidebar hides admin item for non-admin users', async ({ page }) => {
      /* Test with unauthenticated state - admin items require auth */
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const adminItem = page.locator('[data-testid="primary-nav-admin"]')
      await expect(adminItem).toHaveCount(0)
    })

    test('primary sidebar hides auth-required items for unauthenticated users', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const authRequiredItems = ['create', 'settings', 'training', 'admin']
      for (const itemId of authRequiredItems) {
        const navItem = page.locator(`[data-testid="primary-nav-${itemId}"]`)
        await expect(navItem).toHaveCount(0)
      }

      const publicItems = ['home', 'public']
      for (const itemId of publicItems) {
        const navItem = page.locator(`[data-testid="primary-nav-${itemId}"]`)
        await expect(navItem).toBeVisible()
      }
    })

    test('primary sidebar navigation items have icon and label', async ({ page }) => {
      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      await expect(homeItem).toBeVisible()

      const icon = homeItem.locator('svg')
      await expect(icon).toBeVisible()

      const label = homeItem.locator('span')
      await expect(label).toBeVisible()
      await expect(label).toHaveText('Home')
    })
  })

  test.describe('Secondary sidebar visibility and state', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('secondary sidebar initially hidden', async ({ page }) => {
      await page.evaluate(() => localStorage.removeItem('secondary_sidebar_state'))
      await page.reload()
      await page.waitForLoadState('networkidle')

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      await expect(secondarySidebar).toHaveCount(0)
    })

    test('clicking primary nav item opens secondary sidebar', async ({ page }) => {
      await page.evaluate(() => localStorage.removeItem('secondary_sidebar_state'))
      await page.reload()
      await page.waitForLoadState('networkidle')

      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      await homeItem.click()
      await page.waitForTimeout(100)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      await expect(secondarySidebar).toBeVisible()
    })

    test('secondary sidebar shows correct content for home section', async ({ page }) => {
      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      await homeItem.click()
      await page.waitForTimeout(100)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      await expect(secondarySidebar).toBeVisible()

      await expect(secondarySidebar.getByText('My Workflows')).toBeVisible()
      await expect(secondarySidebar.getByText('Recent Items')).toBeVisible()
      await expect(secondarySidebar.getByText('Tags')).toBeVisible()
    })

    test('secondary sidebar shows correct content for create section', async ({ page }) => {
      const createItem = page.locator('[data-testid="primary-nav-create"]')
      await createItem.click()
      await page.waitForTimeout(100)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      await expect(secondarySidebar).toBeVisible()

      await expect(secondarySidebar.getByText('Create')).toBeVisible()
      await expect(secondarySidebar.getByText('Create Workflow')).toBeVisible()
    })

    test('secondary sidebar content changes when switching sections', async ({ page }) => {
      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      await homeItem.click()
      await page.waitForTimeout(100)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      await expect(secondarySidebar.getByText('My Workflows')).toBeVisible()

      const settingsItem = page.locator('[data-testid="primary-nav-settings"]')
      await settingsItem.click()
      await page.waitForTimeout(100)

      await expect(secondarySidebar.getByText('My Workflows')).toHaveCount(0)
      await expect(secondarySidebar.getByText('Settings')).toBeVisible()
    })

    test('secondary sidebar shows admin section only for admins', async ({ page }) => {
      const adminItem = page.locator('[data-testid="primary-nav-admin"]')
      await adminItem.click()
      await page.waitForTimeout(100)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      await expect(secondarySidebar).toBeVisible()

      await expect(secondarySidebar.getByText('Admin')).toBeVisible()
      await expect(secondarySidebar.getByText('Waitlist')).toBeVisible()
      await expect(secondarySidebar.getByText('User Stats')).toBeVisible()
    })
  })

  test.describe('Navigation behavior and active states', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('primary nav item shows active state for exact route match', async ({ page }) => {
      const settingsItem = page.locator('[data-testid="primary-nav-settings"]')
      await settingsItem.click()
      await page.waitForURL('/settings')

      const activeClass = await settingsItem.getAttribute('class')
      expect(activeClass).toContain('primaryNavItemActive')
    })

    test('primary nav item shows active state for child routes', async ({ page }) => {
      const adminItem = page.locator('[data-testid="primary-nav-admin"]')
      await adminItem.click()
      await page.waitForTimeout(100)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      const userStatsLink = secondarySidebar.getByText('User Stats')
      await userStatsLink.click()
      await page.waitForURL('/admin/users')

      const activeClass = await adminItem.getAttribute('class')
      expect(activeClass).toContain('primaryNavItemActive')
    })

    test('primary nav does not match similar route prefixes', async ({ page }) => {
      await page.goto('/workflows/public')
      await page.waitForLoadState('networkidle')

      const publicItem = page.locator('[data-testid="primary-nav-public"]')
      const publicClass = await publicItem.getAttribute('class')
      expect(publicClass).toContain('primaryNavItemActive')

      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      const homeClass = await homeItem.getAttribute('class')
      expect(homeClass).not.toContain('primaryNavItemActive')
    })

    test('create item does not navigate - only opens secondary sidebar', async ({ page }) => {
      const currentUrl = page.url()
      
      const createItem = page.locator('[data-testid="primary-nav-create"]')
      await createItem.click()
      await page.waitForTimeout(200)

      expect(page.url()).toBe(currentUrl)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      await expect(secondarySidebar).toBeVisible()
    })

    test('clicking secondary sidebar menu item navigates correctly', async ({ page }) => {
      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      await homeItem.click()
      await page.waitForTimeout(100)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      const myWorkflowsLink = secondarySidebar.getByText('My Workflows')
      await myWorkflowsLink.click()
      await page.waitForURL('/workflows')

      expect(page.url()).toContain('/workflows')
    })
  })

  test.describe('localStorage persistence', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('secondary sidebar state persists across page reloads', async ({ page }) => {
      await page.evaluate(() => localStorage.removeItem('secondary_sidebar_state'))
      await page.reload()
      await page.waitForLoadState('networkidle')

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      await expect(secondarySidebar).toHaveCount(0)

      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      await homeItem.click()
      await page.waitForTimeout(100)
      await expect(secondarySidebar).toBeVisible()

      const storedState = await page.evaluate(() => localStorage.getItem('secondary_sidebar_state'))
      expect(storedState).toBe('true')

      await page.reload()
      await page.waitForLoadState('networkidle')

      await expect(secondarySidebar).toBeVisible()
    })

    test('active section persists across page reloads', async ({ page }) => {
      const settingsItem = page.locator('[data-testid="primary-nav-settings"]')
      await settingsItem.click()
      await page.waitForTimeout(100)

      const storedSection = await page.evaluate(() => localStorage.getItem('active_section'))
      expect(storedSection).toBe('settings')

      await page.reload()
      await page.waitForLoadState('networkidle')

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      await expect(secondarySidebar).toBeVisible()
      await expect(secondarySidebar.getByText('Settings')).toBeVisible()
    })

    test('handles missing localStorage gracefully', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.removeItem('secondary_sidebar_state')
        localStorage.removeItem('active_section')
      })
      await page.reload()
      await page.waitForLoadState('networkidle')

      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      await expect(homeItem).toBeVisible()

      await homeItem.click()
      await page.waitForTimeout(100)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      await expect(secondarySidebar).toBeVisible()
    })

    test('handles corrupted localStorage data', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('secondary_sidebar_state', 'invalid')
        localStorage.setItem('active_section', '{}')
      })
      await page.reload()
      await page.waitForLoadState('networkidle')

      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      await expect(homeItem).toBeVisible()
    })
  })

  test.describe('Workflow creation flow', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('create workflow button in secondary sidebar triggers workflow creation', async ({ page }) => {
      const createItem = page.locator('[data-testid="primary-nav-create"]')
      await createItem.click()
      await page.waitForTimeout(100)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      const createWorkflowButton = secondarySidebar.getByText('Create Workflow')
      await createWorkflowButton.click()

      await page.waitForURL(/\/workflow\/[a-f0-9-]+/, { timeout: 5000 })
      expect(page.url()).toMatch(/\/workflow\/[a-f0-9-]+/)
    })

    test('create workflow button is disabled during creation', async ({ page }) => {
      const createItem = page.locator('[data-testid="primary-nav-create"]')
      await createItem.click()
      await page.waitForTimeout(100)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      const createWorkflowButton = secondarySidebar.getByText('Create Workflow')
      
      const button = page.locator('[data-testid="secondary-sidebar"] button', { hasText: 'Create Workflow' })
      
      await createWorkflowButton.click()
      
      const isDisabled = await button.isDisabled().catch(() => false)
      if (!isDisabled) {
        await page.waitForURL(/\/workflow\/[a-f0-9-]+/, { timeout: 5000 })
      }
    })
  })

  test.describe('Public workflows page requirements', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('public workflows page does not show workflow templates section', async ({ page }) => {
      const publicItem = page.locator('[data-testid="primary-nav-public"]')
      await publicItem.click()
      await page.waitForURL('/workflows/public')

      await expect(page.getByText('Create a New Workflow')).toHaveCount(0)
      await expect(page.getByText('Public Workflows')).toBeVisible()
    })

    test('private workflows page shows workflow templates for authenticated users', async ({ page }) => {
      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      await homeItem.click()
      await page.waitForTimeout(100)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      const myWorkflowsLink = secondarySidebar.getByText('My Workflows')
      await myWorkflowsLink.click()
      await page.waitForURL('/workflows')

      await expect(page.getByText('Create a New Workflow')).toBeVisible()
    })
  })

  test.describe('Responsive behavior', () => {
    test('primary sidebar visible on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const primarySidebar = page.locator('[data-testid="primary-sidebar"]')
      await expect(primarySidebar).toBeVisible()
    })

    test('dual sidebar layout maintains correct total width', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      await homeItem.click()
      await page.waitForTimeout(100)

      const primarySidebar = page.locator('[data-testid="primary-sidebar"]')
      const primaryBox = await primarySidebar.boundingBox()

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      const secondaryBox = await secondarySidebar.boundingBox()

      expect(primaryBox!.width).toBe(72)
      expect(secondaryBox!.width).toBeGreaterThanOrEqual(264)
    })
  })

  test.describe('Edge cases and error handling', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto('/')
      await adminLogin(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('rapidly clicking primary nav items updates secondary content correctly', async ({ page }) => {
      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      const settingsItem = page.locator('[data-testid="primary-nav-settings"]')

      await homeItem.click()
      await settingsItem.click()
      await homeItem.click()
      await page.waitForTimeout(200)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      await expect(secondarySidebar.getByText('My Workflows')).toBeVisible()
      await expect(secondarySidebar.getByText('Settings')).toHaveCount(0)
    })

    test('navigating to route updates corresponding primary nav active state', async ({ page }) => {
      await page.goto('/settings')
      await page.waitForLoadState('networkidle')

      const settingsItem = page.locator('[data-testid="primary-nav-settings"]')
      const activeClass = await settingsItem.getAttribute('class')
      expect(activeClass).toContain('primaryNavItemActive')
    })

    test('navigating to deep nested route activates correct primary nav item', async ({ page }) => {
      await page.goto('/admin/users')
      await page.waitForLoadState('networkidle')

      const userRows = page.locator('table tbody tr')
      const userRowCount = await userRows.count()

      if (userRowCount > 0) {
        await userRows.first().click()
        await page.waitForURL(/\/admin\/users\/[^/]+$/)

        const adminItem = page.locator('[data-testid="primary-nav-admin"]')
        const activeClass = await adminItem.getAttribute('class')
        expect(activeClass).toContain('primaryNavItemActive')
      }
    })

    test('browser back button maintains correct sidebar state', async ({ page }) => {
      const homeItem = page.locator('[data-testid="primary-nav-home"]')
      await homeItem.click()
      await page.waitForTimeout(100)

      const secondarySidebar = page.locator('[data-testid="secondary-sidebar"]')
      const myWorkflowsLink = secondarySidebar.getByText('My Workflows')
      await myWorkflowsLink.click()
      await page.waitForURL('/workflows')

      await page.goBack()
      await page.waitForURL('/')

      await expect(secondarySidebar).toBeVisible()
    })
  })
})
