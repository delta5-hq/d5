import { describe, it, expect } from 'vitest'
import type { CSSProperties } from 'react'
import type { NodeData } from '@/shared/base-types/workflow'
import type { TreeNode, TreeNodeProps } from '../types'
import { comparePositionStyle, compareTreeNodeData, areTreeNodePropsEqual } from '../tree-node-memo'

const makeNode = (overrides: Partial<NodeData> = {}): NodeData => ({
  id: 'n1',
  title: 'Test',
  children: [],
  ...overrides,
})

const makeTreeNode = (overrides: Partial<TreeNode> = {}): TreeNode => ({
  id: 'n1',
  node: makeNode(),
  depth: 1,
  isOpen: false,
  isOpenByDefault: false,
  hasChildren: false,
  ancestorContinuation: [true, false],
  hasMoreSiblings: false,
  rowsFromParent: 1,
  sparkDelay: 0,
  ...overrides,
})

describe('comparePositionStyle', () => {
  it('same reference → equal', () => {
    const s: CSSProperties = { transform: 'translateY(48px)', height: 48 }
    expect(comparePositionStyle(s, s)).toBe(true)
  })

  it('same transform + height → equal regardless of other properties', () => {
    const a: CSSProperties = { position: 'absolute', transform: 'translateY(48px)', height: 48, width: '100%' }
    const b: CSSProperties = { position: 'relative', transform: 'translateY(48px)', height: 48, width: '50%' }
    expect(comparePositionStyle(a, b)).toBe(true)
  })

  it('both empty objects → equal', () => {
    expect(comparePositionStyle({}, {})).toBe(true)
  })

  it('different transform → not equal', () => {
    const a: CSSProperties = { transform: 'translateY(48px)', height: 48 }
    const b: CSSProperties = { transform: 'translateY(96px)', height: 48 }
    expect(comparePositionStyle(a, b)).toBe(false)
  })

  it('different height → not equal', () => {
    const a: CSSProperties = { transform: 'translateY(48px)', height: 48 }
    const b: CSSProperties = { transform: 'translateY(48px)', height: 96 }
    expect(comparePositionStyle(a, b)).toBe(false)
  })

  it('undefined vs object → not equal', () => {
    expect(comparePositionStyle(undefined, { height: 48 })).toBe(false)
    expect(comparePositionStyle({ height: 48 }, undefined)).toBe(false)
  })

  it('both undefined → equal', () => {
    expect(comparePositionStyle(undefined, undefined)).toBe(true)
  })
})

describe('compareTreeNodeData', () => {
  it('same reference → equal', () => {
    const tn = makeTreeNode()
    expect(compareTreeNodeData(tn, tn)).toBe(true)
  })

  it('same NodeData ref + same metadata → equal', () => {
    const sharedNode = makeNode()
    const a = makeTreeNode({ node: sharedNode })
    const b = makeTreeNode({ node: sharedNode })
    expect(compareTreeNodeData(a, b)).toBe(true)
  })

  it('different NodeData ref → not equal', () => {
    const a = makeTreeNode({ node: makeNode({ title: 'A' }) })
    const b = makeTreeNode({ node: makeNode({ title: 'B' }) })
    expect(compareTreeNodeData(a, b)).toBe(false)
  })

  it.each([
    { field: 'depth', a: 1, b: 2 },
    { field: 'isOpen', a: false, b: true },
    { field: 'hasMoreSiblings', a: false, b: true },
    { field: 'rowsFromParent', a: 1, b: 3 },
  ] as const)('different $field → not equal', ({ field, a, b }) => {
    const sharedNode = makeNode()
    expect(
      compareTreeNodeData(
        makeTreeNode({ node: sharedNode, [field]: a }),
        makeTreeNode({ node: sharedNode, [field]: b }),
      ),
    ).toBe(false)
  })

  it('different ancestorContinuation values → not equal', () => {
    const sharedNode = makeNode()
    const a = makeTreeNode({ node: sharedNode, ancestorContinuation: [true, false] })
    const b = makeTreeNode({ node: sharedNode, ancestorContinuation: [true, true] })
    expect(compareTreeNodeData(a, b)).toBe(false)
  })

  it('different ancestorContinuation length → not equal', () => {
    const sharedNode = makeNode()
    const a = makeTreeNode({ node: sharedNode, ancestorContinuation: [true] })
    const b = makeTreeNode({ node: sharedNode, ancestorContinuation: [true, false] })
    expect(compareTreeNodeData(a, b)).toBe(false)
  })

  it('same ancestorContinuation reference → shortcircuits equal', () => {
    const sharedNode = makeNode()
    const sharedContinuation = [true, false, true]
    const a = makeTreeNode({ node: sharedNode, ancestorContinuation: sharedContinuation })
    const b = makeTreeNode({ node: sharedNode, ancestorContinuation: sharedContinuation })
    expect(compareTreeNodeData(a, b)).toBe(true)
  })

  it('both empty ancestorContinuation → equal', () => {
    const sharedNode = makeNode()
    const a = makeTreeNode({ node: sharedNode, ancestorContinuation: [] })
    const b = makeTreeNode({ node: sharedNode, ancestorContinuation: [] })
    expect(compareTreeNodeData(a, b)).toBe(true)
  })

  it('undefined vs value → not equal', () => {
    expect(compareTreeNodeData(undefined, makeTreeNode())).toBe(false)
    expect(compareTreeNodeData(makeTreeNode(), undefined)).toBe(false)
  })

  it('both undefined → equal', () => {
    expect(compareTreeNodeData(undefined, undefined)).toBe(true)
  })
})

describe('areTreeNodePropsEqual', () => {
  const noop = () => {}
  const sharedNode = makeNode()
  const sharedData = makeTreeNode({ node: sharedNode })
  const sharedStyle: CSSProperties = { transform: 'translateY(0px)', height: 48 }

  const baseProps = (): TreeNodeProps => ({
    id: 'n1',
    data: sharedData,
    isOpen: false,
    style: sharedStyle,
    isSelected: false,
    autoEditNodeId: undefined,
    onToggle: noop,
    onSelect: noop,
    onAddChild: noop,
    onRequestDelete: noop,
    onDuplicateNode: noop,
    onRename: noop,
    onRequestRename: noop,
    wireExtendDown: 0,
    wireExtendUp: 0,
  })

  it('identical props object → equal', () => {
    const props = baseProps()
    expect(areTreeNodePropsEqual(props, props)).toBe(true)
  })

  it('same values, different object → equal', () => {
    expect(areTreeNodePropsEqual(baseProps(), baseProps())).toBe(true)
  })

  describe('deep data comparison', () => {
    it('data object identity differs but content same → equal', () => {
      const data2 = makeTreeNode({ node: sharedNode })
      expect(areTreeNodePropsEqual(baseProps(), { ...baseProps(), data: data2 })).toBe(true)
    })

    it('data node ref changed → not equal', () => {
      const newData = makeTreeNode({ node: makeNode({ title: 'Renamed' }) })
      expect(areTreeNodePropsEqual(baseProps(), { ...baseProps(), data: newData })).toBe(false)
    })
  })

  describe('deep style comparison', () => {
    it('style object identity differs but values same → equal', () => {
      const prev = { ...baseProps(), style: { transform: 'translateY(48px)', height: 48 } }
      const next = { ...baseProps(), style: { transform: 'translateY(48px)', height: 48 } }
      expect(areTreeNodePropsEqual(prev, next)).toBe(true)
    })

    it('style position shifted → not equal', () => {
      const prev = { ...baseProps(), style: { transform: 'translateY(48px)', height: 48 } }
      const next = { ...baseProps(), style: { transform: 'translateY(96px)', height: 48 } }
      expect(areTreeNodePropsEqual(prev, next)).toBe(false)
    })
  })

  describe('autoEditNodeId semantics', () => {
    it('targets this node → not equal', () => {
      const prev = { ...baseProps(), autoEditNodeId: undefined }
      const next = { ...baseProps(), autoEditNodeId: 'n1' }
      expect(areTreeNodePropsEqual(prev, next)).toBe(false)
    })

    it('leaves this node → not equal', () => {
      const prev = { ...baseProps(), autoEditNodeId: 'n1' }
      const next = { ...baseProps(), autoEditNodeId: undefined }
      expect(areTreeNodePropsEqual(prev, next)).toBe(false)
    })

    it('changed but not targeting this node → equal', () => {
      const prev = { ...baseProps(), autoEditNodeId: undefined }
      const next = { ...baseProps(), autoEditNodeId: 'other-id' }
      expect(areTreeNodePropsEqual(prev, next)).toBe(true)
    })

    it('changed between two non-self values → equal', () => {
      const prev = { ...baseProps(), autoEditNodeId: 'other-1' }
      const next = { ...baseProps(), autoEditNodeId: 'other-2' }
      expect(areTreeNodePropsEqual(prev, next)).toBe(true)
    })

    it('both targeting this node → equal', () => {
      const prev = { ...baseProps(), autoEditNodeId: 'n1' }
      const next = { ...baseProps(), autoEditNodeId: 'n1' }
      expect(areTreeNodePropsEqual(prev, next)).toBe(true)
    })

    it('both undefined → equal', () => {
      expect(areTreeNodePropsEqual(baseProps(), baseProps())).toBe(true)
    })
  })

  describe('scalar prop identity', () => {
    it.each([
      { prop: 'id', value: 'n2' },
      { prop: 'isOpen', value: true },
      { prop: 'isSelected', value: true },
      { prop: 'wireExtendDown', value: 10 },
      { prop: 'wireExtendUp', value: 10 },
    ])('$prop change → not equal', ({ prop, value }) => {
      expect(areTreeNodePropsEqual(baseProps(), { ...baseProps(), [prop]: value })).toBe(false)
    })
  })

  describe('callback identity', () => {
    it.each([
      { callback: 'onToggle' },
      { callback: 'onSelect' },
      { callback: 'onAddChild' },
      { callback: 'onRequestDelete' },
      { callback: 'onDuplicateNode' },
      { callback: 'onRename' },
      { callback: 'onRequestRename' },
    ])('$callback ref change → not equal', ({ callback }) => {
      expect(areTreeNodePropsEqual(baseProps(), { ...baseProps(), [callback]: () => {} })).toBe(false)
    })

    it('undefined optional callbacks on both sides → equal', () => {
      const withUndefined = {
        ...baseProps(),
        onAddChild: undefined,
        onRequestDelete: undefined,
        onDuplicateNode: undefined,
        onRename: undefined,
        onRequestRename: undefined,
      }
      expect(areTreeNodePropsEqual(withUndefined, { ...withUndefined })).toBe(true)
    })
  })
})
