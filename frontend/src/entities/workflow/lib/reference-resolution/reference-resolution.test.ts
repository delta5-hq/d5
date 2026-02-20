import { describe, it, expect } from 'vitest'
import type { NodeData } from '@shared/base-types'
import { enrichNodesWithDepth, makeNodeStore } from './node-store'
import { indentedText } from './indented-text'
import { substituteReferences } from './substitute-references'
import { substituteHashrefs } from './substitute-hashrefs'
import { resolveNodeReferences } from './resolve-node-references'
import {
  clearReferences,
  getReferences,
  findInNodeArray,
  findInNodeMap,
  findAllInNodeArray,
  findAllSiblingsMatch,
} from './reference-utils'
import { escapeRegexString } from './escape-regex-string'
import { referencePatterns } from './reference-patterns'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function node(id: string, overrides: Partial<NodeData> = {}): NodeData {
  return { id, title: id, children: [], ...overrides }
}

function nodeMap(entries: Array<[string, Partial<NodeData>]>): Record<string, NodeData> {
  return Object.fromEntries(entries.map(([id, o]) => [id, node(id, o)]))
}

// ─── enrichNodesWithDepth ─────────────────────────────────────────────────────

describe('enrichNodesWithDepth', () => {
  it('assigns depth 0 to root', () => {
    const nodes = nodeMap([['root', { children: [] }]])
    const enriched = enrichNodesWithDepth(nodes, 'root')
    expect(enriched.root.depth).toBe(0)
  })

  it('assigns depth 1 to direct children of root', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b'] }],
      ['a', { parent: 'root' }],
      ['b', { parent: 'root' }],
    ])
    const enriched = enrichNodesWithDepth(nodes, 'root')
    expect(enriched.a.depth).toBe(1)
    expect(enriched.b.depth).toBe(1)
  })

  it('assigns increasing depth for deeply nested children', () => {
    const nodes = nodeMap([
      ['root', { children: ['child'] }],
      ['child', { parent: 'root', children: ['grandchild'] }],
      ['grandchild', { parent: 'child' }],
    ])
    const enriched = enrichNodesWithDepth(nodes, 'root')
    expect(enriched.root.depth).toBe(0)
    expect(enriched.child.depth).toBe(1)
    expect(enriched.grandchild.depth).toBe(2)
  })

  it('assigns depth 0 to orphan nodes not reachable from root', () => {
    const nodes = nodeMap([
      ['root', { children: [] }],
      ['orphan', {}],
    ])
    const enriched = enrichNodesWithDepth(nodes, 'root')
    expect(enriched.orphan.depth).toBe(0)
  })

  it('handles multiple branches of equal depth independently', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b'] }],
      ['a', { parent: 'root', children: ['a1'] }],
      ['b', { parent: 'root', children: ['b1'] }],
      ['a1', { parent: 'a' }],
      ['b1', { parent: 'b' }],
    ])
    const enriched = enrichNodesWithDepth(nodes, 'root')
    expect(enriched.a1.depth).toBe(2)
    expect(enriched.b1.depth).toBe(2)
  })

  it('does not revisit already-enriched child nodes via multiple parent paths', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b'] }],
      ['a', { parent: 'root', children: ['shared'] }],
      ['b', { parent: 'root', children: ['shared'] }],
      ['shared', { parent: 'a' }],
    ])
    const enriched = enrichNodesWithDepth(nodes, 'root')
    expect(enriched.shared.depth).toBe(2)
  })
})

// ─── makeNodeStore ────────────────────────────────────────────────────────────

describe('makeNodeStore', () => {
  it('returns a store with getNode that resolves by id', () => {
    const nodes = nodeMap([['n1', {}]])
    const store = makeNodeStore(nodes)
    expect(store.getNode('n1')!.id).toBe('n1')
  })

  it('returns undefined for unknown node id', () => {
    const store = makeNodeStore(nodeMap([['n1', {}]]))
    expect(store.getNode('missing')).toBeUndefined()
  })

  it('auto-detects root from the node without a parent field', () => {
    const nodes = nodeMap([
      ['root', { children: ['child'] }],
      ['child', { parent: 'root' }],
    ])
    const store = makeNodeStore(nodes)
    expect(store.getNode('root')!.depth).toBe(0)
    expect(store.getNode('child')!.depth).toBe(1)
  })

  it('uses explicit rootId when provided instead of auto-detection', () => {
    const nodes = nodeMap([
      ['a', { children: ['b'] }],
      ['b', { parent: 'a' }],
    ])
    const store = makeNodeStore(nodes, {}, 'a')
    expect(store.getNode('a')!.depth).toBe(0)
    expect(store.getNode('b')!.depth).toBe(1)
  })

  it('exposes raw enriched nodes via _nodes', () => {
    const nodes = nodeMap([['n1', {}]])
    const store = makeNodeStore(nodes)
    expect(store._nodes['n1']).toBeDefined()
    expect(store._nodes['n1'].id).toBe('n1')
  })

  it('exposes edges via _edges', () => {
    const nodes = nodeMap([['n1', {}]])
    const edges = { e1: { id: 'e1', start: 'n1', end: 'n1', title: 'e' } }
    const store = makeNodeStore(nodes, edges)
    expect(store._edges).toBe(edges)
  })
})

// ─── indentedText ─────────────────────────────────────────────────────────────

describe('indentedText', () => {
  it('returns single TextLine for a leaf node', () => {
    const nodes = nodeMap([['n1', { title: 'leaf text' }]])
    const store = makeNodeStore(nodes)
    const lines = indentedText(store.getNode('n1')!, store)
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('leaf text')
  })

  it('includes children as separate lines', () => {
    const nodes = nodeMap([
      ['root', { children: ['child'], title: 'root text' }],
      ['child', { parent: 'root', title: 'child text' }],
    ])
    const store = makeNodeStore(nodes)
    const lines = indentedText(store.getNode('root')!, store)
    expect(lines.some(l => l.text.includes('child text'))).toBe(true)
  })

  it('child line is indented relative to the head node', () => {
    const nodes = nodeMap([
      ['root', { children: ['child'], title: 'root text' }],
      ['child', { parent: 'root', title: 'child text' }],
    ])
    const store = makeNodeStore(nodes)
    const lines = indentedText(store.getNode('root')!, store)
    const childLine = lines.find(l => l.text.includes('child text'))!
    expect(childLine.text).toMatch(/^\s+child text/)
  })

  it('head text is empty when title is a command and saveFirst is false', () => {
    const nodes = nodeMap([['n1', { title: '/chatgpt some command' }]])
    const store = makeNodeStore(nodes)
    const lines = indentedText(store.getNode('n1')!, store, { saveFirst: false })
    expect(lines[0].text).toBe('')
  })

  it('head text is preserved when saveFirst is true even for command titles', () => {
    const nodes = nodeMap([['n1', { title: '/chatgpt do something' }]])
    const store = makeNodeStore(nodes)
    const lines = indentedText(store.getNode('n1')!, store, { saveFirst: true })
    expect(lines[0].text).toContain('/chatgpt do something')
  })

  it('uses command field over title when useCommand is true and command is set', () => {
    const nodes = nodeMap([['n1', { title: 'title text', command: 'command text' }]])
    const store = makeNodeStore(nodes)
    const lines = indentedText(store.getNode('n1')!, store, { saveFirst: true, useCommand: true })
    expect(lines[0].text).toBe('command text')
  })

  it('falls back to title when useCommand is true but command is absent', () => {
    const nodes = nodeMap([['n1', { title: 'title text' }]])
    const store = makeNodeStore(nodes)
    const lines = indentedText(store.getNode('n1')!, store, { saveFirst: true, useCommand: true })
    expect(lines[0].text).toBe('title text')
  })

  it('falls back to title when useCommand is true and command is empty string', () => {
    const nodes = nodeMap([['n1', { title: 'title text', command: '' }]])
    const store = makeNodeStore(nodes)
    const lines = indentedText(store.getNode('n1')!, store, { saveFirst: true, useCommand: true })
    expect(lines[0].text).toBe('title text')
  })

  it('falls back to title when useCommand is true and command is null', () => {
    const nodes = nodeMap([['n1', { title: 'title text', command: null as unknown as string }]])
    const store = makeNodeStore(nodes)
    const lines = indentedText(store.getNode('n1')!, store, { saveFirst: true, useCommand: true })
    expect(lines[0].text).toBe('title text')
  })

  it('excludes prompt children when nonPromptNode is true', () => {
    const nodes = nodeMap([
      ['parent', { children: ['child', 'prompt'], prompts: ['prompt'], title: 'parent', command: '/chatgpt run' }],
      ['child', { parent: 'parent', title: 'child text' }],
      ['prompt', { parent: 'parent', title: 'prompt output' }],
    ])
    const store = makeNodeStore(nodes)
    const texts = indentedText(store.getNode('parent')!, store, { nonPromptNode: true }).map(l => l.text)
    expect(texts.some(t => t.includes('child text'))).toBe(true)
    expect(texts.some(t => t.includes('prompt output'))).toBe(false)
  })

  it('includes prompt children when nonPromptNode is false', () => {
    const nodes = nodeMap([
      ['parent', { children: ['child', 'prompt'], prompts: ['prompt'], title: 'parent', command: '/chatgpt run' }],
      ['child', { parent: 'parent', title: 'child text' }],
      ['prompt', { parent: 'parent', title: 'prompt output' }],
    ])
    const store = makeNodeStore(nodes)
    const texts = indentedText(store.getNode('parent')!, store, { nonPromptNode: false }).map(l => l.text)
    expect(texts.some(t => t.includes('prompt output'))).toBe(true)
  })

  it('grandchild indentation is deeper than child indentation', () => {
    const nodes = nodeMap([
      ['root', { children: ['child'], title: 'root', command: '/chatgpt test' }],
      ['child', { parent: 'root', children: ['grandchild'], title: 'child text' }],
      ['grandchild', { parent: 'child', title: 'grandchild text' }],
    ])
    const store = makeNodeStore(nodes)
    const lines = indentedText(store.getNode('root')!, store, { saveFirst: true })
    const childIndent = lines.find(l => l.text.includes('child text'))!.text.match(/^(\s*)/)?.[1].length ?? 0
    const grandchildIndent = lines.find(l => l.text.includes('grandchild text'))!.text.match(/^(\s*)/)?.[1].length ?? 0
    expect(grandchildIndent).toBeGreaterThan(childIndent)
  })

  it('command-only children are omitted from body lines', () => {
    const nodes = nodeMap([
      ['root', { children: ['cmd', 'text'], title: 'root' }],
      ['cmd', { parent: 'root', title: '/chatgpt do it' }],
      ['text', { parent: 'root', title: 'plain text' }],
    ])
    const store = makeNodeStore(nodes)
    const lines = indentedText(store.getNode('root')!, store)
    expect(lines.find(l => l.node.id === 'cmd')).toBeUndefined()
    expect(lines.find(l => l.node.id === 'text')?.text).toContain('plain text')
  })

  it('parentIndentation shifts child line indentation additively', () => {
    const nodes = nodeMap([
      ['root', { children: ['child'], title: 'root' }],
      ['child', { parent: 'root', title: 'child text' }],
    ])
    const store = makeNodeStore(nodes)
    const baseIndent =
      indentedText(store.getNode('root')!, store, { parentIndentation: 0 })
        .find(l => l.text.includes('child text'))!
        .text.match(/^(\s*)/)?.[1].length ?? 0
    const shiftedIndent =
      indentedText(store.getNode('root')!, store, { parentIndentation: 2 })
        .find(l => l.text.includes('child text'))!
        .text.match(/^(\s*)/)?.[1].length ?? 0
    expect(shiftedIndent).toBeGreaterThan(baseIndent)
  })

  it('ignores /foreach children when ignorePostProccessCommand is true', () => {
    const nodes = nodeMap([
      ['root', { children: ['fe', 'text'], title: 'root' }],
      ['fe', { parent: 'root', title: '/foreach do each', children: ['fe-child'] }],
      ['fe-child', { parent: 'fe', title: 'inside foreach' }],
      ['text', { parent: 'root', title: 'plain text' }],
    ])
    const store = makeNodeStore(nodes)
    const texts = indentedText(store.getNode('root')!, store, { ignorePostProccessCommand: true }).map(l => l.text)
    expect(texts.some(t => t.includes('inside foreach'))).toBe(false)
    expect(texts.some(t => t.includes('plain text'))).toBe(true)
  })
})

// ─── clearReferences ─────────────────────────────────────────────────────────

describe('clearReferences', () => {
  it('removes default @-prefixed token from text', () => {
    expect(clearReferences('@some_ref and other text')).toBe(' and other text')
  })

  it('leaves text without reference tokens unchanged', () => {
    expect(clearReferences('plain text')).toBe('plain text')
  })

  it('removes the first @-prefixed token, preserving text after it', () => {
    const result = clearReferences('@ref_a middle remaining text')
    expect(result).not.toContain('@ref_a')
    expect(result).toContain('middle remaining text')
  })

  it('handles empty string without throwing', () => {
    expect(clearReferences('')).toBe('')
  })

  it('removes tokens using a custom prefix', () => {
    const result = clearReferences('#_some_ref remaining', '#_')
    expect(result).not.toContain('#_some_ref')
    expect(result).toContain('remaining')
  })
})

// ─── getReferences ────────────────────────────────────────────────────────────

describe('getReferences', () => {
  it('returns matched references with their prefix', () => {
    const refs = getReferences('@@some_ref text', '@@')
    expect(refs).toContain('@@some_ref')
  })

  it('returns all references when multiple are present', () => {
    const refs = getReferences('@@ref_a and @@ref_b', '@@')
    expect(refs).toHaveLength(2)
    expect(refs).toContain('@@ref_a')
    expect(refs).toContain('@@ref_b')
  })

  it('returns empty array when no references match the prefix', () => {
    expect(getReferences('plain text', '@@')).toHaveLength(0)
  })

  it('returns empty array for undefined input', () => {
    expect(getReferences(undefined, '@@')).toHaveLength(0)
  })

  it('returns references including :first and :last postfixes when postfixes are supplied', () => {
    const refs = getReferences('##_item:first and ##_item:last', '##_', [':first', ':last'])
    expect(refs.some(r => r.includes(':first'))).toBe(true)
    expect(refs.some(r => r.includes(':last'))).toBe(true)
  })

  it('returns reference without postfix when postfixes param is omitted', () => {
    const refs = getReferences('@@ref_name', '@@')
    expect(refs[0]).toBe('@@ref_name')
  })
})

// ─── findInNodeArray ──────────────────────────────────────────────────────────

describe('findInNodeArray', () => {
  const nodes = [
    { id: 'a', title: '#_data_a value', depth: 1, children: [] },
    { id: 'b', title: 'plain text', command: '#_cmd_b found', depth: 1, children: [] },
    { id: 'c', title: 'nothing special', depth: 1, children: [] },
  ]

  it('returns undefined for an empty array', () => {
    expect(findInNodeArray([], false, () => true)).toBeUndefined()
  })

  it('returns undefined when no node satisfies the predicate', () => {
    expect(findInNodeArray(nodes, false, () => false)).toBeUndefined()
  })

  it('matches by title when checkCommandFirst is false', () => {
    expect(findInNodeArray(nodes, false, t => t?.includes('#_data_a') ?? false)?.id).toBe('a')
  })

  it('matches by command when checkCommandFirst is true and title does not match', () => {
    expect(findInNodeArray(nodes, true, t => t?.includes('#_cmd_b') ?? false)?.id).toBe('b')
  })

  it('title match takes precedence over command match when checkCommandFirst is false', () => {
    const dual = [
      { id: 'title-match', title: 'target text', depth: 1, children: [] },
      { id: 'cmd-match', title: 'other', command: 'target text', depth: 1, children: [] },
    ]
    expect(findInNodeArray(dual, false, t => t?.includes('target text') ?? false)?.id).toBe('title-match')
  })

  it('command match takes precedence over title match when checkCommandFirst is true', () => {
    const dual = [
      { id: 'title-match', title: 'target text', depth: 1, children: [] },
      { id: 'cmd-match', title: 'other', command: 'target text', depth: 1, children: [] },
    ]
    expect(findInNodeArray(dual, true, t => t?.includes('target text') ?? false)?.id).toBe('cmd-match')
  })

  it('falls back to title match when checkCommandFirst is true but command does not match', () => {
    const result = findInNodeArray(nodes, true, t => t?.includes('#_data_a') ?? false)
    expect(result?.id).toBe('a')
  })

  it('uses separate commandPredicate when provided', () => {
    const mixed = [
      { id: 'a', title: 'alpha content', command: 'cmd-only', depth: 1, children: [] },
      { id: 'b', title: 'beta content', command: 'find-this', depth: 1, children: [] },
    ]
    const result = findInNodeArray(
      mixed,
      true,
      t => t?.includes('alpha') ?? false,
      t => t?.includes('find-this') ?? false,
    )
    expect(result?.id).toBe('b')
  })
})

// ─── findAllInNodeArray ───────────────────────────────────────────────────────

describe('findAllInNodeArray', () => {
  const nodes = [
    { id: 'a', title: 'match here', depth: 1, children: [] },
    { id: 'b', title: 'match here too', depth: 1, children: [] },
    { id: 'c', title: 'no match', depth: 1, children: [] },
  ]

  it('returns empty array for an empty input', () => {
    expect(findAllInNodeArray([], false, () => true)).toHaveLength(0)
  })

  it('returns empty array when no nodes match', () => {
    expect(findAllInNodeArray(nodes, false, () => false)).toHaveLength(0)
  })

  it('returns all nodes matching the predicate', () => {
    const ids = findAllInNodeArray(nodes, false, t => t?.includes('match here') ?? false).map(n => n.id)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).not.toContain('c')
  })

  it('includes nodes matched by command when checkCommandFirst is true', () => {
    const withCmd = [
      { id: 'x', title: 'unrelated', command: 'target cmd', depth: 1, children: [] },
      { id: 'y', title: 'target title', depth: 1, children: [] },
    ]
    const ids = findAllInNodeArray(withCmd, true, t => t?.includes('target') ?? false).map(n => n.id)
    expect(ids).toContain('x')
    expect(ids).toContain('y')
  })
})

// ─── findAllSiblingsMatch ─────────────────────────────────────────────────────

describe('findAllSiblingsMatch', () => {
  it('returns empty array when caller node has no parent', () => {
    const nodes = nodeMap([['solo', { title: 'alone' }]])
    const store = makeNodeStore(nodes)
    expect(findAllSiblingsMatch(store.getNode('solo')!, store._nodes, false, () => true)).toHaveLength(0)
  })

  it('finds matching sibling nodes at the same level', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b', 'c'] }],
      ['a', { parent: 'root', title: '#_target data' }],
      ['b', { parent: 'root', title: 'normal' }],
      ['c', { parent: 'root', title: 'also normal' }],
    ])
    const store = makeNodeStore(nodes)
    const ids = findAllSiblingsMatch(
      store.getNode('b')!,
      store._nodes,
      false,
      t => t?.includes('#_target') ?? false,
    ).map(n => n.id)
    expect(ids).toContain('a')
    expect(ids).not.toContain('b')
  })

  it('does not include the caller node itself in results', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b'] }],
      ['a', { parent: 'root', title: 'match text' }],
      ['b', { parent: 'root', title: 'match text' }],
    ])
    const store = makeNodeStore(nodes)
    const results = findAllSiblingsMatch(
      store.getNode('b')!,
      store._nodes,
      false,
      t => t?.includes('match text') ?? false,
    )
    expect(results.map(n => n.id)).toContain('a')
  })

  it('finds matches in grandchildren when direct siblings have no match', () => {
    const nodes = nodeMap([
      ['root', { children: ['sibling', 'caller'] }],
      ['sibling', { parent: 'root', title: 'container', children: ['deep'] }],
      ['deep', { parent: 'sibling', title: '#_nested match' }],
      ['caller', { parent: 'root', title: 'caller node' }],
    ])
    const store = makeNodeStore(nodes)
    const ids = findAllSiblingsMatch(
      store.getNode('caller')!,
      store._nodes,
      false,
      t => t?.includes('#_nested') ?? false,
    ).map(n => n.id)
    expect(ids).toContain('deep')
  })

  it('returns empty array when no sibling matches and there are no children to search', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b'] }],
      ['a', { parent: 'root', title: 'no match here' }],
      ['b', { parent: 'root', title: 'no match either' }],
    ])
    const store = makeNodeStore(nodes)
    const results = findAllSiblingsMatch(store.getNode('b')!, store._nodes, false, t => t?.includes('target') ?? false)
    expect(results).toHaveLength(0)
  })

  it('respects nodeFilter to exclude nodes during deep child traversal', () => {
    const nodes = nodeMap([
      ['root', { children: ['container', 'caller'] }],
      ['container', { parent: 'root', title: 'container', children: ['fe-child', 'plain-child'] }],
      ['fe-child', { parent: 'container', title: '/foreach match' }],
      ['plain-child', { parent: 'container', title: '#_plain match' }],
      ['caller', { parent: 'root', title: 'query' }],
    ])
    const store = makeNodeStore(nodes)
    const ids = findAllSiblingsMatch(
      store.getNode('caller')!,
      store._nodes,
      false,
      t => t?.includes('match') ?? false,
      undefined,
      n => !n.title?.startsWith('/foreach'),
    ).map(n => n.id)
    expect(ids).not.toContain('fe-child')
    expect(ids).toContain('plain-child')
  })
})

// ─── substituteReferences ─────────────────────────────────────────────────────

describe('substituteReferences', () => {
  it('returns text unchanged when no @@ tokens are present', () => {
    const store = makeNodeStore(nodeMap([['n1', { title: 'plain' }]]))
    expect(substituteReferences('plain text', 0, store)).toBe('plain text')
  })

  it('removes @@ tokens when referenced node is not found', () => {
    const store = makeNodeStore(nodeMap([['n1', { title: 'other' }]]))
    expect(substituteReferences('@@nonexistent_ref text', 0, store)).not.toContain('@@')
  })

  it('substitutes @@ reference with the body text of the matching @-definition node', () => {
    const nodes = nodeMap([
      ['root', { children: ['def', 'user'], title: 'root' }],
      ['def', { parent: 'root', title: '@my_ref the referenced data' }],
      ['user', { parent: 'root', title: '@@my_ref' }],
    ])
    const store = makeNodeStore(nodes)
    const result = substituteReferences(store.getNode('user')!.title!, 0, store)
    expect(result).toContain('the referenced data')
    expect(result).not.toContain('@@my_ref')
  })

  it('@-definition prefix is stripped from the substituted output', () => {
    const nodes = nodeMap([
      ['root', { children: ['def', 'user'], title: 'root' }],
      ['def', { parent: 'root', title: '@my_ref some content' }],
      ['user', { parent: 'root', title: '@@my_ref' }],
    ])
    const store = makeNodeStore(nodes)
    const result = substituteReferences(store.getNode('user')!.title!, 0, store)
    expect(result).not.toContain('@my_ref')
  })

  it('handles multiple @@ references in one string', () => {
    const nodes = nodeMap([
      ['root', { children: ['d1', 'd2', 'user'], title: 'root' }],
      ['d1', { parent: 'root', title: '@alpha first value' }],
      ['d2', { parent: 'root', title: '@beta second value' }],
      ['user', { parent: 'root', title: '@@alpha and @@beta', command: '@@alpha and @@beta' }],
    ])
    const store = makeNodeStore(nodes)
    const result = substituteReferences(store.getNode('user')!.command!, 0, store)
    expect(result).toContain('first value')
    expect(result).toContain('second value')
  })

  it('does not throw on circular @@ references', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b'], title: 'root' }],
      ['a', { parent: 'root', title: '@ref_a @@ref_b' }],
      ['b', { parent: 'root', title: '@ref_b @@ref_a' }],
    ])
    const store = makeNodeStore(nodes)
    expect(() => substituteReferences(store.getNode('a')!.title!, 0, store)).not.toThrow()
  })
})

// ─── substituteHashrefs ───────────────────────────────────────────────────────

describe('substituteHashrefs', () => {
  it('returns text unchanged when no ##_ tokens are present', () => {
    const store = makeNodeStore(nodeMap([['n1', { title: 'plain' }]]))
    const n1 = store.getNode('n1')!
    expect(substituteHashrefs('plain text', 0, store, n1)).toBe('plain text')
  })

  it('removes ##_ tokens when matching #_ definition is not found', () => {
    const store = makeNodeStore(nodeMap([['n1', { title: 'query', command: '##_missing_ref' }]]))
    const n1 = store.getNode('n1')!
    expect(substituteHashrefs('##_missing_ref text', 0, store, n1)).not.toContain('##_')
  })

  it('substitutes ##_ usage with body text of matching #_ definition node', () => {
    const nodes = nodeMap([
      ['root', { children: ['def', 'user'], title: 'root' }],
      ['def', { parent: 'root', title: '#_my_data the data value' }],
      ['user', { parent: 'root', title: '##_my_data' }],
    ])
    const store = makeNodeStore(nodes)
    const userNode = store.getNode('user')!
    const result = substituteHashrefs(userNode.title!, 0, store, userNode)
    expect(result).toContain('the data value')
    expect(result).not.toContain('##_my_data')
  })

  it('#_ definition prefix is stripped from the substituted output', () => {
    const nodes = nodeMap([
      ['root', { children: ['def', 'user'], title: 'root' }],
      ['def', { parent: 'root', title: '#_my_data the data value' }],
      ['user', { parent: 'root', title: '##_my_data' }],
    ])
    const store = makeNodeStore(nodes)
    const userNode = store.getNode('user')!
    const result = substituteHashrefs(userNode.title!, 0, store, userNode)
    expect(result).not.toContain('#_my_data')
  })

  it(':first postfix selects only the first matching definition node', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b', 'c', 'user'], title: 'root' }],
      ['a', { parent: 'root', title: '#_item first item' }],
      ['b', { parent: 'root', title: '#_item second item' }],
      ['c', { parent: 'root', title: '#_item third item' }],
      ['user', { parent: 'root', title: '##_item:first' }],
    ])
    const store = makeNodeStore(nodes)
    const userNode = store.getNode('user')!
    const result = substituteHashrefs(userNode.title!, 0, store, userNode)
    expect(result).toContain('first item')
    expect(result).not.toContain('second item')
    expect(result).not.toContain('third item')
  })

  it(':last postfix selects only the last matching definition node', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b', 'c', 'user'], title: 'root' }],
      ['a', { parent: 'root', title: '#_item first item' }],
      ['b', { parent: 'root', title: '#_item second item' }],
      ['c', { parent: 'root', title: '#_item third item' }],
      ['user', { parent: 'root', title: 'query', command: '##_item:last' }],
    ])
    const store = makeNodeStore(nodes)
    const userNode = store.getNode('user')!
    const result = substituteHashrefs(userNode.command!, 0, store, userNode)
    expect(result).toContain('third item')
    expect(result).not.toContain('first item')
  })

  it(':first and :last postfixes select opposite ends of the matched set', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b', 'caller1', 'caller2'], title: 'root' }],
      ['a', { parent: 'root', title: '#_entry alpha' }],
      ['b', { parent: 'root', title: '#_entry omega' }],
      ['caller1', { parent: 'root', title: '##_entry:first' }],
      ['caller2', { parent: 'root', title: '##_entry:last' }],
    ])
    const store = makeNodeStore(nodes)
    const first = substituteHashrefs(store.getNode('caller1')!.title!, 0, store, store.getNode('caller1')!)
    const last = substituteHashrefs(store.getNode('caller2')!.title!, 0, store, store.getNode('caller2')!)
    expect(first).toContain('alpha')
    expect(last).toContain('omega')
    expect(first).not.toContain('omega')
    expect(last).not.toContain('alpha')
  })

  it('expands all matching nodes when no postfix is given', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b', 'user'], title: 'root' }],
      ['a', { parent: 'root', title: '#_item value one' }],
      ['b', { parent: 'root', title: '#_item value two' }],
      ['user', { parent: 'root', title: '##_item' }],
    ])
    const store = makeNodeStore(nodes)
    const userNode = store.getNode('user')!
    const result = substituteHashrefs(userNode.title!, 0, store, userNode)
    expect(result).toContain('value one')
    expect(result).toContain('value two')
  })

  it('does not expand already-seen ref name (circular guard)', () => {
    const nodes = nodeMap([
      ['root', { children: ['def', 'user'], title: 'root' }],
      ['def', { parent: 'root', title: '#_loop ##_loop' }],
      ['user', { parent: 'root', title: '##_loop' }],
    ])
    const store = makeNodeStore(nodes)
    const userNode = store.getNode('user')!
    expect(() => substituteHashrefs(userNode.title!, 0, store, userNode)).not.toThrow()
  })
})

// ─── resolveNodeReferences ────────────────────────────────────────────────────

describe('resolveNodeReferences', () => {
  it('returns node title for a plain leaf node', () => {
    const store = makeNodeStore(nodeMap([['n1', { title: 'hello world' }]]))
    expect(resolveNodeReferences(store.getNode('n1')!, store)).toBe('hello world')
  })

  it('returns command text when node has command and no references', () => {
    const store = makeNodeStore(nodeMap([['n1', { title: 'title', command: '/chatgpt summarize this' }]]))
    expect(resolveNodeReferences(store.getNode('n1')!, store)).toBe('/chatgpt summarize this')
  })

  it('resolves @@ reference and returns the referenced node content', () => {
    const nodes = nodeMap([
      ['root', { children: ['def', 'user'], title: 'root' }],
      ['def', { parent: 'root', title: '@ref_text some referenced content' }],
      ['user', { parent: 'root', title: '@@ref_text', command: '@@ref_text' }],
    ])
    const store = makeNodeStore(nodes)
    expect(resolveNodeReferences(store.getNode('user')!, store)).toContain('some referenced content')
  })

  it('resolves ##_ hashref and returns the definition node content', () => {
    const nodes = nodeMap([
      ['root', { children: ['def', 'user'], title: 'root' }],
      ['def', { parent: 'root', title: '#_data_key the data value' }],
      ['user', { parent: 'root', title: 'query', command: '##_data_key' }],
    ])
    const store = makeNodeStore(nodes)
    expect(resolveNodeReferences(store.getNode('user')!, store)).toContain('the data value')
  })

  it('strips @@ markers from final output when reference is not found', () => {
    const store = makeNodeStore(nodeMap([['n1', { title: 'no refs', command: '@@nonexistent' }]]))
    expect(resolveNodeReferences(store.getNode('n1')!, store)).not.toContain('@@')
  })

  it('strips ##_ markers from final output when hashref is not found', () => {
    const store = makeNodeStore(nodeMap([['n1', { title: 'no refs', command: '##_nonexistent' }]]))
    expect(resolveNodeReferences(store.getNode('n1')!, store)).not.toContain('##_')
  })

  it('strips residual @ definition tokens from final output', () => {
    const nodes = nodeMap([
      ['root', { children: ['def', 'user'], title: 'root' }],
      ['def', { parent: 'root', title: '@label some text' }],
      ['user', { parent: 'root', title: '@@label', command: '@@label' }],
    ])
    const store = makeNodeStore(nodes)
    expect(resolveNodeReferences(store.getNode('user')!, store)).not.toContain('@label')
  })

  it('strips residual #_ definition tokens from final output', () => {
    const nodes = nodeMap([
      ['root', { children: ['def', 'user'], title: 'root' }],
      ['def', { parent: 'root', title: '#_key some text' }],
      ['user', { parent: 'root', title: 'query', command: '##_key' }],
    ])
    const store = makeNodeStore(nodes)
    expect(resolveNodeReferences(store.getNode('user')!, store)).not.toContain('#_key')
  })

  it('includes children text indented under the parent command', () => {
    const nodes = nodeMap([
      ['root', { children: ['parent'], title: 'root' }],
      ['parent', { parent: 'root', children: ['child'], command: '/chatgpt process', title: 'parent' }],
      ['child', { parent: 'parent', title: 'child content' }],
    ])
    const store = makeNodeStore(nodes)
    const result = resolveNodeReferences(store.getNode('parent')!, store)
    expect(result).toContain('/chatgpt process')
    expect(result).toContain('child content')
  })

  it('excludes prompt children from output', () => {
    const nodes = nodeMap([
      ['root', { children: ['parent'], title: 'root' }],
      [
        'parent',
        {
          parent: 'root',
          children: ['child', 'prompt'],
          prompts: ['prompt'],
          command: '/chatgpt do work',
          title: 'parent',
        },
      ],
      ['child', { parent: 'parent', title: 'child text' }],
      ['prompt', { parent: 'parent', title: 'prompt output text' }],
    ])
    const store = makeNodeStore(nodes)
    const result = resolveNodeReferences(store.getNode('parent')!, store)
    expect(result).not.toContain('prompt output text')
    expect(result).toContain('child text')
  })

  it('produces greater indentation for deeper nesting levels', () => {
    const nodes = nodeMap([
      ['root', { children: ['mid'], title: 'root', command: '/chatgpt test' }],
      ['mid', { parent: 'root', children: ['deep'], title: 'mid level text' }],
      ['deep', { parent: 'mid', title: 'deep level text' }],
    ])
    const store = makeNodeStore(nodes)
    const lines = resolveNodeReferences(store.getNode('root')!, store).split('\n')
    const midIndent = lines.find(l => l.includes('mid level text'))!.match(/^(\s*)/)?.[1].length ?? 0
    const deepIndent = lines.find(l => l.includes('deep level text'))!.match(/^(\s*)/)?.[1].length ?? 0
    expect(deepIndent).toBeGreaterThan(midIndent)
  })

  it('returns consistent output on repeated calls with the same input', () => {
    const nodes = nodeMap([
      ['root', { children: ['child'], title: 'root' }],
      ['child', { parent: 'root', title: 'child text' }],
    ])
    const store = makeNodeStore(nodes)
    const rootNode = store.getNode('root')!
    expect(resolveNodeReferences(rootNode, store)).toBe(resolveNodeReferences(rootNode, store))
  })

  it('resolves mixed @@ and ##_ references in same command', () => {
    const nodes = nodeMap([
      ['root', { children: ['cmd', 'atref', 'hashref'], title: 'root' }],
      ['cmd', { parent: 'root', title: 'query', command: '/custom combine " @@var1 ##_var2 "' }],
      ['atref', { parent: 'root', title: '@var1 alpha' }],
      ['hashref', { parent: 'root', title: '#_var2 beta' }],
    ])
    const store = makeNodeStore(nodes)
    const result = resolveNodeReferences(store.getNode('cmd')!, store)
    expect(result).toContain('alpha')
    expect(result).toContain('beta')
    expect(result).not.toContain('@@var1')
    expect(result).not.toContain('##_var2')
  })

  it('resolves references when definition nodes have falsy command values', () => {
    const nodes = nodeMap([
      ['root', { children: ['cmd', 'vars'], title: 'Root' }],
      ['cmd', { parent: 'root', title: 'query', command: '/custom @@ref1 ##_ref2' }],
      ['vars', { parent: 'root', title: 'container', children: ['def1', 'def2', 'def3'], command: '' }],
      ['def1', { parent: 'vars', title: '@ref1 value from empty command', command: '' }],
      ['def2', { parent: 'vars', title: '#_ref2 value from null command', command: null as unknown as string }],
      ['def3', { parent: 'vars', title: 'ignored', command: undefined }],
    ])
    const store = makeNodeStore(nodes)
    const result = resolveNodeReferences(store.getNode('cmd')!, store)
    expect(result).toContain('value from empty command')
    expect(result).toContain('value from null command')
    expect(result).not.toContain('@@ref1')
    expect(result).not.toContain('##_ref2')
  })

  it('finds hashref definitions via sibling-tree traversal across different subtrees', () => {
    const nodes = nodeMap([
      ['root', { children: ['branch1', 'branch2'], title: 'root' }],
      ['branch1', { parent: 'root', title: 'branch1', children: ['cmd'] }],
      ['cmd', { parent: 'branch1', title: 'query', command: '/custom ##_ref' }],
      ['branch2', { parent: 'root', title: 'branch2', children: ['def'] }],
      ['def', { parent: 'branch2', title: '#_ref value from other branch' }],
    ])
    const store = makeNodeStore(nodes)
    const result = resolveNodeReferences(store.getNode('cmd')!, store)
    expect(result).toContain('value from other branch')
  })

  it('resolves @@ references when definition has nested child content', () => {
    const nodes = nodeMap([
      ['root', { children: ['cmd', 'def'], title: 'root' }],
      ['cmd', { parent: 'root', title: 'query', command: '/custom @@multiline' }],
      ['def', { parent: 'root', title: '@multiline header', children: ['c1', 'c2'] }],
      ['c1', { parent: 'def', title: 'line one' }],
      ['c2', { parent: 'def', title: 'line two' }],
    ])
    const store = makeNodeStore(nodes)
    const result = resolveNodeReferences(store.getNode('cmd')!, store)
    expect(result).toContain('header')
    expect(result).toContain('line one')
    expect(result).toContain('line two')
  })

  it('falls back to global search when node has no parent for sibling traversal', () => {
    const nodes = nodeMap([
      ['cmd', { title: 'orphan', command: '/custom @@ref1 ##_ref2' }],
      ['def1', { title: '@ref1 global alpha' }],
      ['def2', { title: '#_ref2 global beta' }],
    ])
    const store = makeNodeStore(nodes)
    const result = resolveNodeReferences(store.getNode('cmd')!, store)
    expect(result).toContain('global alpha')
    expect(result).toContain('global beta')
  })

  it('handles corrupted parent references without throwing', () => {
    const nodes = nodeMap([
      ['cmd', { parent: 'nonexistent', title: 'broken link', command: '/custom @@ref' }],
      ['def', { title: '@ref value' }],
    ])
    const store = makeNodeStore(nodes)
    const result = resolveNodeReferences(store.getNode('cmd')!, store)
    expect(result).toContain('value')
  })

  it('recursively resolves references when definition contains other references', () => {
    const nodes = nodeMap([
      ['root', { children: ['cmd', 'def1', 'def2'], title: 'root' }],
      ['cmd', { parent: 'root', title: 'query', command: '/custom @@outer' }],
      ['def1', { parent: 'root', title: '@outer prefix @@inner suffix' }],
      ['def2', { parent: 'root', title: '@inner nested' }],
    ])
    const store = makeNodeStore(nodes)
    const result = resolveNodeReferences(store.getNode('cmd')!, store)
    expect(result).toContain('prefix')
    expect(result).toContain('nested')
    expect(result).toContain('suffix')
    expect(result).not.toContain('@@inner')
  })
})

// ─── escapeRegexString ────────────────────────────────────────────────────────

describe('escapeRegexString', () => {
  it('escapes all regex metacharacters so the string matches literally', () => {
    const special = '.*+?^${}()|[]\\/'
    const escaped = escapeRegexString(special)
    expect(() => new RegExp(escaped)).not.toThrow()
    expect(new RegExp(escaped).test(special)).toBe(true)
  })

  it('leaves alphanumeric and underscore characters unchanged', () => {
    expect(escapeRegexString('abc_123')).toBe('abc_123')
  })

  it('escapes dot so it does not match arbitrary characters', () => {
    const escaped = escapeRegexString('a.b')
    expect(new RegExp(`^${escaped}$`).test('axb')).toBe(false)
    expect(new RegExp(`^${escaped}$`).test('a.b')).toBe(true)
  })

  it('returns empty string unchanged', () => {
    expect(escapeRegexString('')).toBe('')
  })
})

// ─── referencePatterns ────────────────────────────────────────────────────────

describe('referencePatterns', () => {
  it('ref matches @-prefixed word tokens globally', () => {
    const matches = '@alpha and @beta'.match(referencePatterns.ref)
    expect(matches).toEqual(['@alpha', '@beta'])
  })

  it('refWholeWord captures @-prefixed token as a whole word', () => {
    expect(referencePatterns.refWholeWord.test('@my_ref')).toBe(true)
    expect(referencePatterns.refWholeWord.test('prefix@my_ref')).toBe(false)
  })

  it('hashrefs matches #_-prefixed word tokens globally', () => {
    const matches = '#_a and #_b'.match(referencePatterns.hashrefs)
    expect(matches).toEqual(['#_a', '#_b'])
  })

  it('wildcardHashref matches ##_prefix* pattern', () => {
    expect(referencePatterns.wildcardHashref.test('##_data*')).toBe(true)
    expect(referencePatterns.wildcardHashref.test('##_data')).toBe(false)
  })

  it('hashrefFirst matches ##_name:first and not bare ##_name', () => {
    expect(referencePatterns.hashrefFirst.test('##_item:first')).toBe(true)
    expect(referencePatterns.hashrefFirst.test('##_item')).toBe(false)
  })

  it('hashrefLast matches ##_name:last and not bare ##_name', () => {
    expect(referencePatterns.hashrefLast.test('##_item:last')).toBe(true)
    expect(referencePatterns.hashrefLast.test('##_item')).toBe(false)
  })

  it('postfixes returns both :first and :last', () => {
    expect(referencePatterns.postfixes).toContain(':first')
    expect(referencePatterns.postfixes).toContain(':last')
  })

  it('withPrefix matches tokens with the given prefix globally', () => {
    const matches = '##_a and ##_b'.match(referencePatterns.withPrefix('##_'))
    expect(matches).toEqual(['##_a', '##_b'])
  })

  it('specific matches the exact named token with default prefix', () => {
    expect(referencePatterns.specific('my_ref').test('@my_ref')).toBe(true)
    expect(referencePatterns.specific('my_ref').test('@other_ref')).toBe(false)
  })

  it('specific matches with a custom prefix', () => {
    expect(referencePatterns.specific('key', '#_').test('#_key')).toBe(true)
    expect(referencePatterns.specific('key', '#_').test('@key')).toBe(false)
  })

  it('withAssignmentPrefix matches both prefixed and double-prefixed forms', () => {
    const pattern = referencePatterns.withAssignmentPrefix()
    expect(pattern.test('@ref_name')).toBe(true)
    expect(pattern.test('@@ref_name')).toBe(true)
  })

  it('withPrefixAndPostfixs includes optional postfixes in the match', () => {
    const pattern = referencePatterns.withPrefixAndPostfixs('##_', [':first', ':last'])
    expect('##_item:first'.match(pattern)?.[0]).toBe('##_item:first')
    expect('##_item:last'.match(pattern)?.[0]).toBe('##_item:last')
    expect('##_item'.match(pattern)?.[0]).toBe('##_item')
  })

  it('each getter returns a new RegExp instance on every access (no shared state)', () => {
    const r1 = referencePatterns.ref
    const r2 = referencePatterns.ref
    r1.lastIndex = 99
    expect(r2.lastIndex).toBe(0)
  })
})

// ─── findInNodeMap ────────────────────────────────────────────────────────────

describe('findInNodeMap', () => {
  it('returns undefined for an empty map', () => {
    expect(findInNodeMap({}, false, () => true)).toBeUndefined()
  })

  it('returns undefined when no node satisfies the predicate', () => {
    const store = makeNodeStore(nodeMap([['n1', { title: 'no match' }]]))
    expect(findInNodeMap(store._nodes, false, () => false)).toBeUndefined()
  })

  it('finds a node by title predicate', () => {
    const store = makeNodeStore(
      nodeMap([
        ['a', { title: '#_target data' }],
        ['b', { title: 'unrelated' }],
      ]),
    )
    expect(findInNodeMap(store._nodes, false, t => t?.includes('#_target') ?? false)?.id).toBe('a')
  })

  it('finds a node by command when checkCommandFirst is true', () => {
    const store = makeNodeStore(
      nodeMap([
        ['a', { title: 'title only' }],
        ['b', { title: 'other', command: 'match-command' }],
      ]),
    )
    expect(findInNodeMap(store._nodes, true, t => t?.includes('match-command') ?? false)?.id).toBe('b')
  })
})

// ─── indentedText: edge-driven connections ────────────────────────────────────

describe('indentedText: edge-driven connections', () => {
  it('appends edge title and connected node title when dense connections exist', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b', 'c', 'd'] }],
      ['a', { parent: 'root', title: 'node a' }],
      ['b', { parent: 'root', title: 'node b' }],
      ['c', { parent: 'root', title: 'node c' }],
      ['d', { parent: 'root', title: 'node d' }],
    ])
    const edges = {
      'a:b': { id: 'a:b', start: 'a', end: 'b', title: 'via' },
      'b:c': { id: 'b:c', start: 'b', end: 'c', title: 'via' },
      'c:d': { id: 'c:d', start: 'c', end: 'd', title: 'via' },
    }
    const store = makeNodeStore(nodes, edges)
    const texts = indentedText(store.getNode('root')!, store, { saveFirst: true }).map(l => l.text)
    expect(texts.join(' ')).toContain('via')
  })

  it('does not append edge info when there are no edges', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b'] }],
      ['a', { parent: 'root', title: 'node a' }],
      ['b', { parent: 'root', title: 'node b' }],
    ])
    const store = makeNodeStore(nodes, {})
    const texts = indentedText(store.getNode('root')!, store, { saveFirst: true }).map(l => l.text)
    expect(texts.every(t => !t.includes('via'))).toBe(true)
  })
})

// ─── indentedText: /summarize post-process ───────────────────────────────────

describe('indentedText: /summarize post-process', () => {
  it('ignores /summarize children when ignorePostProccessCommand is true', () => {
    const nodes = nodeMap([
      ['root', { children: ['sum', 'text'], title: 'root' }],
      ['sum', { parent: 'root', title: '/summarize do each', children: ['sum-child'] }],
      ['sum-child', { parent: 'sum', title: 'inside summarize' }],
      ['text', { parent: 'root', title: 'plain text' }],
    ])
    const store = makeNodeStore(nodes)
    const texts = indentedText(store.getNode('root')!, store, { ignorePostProccessCommand: true }).map(l => l.text)
    expect(texts.some(t => t.includes('inside summarize'))).toBe(false)
    expect(texts.some(t => t.includes('plain text'))).toBe(true)
  })

  it('includes /summarize children when ignorePostProccessCommand is false', () => {
    const nodes = nodeMap([
      ['root', { children: ['sum', 'text'], title: 'root' }],
      ['sum', { parent: 'root', title: '/summarize do each', children: ['sum-child'] }],
      ['sum-child', { parent: 'sum', title: 'inside summarize' }],
      ['text', { parent: 'root', title: 'plain text' }],
    ])
    const store = makeNodeStore(nodes)
    const texts = indentedText(store.getNode('root')!, store, { ignorePostProccessCommand: false }).map(l => l.text)
    expect(texts.some(t => t.includes('inside summarize'))).toBe(true)
  })
})

// ─── substituteHashrefs: wildcard expansion ───────────────────────────────────

describe('substituteHashrefs: wildcard expansion', () => {
  it('expands ##_prefix* to all #_prefix-named definitions in the store', () => {
    const nodes = nodeMap([
      ['root', { children: ['a', 'b', 'user'], title: 'root' }],
      ['a', { parent: 'root', title: '#_color_red red value' }],
      ['b', { parent: 'root', title: '#_color_blue blue value' }],
      ['user', { parent: 'root', title: '##_color*' }],
    ])
    const store = makeNodeStore(nodes)
    const userNode = store.getNode('user')!
    const result = substituteHashrefs(userNode.title!, 0, store, userNode)
    expect(result).toContain('red value')
    expect(result).toContain('blue value')
  })

  it('produces empty output when no definitions match the wildcard prefix', () => {
    const nodes = nodeMap([
      ['root', { children: ['user'], title: 'root' }],
      ['user', { parent: 'root', title: '##_missing*' }],
    ])
    const store = makeNodeStore(nodes)
    const userNode = store.getNode('user')!
    const result = substituteHashrefs(userNode.title!, 0, store, userNode)
    expect(result).not.toContain('##_missing*')
    expect(result).not.toContain('##_')
  })
})
