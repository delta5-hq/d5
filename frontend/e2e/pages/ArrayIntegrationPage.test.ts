import { expect, test } from '@playwright/test'

import { ArrayIntegrationPage } from './ArrayIntegrationPage'

test.describe('ArrayIntegrationPage readiness', () => {
  test('waits for a delayed mobile integrations tab before opening the RPC dialog', async ({ page }) => {
    await page.setContent('<main id="settings"></main>')

    await page.evaluate(() => {
      window.setTimeout(() => {
        const settings = document.querySelector('#settings')
        if (!settings) return

        const integrationsTab = document.createElement('button')
        integrationsTab.setAttribute('role', 'tab')
        integrationsTab.setAttribute('data-state', 'inactive')
        integrationsTab.textContent = 'Integrations'
        integrationsTab.addEventListener('click', () => {
          integrationsTab.setAttribute('data-state', 'active')

          const addIntegration = document.createElement('button')
          addIntegration.setAttribute('data-type', 'add-integration')
          addIntegration.textContent = 'Add integration'

          const addMcp = document.createElement('button')
          addMcp.setAttribute('data-type', 'add-mcp')
          addMcp.textContent = 'Add MCP'

          const addRpc = document.createElement('button')
          addRpc.setAttribute('data-type', 'add-rpc')
          addRpc.textContent = 'Add RPC'
          addRpc.addEventListener('click', () => {
            const dialog = document.createElement('div')
            dialog.setAttribute('data-dialog-name', 'rpc')
            dialog.textContent = 'RPC dialog'
            settings.append(dialog)
          })

          settings.append(addIntegration, addMcp, addRpc)
        })

        settings.append(integrationsTab)
      }, 100)
    })

    await new ArrayIntegrationPage(page).openAddDialog('rpc')

    await expect(page.locator('[data-dialog-name="rpc"]')).toBeVisible()
  })
})
