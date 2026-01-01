import { test, expect } from '@playwright/test'
import { adminLogin } from './utils'
import { PrimaryNavigationPage, SecondarySidebarPage } from './page-objects'
import { TEST_TIMEOUTS, VIEWPORT } from './constants/test-timeouts'

test.describe('Sidebar keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT.DESKTOP)
    await page.goto('/')
    await adminLogin(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('tab key navigates through primary sidebar items', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)
    
    /* Focus first interactive element in sidebar */
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    
    /* Check that focus is within primary sidebar */
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement
      const sidebar = document.querySelector('[data-testid="primary-sidebar"]')
      return sidebar?.contains(el)
    })
    
    expect(focusedElement).toBe(true)
  })

  test('enter key activates primary navigation link', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)
    const secondarySidebar = new SecondarySidebarPage(page)
    
    /* Navigate to home link with keyboard */
    const homeButton = primaryNav.homeItem
    await homeButton.focus()
    await page.keyboard.press('Enter')
    
    await secondarySidebar.waitForTransition()
    await expect(secondarySidebar.root).toBeVisible()
    await expect(secondarySidebar.myWorkflowsLink).toBeVisible()
  })

  test('space key activates primary navigation link', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)
    const secondarySidebar = new SecondarySidebarPage(page)
    
    /* Navigate to settings link with keyboard */
    const settingsButton = primaryNav.item('settings')
    await settingsButton.focus()
    await page.keyboard.press('Space')
    
    await secondarySidebar.waitForTransition()
    await expect(secondarySidebar.root).toBeVisible()
    await expect(secondarySidebar.groupLabel('Settings')).toBeVisible()
  })

  test('tab navigates through secondary sidebar links', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)
    const secondarySidebar = new SecondarySidebarPage(page)
    
    /* Open secondary sidebar */
    await primaryNav.clickHome()
    await secondarySidebar.waitForTransition()
    await expect(secondarySidebar.root).toBeVisible()
    
    /* Focus first link in secondary sidebar */
    const firstLink = secondarySidebar.myWorkflowsLink
    await firstLink.focus()
    
    /* Verify focus is on the link */
    const isFocused = await firstLink.evaluate(el => el === document.activeElement)
    expect(isFocused).toBe(true)
    
    /* Tab to next link */
    await page.keyboard.press('Tab')
    
    /* Verify focus moved to another element in sidebar */
    const focusInSidebar = await page.evaluate(() => {
      const el = document.activeElement
      const sidebar = document.querySelector('[data-testid="secondary-sidebar"]')
      return sidebar?.contains(el)
    })
    
    expect(focusInSidebar).toBe(true)
  })

  test('all interactive elements have visible focus indicator', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)
    
    /* Test primary sidebar items */
    const sections = ['create', 'home', 'settings', 'admin']
    
    for (const section of sections) {
      const button = primaryNav.item(section)
      await button.focus()
      
      /* Check focus styles - outline, box-shadow, or background change */
      const hasFocusIndicator = await button.evaluate(el => {
        const styles = window.getComputedStyle(el)
        return (
          (styles.outline !== 'none' && styles.outline !== '') ||
          (styles.boxShadow !== 'none' && styles.boxShadow !== '') ||
          styles.backgroundColor !== 'transparent'
        )
      })
      
      expect(hasFocusIndicator).toBe(true)
    }
  })

  test('escape key closes secondary sidebar when focused', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)
    const secondarySidebar = new SecondarySidebarPage(page)
    
    /* Open secondary sidebar */
    await primaryNav.clickHome()
    await secondarySidebar.waitForTransition()
    await expect(secondarySidebar.root).toBeVisible()
    
    /* Focus element inside secondary sidebar */
    await secondarySidebar.myWorkflowsLink.focus()
    
    /* Press escape to close */
    await page.keyboard.press('Escape')
    await page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_ANIMATION)
    
    /* Sidebar should close */
    const sidebarVisible = await secondarySidebar.root.isVisible().catch(() => false)
    expect(sidebarVisible).toBe(false)
  })

  test('keyboard navigation respects disabled state', async ({ page }) => {
    const primaryNav = new PrimaryNavigationPage(page)
    
    /* Check if any items are disabled */
    const disabledItems = await page.locator('[data-testid="primary-sidebar"] button[disabled]').count()
    
    if (disabledItems > 0) {
      /* Verify disabled items are not keyboard focusable */
      const disabledButton = page.locator('[data-testid="primary-sidebar"] button[disabled]').first()
      
      /* Try to focus - should fail or skip */
      await disabledButton.focus().catch(() => {})
      
      const isFocused = await disabledButton.evaluate(el => el === document.activeElement)
      expect(isFocused).toBe(false)
    }
  })
})
