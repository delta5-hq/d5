import { describe, expect, it } from 'vitest'
import { resolveWorkflowFileDropParentId } from './file-drop-target'

function row(id: string): HTMLElement {
  const element = document.createElement('div')
  element.dataset.nodeId = id
  return element
}

function childInside(id: string): HTMLElement {
  const parent = row(id)
  const child = document.createElement('span')
  parent.appendChild(child)
  return child
}

const hasNode = (nodeId: string) => ['root', 'selected', 'target', 'point-target'].includes(nodeId)

describe('resolveWorkflowFileDropParentId', () => {
  it('uses the row that received the drop event even when another node is selected elsewhere', () => {
    expect(
      resolveWorkflowFileDropParentId({
        eventTarget: childInside('root'),
        pointTarget: row('selected'),
        rootId: 'root',
        hasNode,
      }),
    ).toBe('root')
  })

  it('uses the row under the pointer when the event target is the tree panel', () => {
    expect(
      resolveWorkflowFileDropParentId({
        eventTarget: document.createElement('section'),
        pointTarget: childInside('point-target'),
        rootId: 'root',
        hasNode,
      }),
    ).toBe('point-target')
  })

  it('ignores stale row ids that are absent from the current node map', () => {
    expect(
      resolveWorkflowFileDropParentId({
        eventTarget: row('deleted'),
        pointTarget: row('target'),
        rootId: 'root',
        hasNode,
      }),
    ).toBe('target')
  })

  it('falls back to root for panel drops outside any current row', () => {
    expect(
      resolveWorkflowFileDropParentId({
        eventTarget: document.createElement('section'),
        pointTarget: null,
        rootId: 'root',
        hasNode,
      }),
    ).toBe('root')
  })

  it('returns undefined before a workflow root exists', () => {
    expect(
      resolveWorkflowFileDropParentId({
        eventTarget: document.createElement('section'),
        pointTarget: null,
        rootId: undefined,
        hasNode,
      }),
    ).toBeUndefined()
  })
})
