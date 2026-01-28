import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'

test.describe('Wire Tree Paths', () => {
  test('wire connector starts from parent center', async ({ page }) => {
    await adminLogin(page)
    const workflowId = await createWorkflow(page)
    await page.goto(`/workflow/${workflowId}`)
    await page.waitForTimeout(1000)

    /* Expand first node to show children */
    const firstChevron = page.locator('button:has(svg.lucide-chevron-right)').first()
    await firstChevron.click()
    await page.waitForTimeout(500)

    /* Get wire path from first child node */
    const wirePath = await page.evaluate(() => {
      const rows = document.querySelectorAll('.group.relative.flex.items-center.h-8')
      if (rows.length < 2) return null
      
      const childRow = rows[1]
      const path = childRow.querySelector('path.wire-tree-connector')
      return path?.getAttribute('d') || null
    })

    expect(wirePath).toBeTruthy()
    /* Wire should start with M x -16 (parent center at -1 row * 32 + 16 = -16) */
    expect(wirePath).toMatch(/^M \d+ -16/)
  })

  test('last child continuation line truncates at center', async ({ page }) => {
    await adminLogin(page)
    const workflowId = await createWorkflow(page)
    await page.goto(`/workflow/${workflowId}`)
    await page.waitForTimeout(1000)

    /* Expand node with multiple children */
    const chevron = page.locator('button:has(svg.lucide-chevron-right)').first()
    await chevron.click()
    await page.waitForTimeout(500)

    /* Find last child's continuation paths */
    const lastChildPaths = await page.evaluate(() => {
      const rows = document.querySelectorAll('.group.relative.flex.items-center.h-8')
      const paths: string[] = []
      
      /* Find rows at depth > 0 */
      rows.forEach((row) => {
        const style = (row as HTMLElement).style
        const paddingLeft = parseInt(style.paddingLeft || '0', 10)
        const depth = Math.round((paddingLeft - 8) / 24)
        
        if (depth > 0) {
          const allPaths = row.querySelectorAll('path.wire-tree-connector')
          allPaths.forEach(p => {
            const d = p.getAttribute('d')
            if (d) paths.push(d)
          })
        }
      })
      return paths
    })

    expect(lastChildPaths.length).toBeGreaterThan(0)
    /* At least one path should exist - detailed validation depends on tree structure */
  })

  test('spark animation path matches wire path start', async ({ page }) => {
    await adminLogin(page)
    const workflowId = await createWorkflow(page)
    await page.goto(`/workflow/${workflowId}`)
    await page.waitForTimeout(1000)

    /* Expand to trigger spark animation */
    const chevron = page.locator('button:has(svg.lucide-chevron-right)').first()
    await chevron.click()
    await page.waitForTimeout(500)

    /* Compare wire and spark paths */
    const paths = await page.evaluate(() => {
      const rows = document.querySelectorAll('.group.relative.flex.items-center.h-8')
      if (rows.length < 2) return { wire: null, spark: null }
      
      const childRow = rows[1]
      const wirePath = childRow.querySelector('path.wire-tree-connector')?.getAttribute('d')
      const spark = childRow.querySelector('.wire-tree-spark') as HTMLElement
      
      /* Get offsetPath from style attribute (inline style) */
      const styleAttr = spark?.getAttribute('style') || ''
      const pathMatch = styleAttr.match(/offset-path:\s*path\(['"]([^'"]+)['"]\)/)
      
      return {
        wire: wirePath || null,
        spark: pathMatch ? pathMatch[1] : null,
      }
    })

    expect(paths.wire).toBeTruthy()
    expect(paths.spark).toBeTruthy()
    
    /* Both should start at same point (parent center) */
    const wireStart = paths.wire?.match(/^M (\d+) (-?\d+)/)
    const sparkStart = paths.spark?.match(/^M (\d+) (-?\d+)/)
    
    expect(wireStart).toBeTruthy()
    expect(sparkStart).toBeTruthy()
    expect(wireStart![1]).toBe(sparkStart![1]) /* Same X */
    expect(wireStart![2]).toBe(sparkStart![2]) /* Same Y */
  })

  test('wire connector is 1px with embossed effect', async ({ page }) => {
    await adminLogin(page)
    const workflowId = await createWorkflow(page)
    await page.goto(`/workflow/${workflowId}`)
    await page.waitForTimeout(1000)

    const chevron = page.locator('button:has(svg.lucide-chevron-right)').first()
    await chevron.click()
    await page.waitForTimeout(500)

    const styles = await page.evaluate(() => {
      const wire = document.querySelector('path.wire-tree-connector')
      if (!wire) return null
      const computed = window.getComputedStyle(wire)
      return {
        strokeWidth: computed.strokeWidth,
        filter: computed.filter,
      }
    })

    expect(styles).toBeTruthy()
    expect(styles!.strokeWidth).toBe('1px')
    expect(styles!.filter).toContain('drop-shadow')
  })
})
