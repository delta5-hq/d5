import { describe, it, expect } from 'vitest'
import { projectSelectedNodeElectCostPreview } from '../fork-cost-projector'
import type { NodeData, NodeDatas } from '@shared/base-types'

const chatNode = (id: string, parent: string | null, extra: Partial<NodeData> = {}): NodeData => ({
  id,
  command: '/chat some prompt',
  title: '/chat some prompt',
  parent,
  children: [],
  prompts: [],
  ...extra,
})

const electNode = (id: string, parent: string | null, command: string): NodeData => ({
  id,
  command,
  title: command,
  parent,
  children: [],
  prompts: [],
})

describe('projectSelectedNodeElectCostPreview — inline vs postfix cost parity', () => {
  it('inline form (/elect :n=3 /chat …) at root projects same cost as equivalent postfix form', () => {
    const parentId = 'parent'
    const electId = 'elect'

    const postfixNodes: NodeDatas = {
      [parentId]: chatNode(parentId, null, { children: [electId] }),
      [electId]: electNode(electId, parentId, '/elect :n=3'),
    }

    const inlineNodes: NodeDatas = {
      [electId]: electNode(electId, null, '/elect :n=3 /chat some prompt'),
    }

    const postfixCost = projectSelectedNodeElectCostPreview(postfixNodes[electId], postfixNodes)
    const inlineCost = projectSelectedNodeElectCostPreview(inlineNodes[electId], inlineNodes)

    expect(postfixCost?.cost).toBe(3)
    expect(inlineCost?.cost).toBe(postfixCost?.cost)
  })

  it('postfix form is routed through as-is (no enrichment needed)', () => {
    const parentId = 'parent'
    const electId = 'elect'
    const nodes: NodeDatas = {
      [parentId]: chatNode(parentId, null, { children: [electId] }),
      [electId]: electNode(electId, parentId, '/elect :n=2'),
    }

    const result = projectSelectedNodeElectCostPreview(nodes[electId], nodes)
    expect(result?.cost).toBe(2)
  })

  it('inline form with non-command trailing text yields null cost (not a valid elect)', () => {
    const nodes: NodeDatas = {
      elect: electNode('elect', null, '/elect :n=3 must cite sources'),
    }
    const result = projectSelectedNodeElectCostPreview(nodes['elect'], nodes)
    expect(result?.cost).toBeFalsy()
  })

  it('undefined selectedNode returns null', () => {
    expect(projectSelectedNodeElectCostPreview(undefined, {})).toBeNull()
  })

  it('inline elect with :n=5 projects cost 5', () => {
    const nodes: NodeDatas = {
      elect: electNode('elect', null, '/elect :n=5 /chat analyze competitors'),
    }
    const result = projectSelectedNodeElectCostPreview(nodes['elect'], nodes)
    expect(result?.cost).toBe(5)
  })

  it('nested inline elect (/elect :n=3 /chat …) under a content ancestor projects same cost as equivalent postfix form', () => {
    const ancestorId = 'ancestor'
    const termId = 'term'
    const electId = 'elect'

    const postfixNodes: NodeDatas = {
      [ancestorId]: chatNode(ancestorId, null, { children: [termId] }),
      [termId]: chatNode(termId, ancestorId, { children: [electId] }),
      [electId]: electNode(electId, termId, '/elect :n=3'),
    }

    const inlineNodes: NodeDatas = {
      [ancestorId]: chatNode(ancestorId, null, { children: [electId] }),
      [electId]: electNode(electId, ancestorId, '/elect :n=3 /chat some prompt'),
    }

    const postfixCost = projectSelectedNodeElectCostPreview(postfixNodes[electId], postfixNodes)
    const inlineCost = projectSelectedNodeElectCostPreview(inlineNodes[electId], inlineNodes)

    expect(postfixCost?.cost).toBe(3)
    expect(inlineCost?.cost).toBe(postfixCost?.cost)
  })

  it('re-run scenario: postfix projects N-1 from its prior output, inline projects N — the wrapped term has none', () => {
    // Postfix: parent node has been executed before — it has a prompt child in the graph.
    const priorId = 'prior-output'
    const parentId = 'parent'
    const electId = 'elect'

    const postfixNodes: NodeDatas = {
      [priorId]: { id: priorId, command: '', title: 'prior output', parent: parentId, children: [], prompts: [] },
      [parentId]: chatNode(parentId, null, { children: [electId], prompts: [priorId] }),
      [electId]: electNode(electId, parentId, '/elect :n=3'),
    }

    // Inline: the elect cell still carries leftover output from its previous, different command, but the
    // wrapped term has no generation standing outside its scope, so that stale output is not a candidate.
    const inlineNodes: NodeDatas = {
      [priorId]: { id: priorId, command: '', title: 'prior output', parent: electId, children: [], prompts: [] },
      [electId]: { ...electNode(electId, null, '/elect :n=3 /chat some prompt'), prompts: [priorId] },
    }

    const postfixCost = projectSelectedNodeElectCostPreview(postfixNodes[electId], postfixNodes)
    const inlineCost = projectSelectedNodeElectCostPreview(inlineNodes[electId], inlineNodes)

    expect(postfixCost?.cost).toBe(2)
    expect(inlineCost?.cost).toBe(3)
  })
})
