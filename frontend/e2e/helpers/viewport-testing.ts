import { test, type Page } from '@playwright/test'

interface ViewportSpec {
  width: number
  height: number
  name: string
}

const STANDARD_VIEWPORTS: ViewportSpec[] = [
  { width: 1280, height: 720, name: 'desktop' },
  { width: 768, height: 800, name: 'tablet' },
  { width: 375, height: 667, name: 'mobile' },
]

export function testAcrossViewports(
  testName: string,
  testFn: (page: Page, viewport: ViewportSpec) => Promise<void>,
  viewports: ViewportSpec[] = STANDARD_VIEWPORTS
): void {
  viewports.forEach(viewport => {
    test(`${testName} on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await testFn(page, viewport)
    })
  })
}

export async function testViewportTransitions(
  page: Page,
  assertionFn: () => Promise<void>,
  viewports: ViewportSpec[] = STANDARD_VIEWPORTS
): Promise<void> {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await assertionFn()
  }
}

export { STANDARD_VIEWPORTS, type ViewportSpec }
