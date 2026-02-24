import { describe, it, expect } from 'vitest'
import { enrichNodesWithParents } from '../enrich-nodes-with-parents'
import { mergeWorkflowChanges } from '../merge-workflow-changes'
import { isPromptNode } from '../node-validation'
import type { NodeData, WorkflowContentData } from '@shared/base-types'

const createState = (nodes: Record<string, NodeData>, root = Object.keys(nodes)[0] ?? 'root'): WorkflowContentData => ({
  nodes,
  root,
  share: { access: [] },
})

describe('enrichNodesWithParents + mergeWorkflowChanges integration', () => {
  describe('prompt field propagation', () => {
    it('enables isPromptNode detection when parent arrives via enrichment', () => {
      const parent: NodeData = {
        id: 'parent',
        command: '/custom test',
        children: [],
        prompts: [],
      }

      const currentState = createState({ parent })

      const incomingChildren = {
        child1: { id: 'child1', parent: 'parent' },
        child2: { id: 'child2', parent: 'parent' },
      }

      const completeMap = {
        parent: { ...parent, children: ['child1', 'child2'], prompts: ['child1', 'child2'] },
        child1: incomingChildren.child1,
        child2: incomingChildren.child2,
      }

      const enriched = enrichNodesWithParents(incomingChildren, completeMap)
      const merged = mergeWorkflowChanges(currentState, { nodesChanged: enriched })

      expect(merged.nodes.parent.prompts).toEqual(['child1', 'child2'])
      expect(isPromptNode('child1', merged.nodes)).toBe(true)
      expect(isPromptNode('child2', merged.nodes)).toBe(true)
    })

    it('enables prompt eviction when parent prompts field updates', () => {
      const currentState = createState({
        parent: { id: 'parent', children: ['old1', 'old2'], prompts: ['old1', 'old2'] },
        old1: { id: 'old1', parent: 'parent' },
        old2: { id: 'old2', parent: 'parent' },
      })

      const incomingChildren = {
        new1: { id: 'new1', parent: 'parent' },
        new2: { id: 'new2', parent: 'parent' },
      }

      const completeMap = {
        parent: { id: 'parent', children: ['new1', 'new2'], prompts: ['new1', 'new2'] },
        new1: incomingChildren.new1,
        new2: incomingChildren.new2,
      }

      const enriched = enrichNodesWithParents(incomingChildren, completeMap)
      const merged = mergeWorkflowChanges(currentState, { nodesChanged: enriched })

      expect(merged.nodes.old1).toBeUndefined()
      expect(merged.nodes.old2).toBeUndefined()
      expect(merged.nodes.new1).toBeDefined()
      expect(merged.nodes.new2).toBeDefined()
      expect(merged.nodes.parent.prompts).toEqual(['new1', 'new2'])
    })
  })

  describe('parent-child array reconciliation', () => {
    it('merges parent children array when parent arrives via enrichment', () => {
      const currentState = createState({
        parent: { id: 'parent', children: ['existing'] },
        existing: { id: 'existing', parent: 'parent' },
      })

      const completeMap = {
        parent: { id: 'parent', children: ['existing', 'new1', 'new2'] },
        new1: { id: 'new1', parent: 'parent' },
        new2: { id: 'new2', parent: 'parent' },
      }

      const enriched = enrichNodesWithParents({ new1: completeMap.new1, new2: completeMap.new2 }, completeMap)
      const merged = mergeWorkflowChanges(currentState, { nodesChanged: enriched })

      expect(merged.nodes.parent.children).toEqual(['existing', 'new1', 'new2'])
    })

    it('preserves non-prompt children when prompts field updates', () => {
      const currentState = createState({
        parent: { id: 'parent', children: ['regular', 'old'], prompts: ['old'] },
        regular: { id: 'regular', parent: 'parent' },
        old: { id: 'old', parent: 'parent' },
      })

      const completeMap = {
        parent: { id: 'parent', children: ['regular', 'new'], prompts: ['new'] },
        new: { id: 'new', parent: 'parent' },
      }

      const enriched = enrichNodesWithParents({ new: completeMap.new }, completeMap)
      const merged = mergeWorkflowChanges(currentState, { nodesChanged: enriched })

      expect(merged.nodes.regular).toBeDefined()
      expect(merged.nodes.old).toBeUndefined()
      expect(merged.nodes.new).toBeDefined()
    })
  })

  describe('field preservation across enrichment and merge', () => {
    it('preserves all parent node fields through enrichment pipeline', () => {
      const currentState = createState({
        parent: { id: 'parent', title: 'Old Title' },
      })

      const completeParent: NodeData = {
        id: 'parent',
        title: 'New Title',
        command: '/instruct test',
        prompts: ['child'],
        children: ['child'],
        color: '#ff0000',
        scale: 1.5,
        tags: ['tag1'],
      }

      const completeMap = {
        parent: completeParent,
        child: { id: 'child', parent: 'parent' },
      }

      const enriched = enrichNodesWithParents({ child: completeMap.child }, completeMap)
      const merged = mergeWorkflowChanges(currentState, { nodesChanged: enriched })

      expect(merged.nodes.parent.title).toBe('New Title')
      expect(merged.nodes.parent.command).toBe('/instruct test')
      expect(merged.nodes.parent.color).toBe('#ff0000')
      expect(merged.nodes.parent.scale).toBe(1.5)
      expect(merged.nodes.parent.tags).toEqual(['tag1'])
    })
  })
})
