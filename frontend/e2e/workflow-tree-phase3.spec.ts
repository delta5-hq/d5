import { test, expect, type Page, type Locator } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowTreePage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'

interface WorkflowNodeReadback {
  file?: string
  title?: string
  parent?: string
  children?: string[]
  prompts?: string[]
}

interface WorkflowReadback {
  nodes: Record<string, WorkflowNodeReadback>
}

async function seedWorkflow(page: Page, workflowId: string, nodes: Record<string, unknown>, root = 'root') {
  const response = await page.evaluate(
    async ({ workflowId: id, nodes: seededNodes, rootId }) => {
      const r = await fetch(`/api/v2/workflow/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Phase 3 workflow', nodes: seededNodes, edges: {}, root: rootId }),
      })
      return { ok: r.ok, status: r.status, text: await r.text() }
    },
    { workflowId, nodes, rootId: root },
  )
  if (!response.ok) throw new Error(`Seed failed ${response.status}: ${response.text}`)
  await page.goto(`/workflow/${workflowId}`)
}

async function titlesInOrder(nodes: Locator): Promise<string[]> {
  return nodes.evaluateAll(rows =>
    rows.map(row => row.querySelector('[data-testid="node-chip-title"]')?.textContent?.trim() ?? ''),
  )
}

async function readWorkflow(page: Page, workflowId: string): Promise<WorkflowReadback> {
  return page.evaluate<WorkflowReadback, string>(async id => {
    const r = await fetch(`/api/v2/workflow/${id}`, { credentials: 'include' })
    if (!r.ok) throw new Error(`Workflow readback failed ${r.status}`)
    return r.json()
  }, workflowId)
}

async function expectChipInsidePanel(chip: Locator, panel: Locator, minimumWidth: number) {
  const [chipBox, panelBox] = await Promise.all([chip.boundingBox(), panel.boundingBox()])
  expect(chipBox).toBeTruthy()
  expect(panelBox).toBeTruthy()
  expect(chipBox!.width).toBeGreaterThanOrEqual(minimumWidth)
  expect(chipBox!.x).toBeGreaterThanOrEqual(panelBox!.x)
  expect(chipBox!.x + chipBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width)
}

// data-chip-kind="command"|"title" is present on all chip variants, making this selector universal.
async function expectBothChipsInsidePanel(row: Locator, panel: Locator) {
  await expectChipInsidePanel(row.locator('[data-chip-kind="command"]'), panel, 56)
  await expectChipInsidePanel(row.locator('[data-chip-kind="title"]'), panel, 72)
}

type RowActionTestId = 'node-add-child' | 'node-delete'
const ROW_ACTION_TEST_IDS: RowActionTestId[] = ['node-add-child', 'node-delete']
// Below the CSS @media (max-width: 40rem) breakpoint (640px) action buttons must not overlay
// the title chip. 360×740 is the TODO-focus viewport: narrowest realistic Android phone portrait.
const COMPACT_VIEWPORT = { width: 360, height: 740 } as const

// Returns whether elementFromPoint at the title-chip center lands on the given button.
// elementFromPoint respects pointer-events, directly modelling touch/click hit-testing.
async function evalTitleChipHitTest(
  page: Page,
  nodeId: string,
  buttonTestId: RowActionTestId,
): Promise<{ skipped: boolean; hits?: boolean }> {
  return page.evaluate(
    ({ id, testId }) => {
      const row = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`)
      const title = row?.querySelector<HTMLElement>('[data-chip-kind="title"]')
      const btn = row?.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
      if (!title || !btn) return { skipped: true }
      const t = title.getBoundingClientRect()
      const hitEl = document.elementFromPoint((t.left + t.right) / 2, (t.top + t.bottom) / 2)
      return { skipped: false, hits: btn === hitEl || btn.contains(hitEl as Node) }
    },
    { id: nodeId, testId: buttonTestId },
  )
}

// Returns whether elementFromPoint at the button's own center lands on that button.
async function evalButtonHitTest(
  page: Page,
  nodeId: string,
  buttonTestId: RowActionTestId,
): Promise<{ skipped: boolean; hits?: boolean }> {
  return page.evaluate(
    ({ id, testId }) => {
      const row = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`)
      const btn = row?.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
      if (!btn) return { skipped: true }
      const b = btn.getBoundingClientRect()
      const hitEl = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2)
      return { skipped: false, hits: btn === hitEl || btn.contains(hitEl as Node) }
    },
    { id: nodeId, testId: buttonTestId },
  )
}

// Asserts a title-chip tap does NOT land on the button after hovering the row.
// Hover is the real-world precondition: browsers fire hover/mouseover before touchstart,
// so Tailwind group-hover variants are active when the finger actually lands.
async function expectActionButtonYieldsTitleTap(page: Page, nodeId: string, buttonTestId: RowActionTestId) {
  await page.locator(`[data-node-id="${nodeId}"]`).hover()
  const hit = await evalTitleChipHitTest(page, nodeId, buttonTestId)
  if (hit.skipped) return
  expect(
    hit.hits,
    `node "${nodeId}" button "${buttonTestId}": tap at title-chip center intercepted by the button`,
  ).toBe(false)
}

// Asserts the button is pointer-interactive at its own center.
// Caller is responsible for the precondition (node selected, or hover already applied).
async function expectActionButtonIsHittable(page: Page, nodeId: string, buttonTestId: RowActionTestId) {
  const hit = await evalButtonHitTest(page, nodeId, buttonTestId)
  if (hit.skipped) return
  expect(
    hit.hits,
    `node "${nodeId}" button "${buttonTestId}": tap at button center did not land on the button`,
  ).toBe(true)
}

// Asserts the button is pointer-interactive after hovering its parent row.
// Verifies that group-hover enables buttons at desktop viewports where the mobile
// pointer-events suppression rule does not apply.
async function expectActionButtonIsHittableOnHover(page: Page, nodeId: string, buttonTestId: RowActionTestId) {
  await page.locator(`[data-node-id="${nodeId}"]`).hover()
  const hit = await evalButtonHitTest(page, nodeId, buttonTestId)
  if (hit.skipped) return
  expect(
    hit.hits,
    `node "${nodeId}" button "${buttonTestId}": button not hittable on hover at this viewport`,
  ).toBe(true)
}

async function dropFileOnNode(page: Page, target: Locator, name: string, body: string) {
  const dataTransfer = await page.evaluateHandle(
    ({ fileName, fileBody }) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([fileBody], fileName, { type: 'text/plain' }))
      return transfer
    },
    { fileName: name, fileBody: body },
  )

  await target.dispatchEvent('dragover', { dataTransfer })
  await target.dispatchEvent('drop', { dataTransfer })
}

async function dragNodeByPointer(source: Locator, target: Locator, targetPosition: 'before' | 'inside' | 'after') {
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Expected visible source and target rows')

  const targetY =
    targetPosition === 'before'
      ? targetBox.y + 2
      : targetPosition === 'after'
        ? targetBox.y + targetBox.height - 2
        : targetBox.y + targetBox.height / 2

  const page = source.page()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetY, { steps: 8 })
  await page.mouse.up()
}

test.describe('Workflow tree Phase 3 flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)
  })

  test('command-less text nodes stay joined while collapsed and split only when expanded', async ({ page }) => {
    const workflowId = await createWorkflow(page)
    await seedWorkflow(page, workflowId, {
      root: { id: 'root', title: 'Root', children: ['plain', 'assigned'] },
      plain: { id: 'plain', parent: 'root', title: 'One\n\nTwo\n\nThree', children: [], collapsed: true },
      assigned: {
        id: 'assigned',
        parent: 'root',
        title: 'A\n\nB',
        command: '/chat say hi',
        children: [],
        collapsed: true,
      },
    })

    const tree = new WorkflowTreePage(page)
    await expect(tree.nodesAtDepth(2)).toHaveCount(0)
    await expect(tree.node('plain')).toContainText('One')

    await tree.toggleNodeExpand('plain')
    await expect(tree.nodesAtDepth(2)).toHaveCount(3, { timeout: TIMEOUTS.UI_UPDATE })

    await expect(tree.node('assigned').getByTestId('node-toggle')).not.toBeVisible()
    await expect(tree.node('assigned')).toContainText('A')
    await expect(tree.nodesAtDepth(2)).toHaveCount(3)

    await page.reload()
    const workflow = await readWorkflow(page, workflowId)
    expect(workflow.nodes.plain.children).toHaveLength(3)
    expect(workflow.nodes.plain.prompts).toHaveLength(3)
  })

  test('mobile lazy-split descendants keep chips readable inside the tree panel', async ({ page }) => {
    await page.setViewportSize(COMPACT_VIEWPORT)
    const workflowId = await createWorkflow(page)
    await seedWorkflow(page, workflowId, {
      root: { id: 'root', title: 'Root', children: ['steps'] },
      steps: { id: 'steps', parent: 'root', title: 'Steps parent', command: '/steps', children: ['plain'], collapsed: true },
      plain: {
        id: 'plain',
        parent: 'steps',
        title: 'Alpha paragraph\n\nBeta paragraph\n\nGamma paragraph',
        children: [],
        collapsed: true,
      },
    })

    const tree = new WorkflowTreePage(page)
    await tree.toggleNodeExpand('steps')
    await tree.toggleNodeExpand('plain')
    await expect(tree.nodesAtDepth(3)).toHaveCount(3, { timeout: TIMEOUTS.UI_UPDATE })

    for (const title of ['Alpha paragraph', 'Beta paragraph', 'Gamma paragraph']) {
      // scope to depth 3: the parent "plain" at depth 2 also contains each paragraph
      // in its un-split title chip, causing a strict-mode ambiguity in nodeByTitle
      await expectBothChipsInsidePanel(tree.nodesAtDepth(3).filter({ hasText: title }), tree.treePanel)
    }
  })

  test('all chip types remain readable inside the panel at compact viewport', async ({ page }) => {
    await page.setViewportSize(COMPACT_VIEWPORT)
    const workflowId = await createWorkflow(page)
    await seedWorkflow(page, workflowId, {
      root: { id: 'root', title: 'Root', children: ['foreach', 'steps', 'chat', 'plain'] },
      foreach: { id: 'foreach', parent: 'root', title: 'Loop', command: '/foreach item', children: [] },
      steps: { id: 'steps', parent: 'root', title: 'Steps', command: '/steps', children: [] },
      chat: { id: 'chat', parent: 'root', title: 'Chat', command: '/chat hello', children: [] },
      plain: { id: 'plain', parent: 'root', title: 'No command', children: [] },
    })

    const tree = new WorkflowTreePage(page)
    for (const nodeId of ['foreach', 'steps', 'chat', 'plain'] as const) {
      await expectBothChipsInsidePanel(tree.node(nodeId), tree.treePanel)
    }
  })

  test('inline title editor stays accessible at compact viewport', async ({ page }) => {
    await page.setViewportSize(COMPACT_VIEWPORT)
    const workflowId = await createWorkflow(page)
    await seedWorkflow(page, workflowId, {
      root: { id: 'root', title: 'Root', children: ['a'] },
      a: { id: 'a', parent: 'root', title: 'Editable node', children: [] },
    })

    const tree = new WorkflowTreePage(page)
    await tree.selectNode('a')
    await tree.treePanel.press('Enter')

    const editor = tree.node('a').locator('textarea')
    await expect(editor).toBeVisible()

    const [editorBox, panelBox] = await Promise.all([editor.boundingBox(), tree.treePanel.boundingBox()])
    expect(editorBox).toBeTruthy()
    expect(panelBox).toBeTruthy()
    expect(editorBox!.x).toBeGreaterThanOrEqual(panelBox!.x)
    expect(editorBox!.x + editorBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width)
  })

  // Action-button pointer-events state machine across viewports:
  //
  //   compact (≤640px / 40rem):
  //     unselected + hover → pointer-events:none, opacity:0  (:not([selected]) rule beats group-hover)
  //     selected           → pointer-events:auto, opacity:1  ([selected] CSS rule)
  //     selected→deselected + hover → pointer-events:none    (state correctly reverts)
  //
  //   desktop (>640px):
  //     unselected + hover → pointer-events:auto             (Tailwind group-hover; no mobile suppression)
  //
  // Covers add-child + delete buttons, command + command-less nodes, depths 1–2.

  test('hidden row-action buttons do not intercept title-chip taps at compact viewport', async ({ page }) => {
    await page.setViewportSize(COMPACT_VIEWPORT)
    const workflowId = await createWorkflow(page)
    // d1cmd: depth-1 + command (two-chip layout, tighter horizontal budget)
    // d1nocmd: depth-1, no command (one-chip layout, different budget split)
    // d2: depth-2 (deepest indent — highest chip starvation risk)
    await seedWorkflow(page, workflowId, {
      root:    { id: 'root',    title: 'Root',            children: ['d1cmd', 'd1nocmd'] },
      d1cmd:   { id: 'd1cmd',   parent: 'root', title: 'Cmd node',      command: '/steps',  children: ['d2'] },
      d1nocmd: { id: 'd1nocmd', parent: 'root', title: 'Cmdless node',  children: [] },
      d2:      { id: 'd2',      parent: 'd1cmd', title: 'Depth-2 node', children: [] },
    })

    const tree = new WorkflowTreePage(page)
    await tree.toggleNodeExpand('root')
    await expect(tree.nodesAtDepth(1)).toHaveCount(2, { timeout: TIMEOUTS.UI_UPDATE })
    await tree.toggleNodeExpand('d1cmd')
    await expect(tree.nodesAtDepth(2)).toHaveCount(1, { timeout: TIMEOUTS.UI_UPDATE })

    const nonRootIds = ['d1cmd', 'd1nocmd', 'd2']
    for (const nodeId of nonRootIds) {
      for (const buttonTestId of ROW_ACTION_TEST_IDS) {
        await expectActionButtonYieldsTitleTap(page, nodeId, buttonTestId)
      }
    }
  })

  test('selected node row-action buttons are pointer-interactive at compact viewport', async ({ page }) => {
    await page.setViewportSize(COMPACT_VIEWPORT)
    const workflowId = await createWorkflow(page)
    // Both command (two-chip layout) and command-less (one-chip) variants: selected state must
    // restore button interactivity regardless of how the horizontal budget is divided.
    await seedWorkflow(page, workflowId, {
      root:       { id: 'root',       title: 'Root',          children: ['childcmd', 'childnocmd'] },
      childcmd:   { id: 'childcmd',   parent: 'root', title: 'Cmd child',    command: '/steps', children: [] },
      childnocmd: { id: 'childnocmd', parent: 'root', title: 'Cmdless child', children: [] },
    })

    const tree = new WorkflowTreePage(page)
    await tree.toggleNodeExpand('root')
    await expect(tree.nodesAtDepth(1)).toHaveCount(2, { timeout: TIMEOUTS.UI_UPDATE })

    for (const nodeId of ['childcmd', 'childnocmd']) {
      await tree.selectNode(nodeId)
      await expect(tree.selectedNodes).toHaveCount(1, { timeout: TIMEOUTS.UI_UPDATE })
      for (const buttonTestId of ROW_ACTION_TEST_IDS) {
        await expectActionButtonIsHittable(page, nodeId, buttonTestId)
      }
    }
  })

  test('deselected node action buttons revert to non-interactive at compact viewport', async ({ page }) => {
    await page.setViewportSize(COMPACT_VIEWPORT)
    const workflowId = await createWorkflow(page)
    await seedWorkflow(page, workflowId, {
      root:  { id: 'root',  title: 'Root',       children: ['child'] },
      child: { id: 'child', parent: 'root', title: 'Child node', children: [] },
    })

    const tree = new WorkflowTreePage(page)
    await tree.toggleNodeExpand('root')
    await expect(tree.node('child')).toBeVisible({ timeout: TIMEOUTS.UI_UPDATE })

    await tree.selectNode('child')
    await expect(tree.selectedNodes).toHaveCount(1, { timeout: TIMEOUTS.UI_UPDATE })
    for (const buttonTestId of ROW_ACTION_TEST_IDS) {
      await expectActionButtonIsHittable(page, 'child', buttonTestId)
    }

    await tree.treePanel.press('Escape')
    await expect(tree.selectedNodes).toHaveCount(0, { timeout: TIMEOUTS.UI_UPDATE })

    for (const buttonTestId of ROW_ACTION_TEST_IDS) {
      await expectActionButtonYieldsTitleTap(page, 'child', buttonTestId)
    }
  })

  test('desktop viewport action buttons become pointer-interactive on hover for unselected nodes', async ({ page }) => {
    const workflowId = await createWorkflow(page)
    // Both command and command-less layouts: group-hover must activate buttons at desktop
    // (the compact-viewport pointer-events suppression applies only at ≤40rem / 640px).
    await seedWorkflow(page, workflowId, {
      root:       { id: 'root',       title: 'Root',          children: ['childcmd', 'childnocmd'] },
      childcmd:   { id: 'childcmd',   parent: 'root', title: 'Cmd child',     command: '/chat hello', children: [] },
      childnocmd: { id: 'childnocmd', parent: 'root', title: 'Cmdless child', children: [] },
    })

    const tree = new WorkflowTreePage(page)
    await tree.toggleNodeExpand('root')
    await expect(tree.nodesAtDepth(1)).toHaveCount(2, { timeout: TIMEOUTS.UI_UPDATE })

    for (const nodeId of ['childcmd', 'childnocmd']) {
      for (const buttonTestId of ROW_ACTION_TEST_IDS) {
        await expectActionButtonIsHittableOnHover(page, nodeId, buttonTestId)
      }
    }
  })

  test('chip hover lift is suppressed under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const workflowId = await createWorkflow(page)
    await seedWorkflow(page, workflowId, {
      root: { id: 'root', title: 'Root', children: ['cmd'] },
      cmd: { id: 'cmd', parent: 'root', title: 'Command node', command: '/steps', children: [] },
    })

    const commandChip = page
      .locator('[data-node-id="cmd"]')
      .locator('[data-chip-kind="command"]')

    await commandChip.hover()

    const translateValue = await commandChip.evaluate(el => getComputedStyle(el).translate)
    expect(translateValue).toBe('none')
  })

  test('tree node chips reflect command semantics without truncating stored title', async ({ page }) => {
    const workflowId = await createWorkflow(page)
    const longTitle = 'A very long workflow title that must stay stored'
    await seedWorkflow(page, workflowId, {
      root: { id: 'root', title: 'Root', children: ['foreach', 'steps', 'chat', 'plain'] },
      foreach: { id: 'foreach', parent: 'root', title: 'Loop', command: '/foreach item', children: [] },
      steps: { id: 'steps', parent: 'root', title: 'Steps', command: '/steps', children: [] },
      chat: { id: 'chat', parent: 'root', title: 'Chat', command: '/chat hello', children: [] },
      plain: { id: 'plain', parent: 'root', title: longTitle, children: [] },
    })

    const tree = new WorkflowTreePage(page)
    await expect(tree.node('foreach').getByTestId('node-chip-foreach')).toBeVisible()
    await expect(tree.node('steps').getByTestId('node-chip-steps')).toBeVisible()
    await expect(tree.node('chat').getByTestId('node-chip-command')).toBeVisible()
    await expect(tree.node('plain').getByTestId('node-chip-commandless')).toBeVisible()

    const titleChip = tree.node('plain').getByTestId('node-chip-title')
    await expect(titleChip).toContainText(longTitle.slice(0, 20))
    await expect(titleChip).not.toContainText(longTitle.slice(20))

    const workflow = await page.evaluate<WorkflowReadback, string>(async id => {
      const r = await fetch(`/api/v2/workflow/${id}`, { credentials: 'include' })
      return r.json()
    }, workflowId)
    expect(workflow.nodes.plain.title).toBe(longTitle)
  })

  test('dragging nodes reorders siblings and reparents across parents with persistence', async ({ page }) => {
    const workflowId = await createWorkflow(page)
    await seedWorkflow(page, workflowId, {
      root: { id: 'root', title: 'Root', children: ['a', 'b', 'c'] },
      a: { id: 'a', parent: 'root', title: 'A', children: [] },
      b: { id: 'b', parent: 'root', title: 'B', children: [] },
      c: { id: 'c', parent: 'root', title: 'C', children: [] },
    })

    const tree = new WorkflowTreePage(page)
    await dragNodeByPointer(tree.node('c'), tree.node('a'), 'before')
    await expect.poll(() => titlesInOrder(tree.nodesAtDepth(1))).toEqual(['C', 'A', 'B'])

    await dragNodeByPointer(tree.node('b'), tree.node('a'), 'inside')
    await expect(tree.nodesAtDepth(2).filter({ hasText: 'B' })).toHaveCount(1, { timeout: TIMEOUTS.UI_UPDATE })

    await page.reload()
    const workflow = await readWorkflow(page, workflowId)
    expect(workflow.nodes.a.children).toEqual(['b'])
    expect(workflow.nodes.b.parent).toBe('a')
  })

  test('drag marker is visible before dropping across all row zones', async ({ page }) => {
    const workflowId = await createWorkflow(page)
    await seedWorkflow(page, workflowId, {
      root: { id: 'root', title: 'Root', children: ['a', 'b'] },
      a: { id: 'a', parent: 'root', title: 'A', children: [] },
      b: { id: 'b', parent: 'root', title: 'B', children: [] },
    })

    const tree = new WorkflowTreePage(page)
    const source = tree.node('b')
    const target = tree.node('a')
    const sourceBox = await source.boundingBox()
    const targetBox = await target.boundingBox()
    if (!sourceBox || !targetBox) throw new Error('Expected visible source and target rows')

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()

    for (const [position, y] of [
      ['before', targetBox.y + 2],
      ['inside', targetBox.y + targetBox.height / 2],
      ['after', targetBox.y + targetBox.height - 2],
    ] as const) {
      await page.mouse.move(targetBox.x + targetBox.width / 2, y)
      const marker = target.getByTestId('tree-drop-marker')
      await expect(marker).toBeVisible()
      await expect(marker).toHaveAttribute('data-drop-position', position)
    }

    await page.mouse.up()
  })

  test('dropping an external file creates a persisted selected child with file id and length metadata', async ({
    page,
  }) => {
    const workflowId = await createWorkflow(page)
    await seedWorkflow(page, workflowId, {
      root: { id: 'root', title: 'Root', children: ['steps'] },
      steps: { id: 'steps', parent: 'root', title: 'Steps', command: '/steps', children: [] },
    })

    const tree = new WorkflowTreePage(page)
    await tree.node('steps').click()
    const uploadResponses: number[] = []
    page.on('response', response => {
      if (response.url().includes(`/api/v2/workflow/${workflowId}/files`) && response.request().method() === 'POST') {
        uploadResponses.push(response.status())
      }
    })
    const uploadResponse = page.waitForResponse(
      response =>
        response.url().includes(`/api/v2/workflow/${workflowId}/files`) && response.request().method() === 'POST',
    )
    await dropFileOnNode(page, tree.node('root'), 'notes.txt', 'hello')
    const response = await uploadResponse
    expect(response.status()).toBe(201)
    const uploadJson = await response.json()

    await expect(tree.nodesAtDepth(1).filter({ hasText: 'notes.txt' })).toHaveCount(1, {
      timeout: TIMEOUTS.BACKEND_SYNC,
    })
    await expect(tree.selectedNodes).toHaveCount(1)
    await expect.poll(() => uploadResponses.length).toBe(1)
    expect(uploadJson.length).toBe(5)

    const workflow = await readWorkflow(page, workflowId)
    const fileNodes = Object.values(workflow.nodes).filter(node => node.file === uploadJson.id)
    expect(fileNodes).toHaveLength(1)
    const fileNode = fileNodes[0]
    expect(fileNode?.title).toBe('notes.txt')
    expect(fileNode?.parent).toBe('root')
    expect(uploadJson).toMatchObject({ filename: 'notes.txt', length: 5 })

    const readback = await page.evaluate<{ status: number; body: string }, { workflowId: string; fileId: string }>(
      async ({ workflowId: id, fileId }) => {
        const r = await fetch(`/api/v2/workflow/${id}/files/${fileId}`, { credentials: 'include' })
        return { status: r.status, body: await r.text() }
      },
      { workflowId, fileId: uploadJson.id },
    )
    expect(readback).toEqual({ status: 200, body: 'hello' })
  })

  test('mobile checkbox bulk selection persists checked state and desktop multi-select still works', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const workflowId = await createWorkflow(page)
    await seedWorkflow(page, workflowId, {
      root: { id: 'root', title: 'Root', children: ['a', 'b'] },
      a: { id: 'a', parent: 'root', title: 'A', children: [] },
      b: { id: 'b', parent: 'root', title: 'B', children: [] },
    })

    const tree = new WorkflowTreePage(page)
    await tree.node('a').getByTestId('node-checkbox').click()
    await expect(tree.node('a').getByTestId('node-checkbox')).toBeChecked()
    await expect(tree.selectedNodes).toHaveCount(1)

    await page.reload()
    await expect(tree.node('a').getByTestId('node-checkbox')).toBeChecked({ timeout: TIMEOUTS.BACKEND_SYNC })

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.reload()
    await expect(tree.node('a').getByTestId('node-checkbox')).toHaveCount(0)
    await expect(tree.selectedNodes).toHaveCount(1)
    await tree.ctrlClickNode('b')
    await expect(tree.selectedNodes).toHaveCount(2)
  })
})
