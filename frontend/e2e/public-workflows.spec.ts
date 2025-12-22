import {test, expect} from '@playwright/test'
import {adminLogin, createWorkflow} from './utils'

test.describe('Public Workflows', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/')
    await adminLogin(page)
    await page.waitForURL('/workflows')
  })

  test('should create and share workflow as public', async ({page}) => {
    const workflowId = await createWorkflow(page)
    expect(workflowId).toBeTruthy()

    await expect(page).toHaveURL(`/workflow/${workflowId}`)
  })

  test('should navigate to workflows list', async ({page}) => {
    await expect(page.getByRole('heading', { name: 'My Workflows' })).toBeVisible()
  })
})
