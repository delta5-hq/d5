import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { WorkflowTreePage, NodeDetailPanelPage } from '../page-objects'
import { VALIDATE_VERDICT_RE, VALIDATE_FAIL_RE } from './suffix-patterns'
import { loadWorkflowSnapshot, validateTitlesOwnedByIterations } from './snapshot'
import { selectRootAndOpenDetail, addChildCommand, executeAndWaitForCompletion } from './node-interaction'

export async function assertForeachValidateContractFor(page: Page, foreachCommand: string): Promise<void> {
  const contentKeyedSentinel = 'MOCK_VALIDATE_FAIL_IF_CONTENT_CONTAINS=Beta'

  const tree = new WorkflowTreePage(page)
  const { rootId } = await selectRootAndOpenDetail(page)
  const batchId = await addChildCommand(page, tree, rootId, 'Batch')
  const alphaId = await addChildCommand(page, tree, batchId, 'Alpha')
  const betaId = await addChildCommand(page, tree, batchId, 'Beta')
  const gammaId = await addChildCommand(page, tree, batchId, 'Gamma')
  const foreachId = await addChildCommand(page, tree, batchId, foreachCommand)
  await addChildCommand(page, tree, foreachId, `/validate ${contentKeyedSentinel} — Beta fails only`)

  await tree.selectNode(foreachId)
  const foreachDetail = new NodeDetailPanelPage(page)
  await foreachDetail.waitForComponent()
  await executeAndWaitForCompletion(page, foreachDetail)

  const snapshot = await loadWorkflowSnapshot(page)
  const validateVerdicts = validateTitlesOwnedByIterations(snapshot, contentKeyedSentinel, [alphaId, betaId, gammaId])

  expect(validateVerdicts).toHaveLength(3)
  expect(validateVerdicts.filter(title => /\[✓\]/.test(title))).toHaveLength(2)
  expect(validateVerdicts.filter(title => VALIDATE_FAIL_RE.test(title))).toHaveLength(1)

  const templateNodes = Object.values(snapshot.nodes ?? {}).filter(
    n => n.parent === foreachId && String(n.title ?? '').includes(contentKeyedSentinel),
  )
  expect(templateNodes).toHaveLength(1)
  expect(String(templateNodes[0]!.title ?? '')).not.toMatch(VALIDATE_VERDICT_RE)

  const verdictsUnderForeach = Object.values(snapshot.nodes ?? {}).filter(n => {
    const title = String(n.title ?? '')
    return title.includes(contentKeyedSentinel) && n.parent === foreachId && VALIDATE_VERDICT_RE.test(title)
  })
  expect(verdictsUnderForeach).toHaveLength(0)
}
