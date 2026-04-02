import type { ComponentType, ReactNode } from 'react'
import type { NodeData } from '@/shared/base-types/workflow'
import type { TreeNode } from '../core/types'

export interface ContainerProps {
  children: ReactNode
  depth: number
  parentNode: NodeData
}

export interface ContainerConfig {
  type: 'card' | 'highlight' | 'group'
  /** IDs of children to include. If omitted, includes all immediate children */
  childrenIds?: string[]
  component?: ComponentType<ContainerProps>
  paddingTop?: number
  paddingBottom?: number
  /** When true, parent node renders inside the container wrapper alongside children */
  includeParent?: boolean
}

export interface SegmentNode {
  type: 'node'
  data: TreeNode
  /** Original row index in tree order (for spark path calculation) */
  rowIndex: number
}

export interface SegmentContainer {
  type: 'container'
  parentNode: NodeData
  parentTreeNode: TreeNode
  config: ContainerConfig
  children: TreeNode[]
  /** Row indices for each child in tree order */
  childRowIndices: number[]
  depth: number
  /** Original row index of the parent node in tree order */
  parentRowIndex: number
}

export type Segment = SegmentNode | SegmentContainer

export interface SegmentState {
  segments: Segment[]
  segmentHeights: number[]
  nodeToSegmentIndex: Map<string, number>
}

export interface SegmentComputeOptions {
  rowHeight: number
}
