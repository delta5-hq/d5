import { describe, expect, it } from 'vitest'
import type { TreeState } from '../core/types'
import type { SegmentState } from '../segments'
import { getAnimationResultScrollTargetIndex, getAnimationScrollTargetIndex } from './virtualized-segment-tree'

const segmentState = {
  segments: [],
  segmentHeights: [],
  nodeToSegmentIndex: new Map([
    ['foreach', 7],
    ['alpha', 8],
    ['beta', 9],
    ['alpha-result', 9],
    ['beta-result', 11],
  ]),
} as unknown as SegmentState

const treeState = {
  order: ['foreach', 'alpha', 'alpha-result', 'beta', 'beta-result'],
  records: {
    alpha: { data: { isOpen: true, node: { id: 'alpha', children: ['alpha-result'] } } },
    beta: { data: { isOpen: true, node: { id: 'beta', children: ['beta-result'] } } },
  },
} as unknown as TreeState

describe('getAnimationScrollTargetIndex', () => {
  it('anchors the virtualized list to the last direct target so the fan-out group is visible', () => {
    expect(getAnimationScrollTargetIndex(segmentState, ['alpha', 'beta'])).toBe(9)
  })

  it('ignores pending targets that are not in the visible tree', () => {
    expect(getAnimationScrollTargetIndex(segmentState, ['missing', 'alpha'])).toBe(8)
    expect(getAnimationScrollTargetIndex(segmentState, ['missing'])).toBeUndefined()
  })
})

describe('getAnimationResultScrollTargetIndex', () => {
  it('anchors to the last revealed result only after its direct target opens', () => {
    expect(getAnimationResultScrollTargetIndex(treeState, segmentState, ['alpha', 'beta'])).toBe(11)

    const hiddenResults = {
      ...treeState,
      records: {
        ...treeState.records,
        beta: { ...treeState.records.beta, data: { ...treeState.records.beta.data, isOpen: false } },
      },
    }
    expect(getAnimationResultScrollTargetIndex(hiddenResults, segmentState, ['beta'])).toBeUndefined()
  })
})
