import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { WorkflowTreePage } from '../page-objects'
import { TIMEOUTS } from '../config/test-timeouts'
import { COMMODITY_FULL_SUCCESS_SUFFIX_RE, COMMODITY_OUTCOME_SUFFIX_RE, VALIDATE_FAIL_RE } from './suffix-patterns'
import { persistedChildTitles } from './snapshot'
import { nodeTitle, awaitNodeTitle } from './node-interaction'

export async function expectRootWithCommodityChildren(tree: WorkflowTreePage, n: number): Promise<void> {
  await expect(tree.nodes).toHaveCount(n + 1, { timeout: TIMEOUTS.BACKEND_SYNC })
}

export async function expectCommodityFullSuccess(
  page: Page,
  tree: WorkflowTreePage,
  rootId: string,
  n: number,
): Promise<void> {
  await awaitNodeTitle(page, rootId, COMMODITY_FULL_SUCCESS_SUFFIX_RE(n))
  expect(await persistedChildTitles(page, rootId)).toHaveLength(n)
  await expectRootWithCommodityChildren(tree, n)
}

export async function expectCommodityOutcomeMatchesChildren(
  page: Page,
  tree: WorkflowTreePage,
  rootId: string,
  expectedTotal: number,
): Promise<void> {
  const title = await awaitNodeTitle(page, rootId, COMMODITY_OUTCOME_SUFFIX_RE)
  const match = title.match(COMMODITY_OUTCOME_SUFFIX_RE)
  expect(match).not.toBeNull()

  const [, successText, totalText] = match as RegExpMatchArray
  const successCount = Number(successText)
  const total = Number(totalText)

  expect(total).toBe(expectedTotal)
  expect(successCount).toBeGreaterThanOrEqual(0)
  expect(successCount).toBeLessThanOrEqual(expectedTotal)
  expect(await persistedChildTitles(page, rootId)).toHaveLength(successCount)
  await expect(tree.nodes).toHaveCount(successCount + 1, { timeout: TIMEOUTS.BACKEND_SYNC })
}

export async function expectNoCommodityTokenInChildren(page: Page, tree: WorkflowTreePage): Promise<void> {
  const count = await tree.nodes.count()
  for (let i = 1; i < count; i++) {
    const childId = await tree.nodeIdAt(i)
    expect(await nodeTitle(page, childId)).not.toContain(':n=')
  }
}

export async function expectValidateFailure(page: Page, validateId: string): Promise<void> {
  await awaitNodeTitle(page, validateId, VALIDATE_FAIL_RE)
}
