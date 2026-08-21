import { describe, expect, it } from 'vitest'
import type { NodeData } from '@shared/base-types'
import {
  hasValidTitleProjection,
  remapTitleProjection,
  sanitizeTitleProjections,
  withTitleProjection,
  withoutTitleProjection,
} from './title-projection'

const nodes = (parent: Partial<NodeData> = {}, child: Partial<NodeData> = {}): Record<string, NodeData> => ({
  parent: { id: 'parent', title: 'Source', children: ['child'], ...parent },
  child: { id: 'child', title: 'Source', parent: 'parent', children: [], ...child },
})

describe('titleProjection', () => {
  const singleProjection = { sourceTitle: 'Source', childIds: ['child'], nodeIds: ['child'] }

  it('is valid only when source title and the complete projected shape still match', () => {
    const valid = nodes({ titleProjection: singleProjection })
    expect(hasValidTitleProjection(valid.parent, valid)).toBe(true)

    const edited = nodes({ title: 'Edited', titleProjection: singleProjection })
    expect(hasValidTitleProjection(edited.parent, edited)).toBe(false)

    const missingChild = nodes({ children: [], titleProjection: singleProjection })
    expect(hasValidTitleProjection(missingChild.parent, missingChild)).toBe(false)

    const reparentedChild = nodes({ titleProjection: singleProjection }, { parent: 'other-parent' })
    expect(hasValidTitleProjection(reparentedChild.parent, reparentedChild)).toBe(false)

    const renamedChild = nodes({ titleProjection: singleProjection }, { title: 'Changed source line' })
    expect(hasValidTitleProjection(renamedChild.parent, renamedChild)).toBe(false)
  })

  it('invalidates nested edits, deletion, reparenting, and projected-sibling reorder', () => {
    const projection = {
      sourceTitle: 'Root\n  First\n  Second',
      childIds: ['root-line'],
      nodeIds: ['root-line', 'first', 'second'],
    }
    const source: Record<string, NodeData> = {
      parent: { id: 'parent', title: projection.sourceTitle, children: ['root-line'], titleProjection: projection },
      'root-line': { id: 'root-line', title: 'Root', parent: 'parent', children: ['first', 'second'] },
      first: { id: 'first', title: 'First', parent: 'root-line', children: [] },
      second: { id: 'second', title: 'Second', parent: 'root-line', children: [] },
    }

    expect(hasValidTitleProjection(source.parent, source)).toBe(true)
    expect(hasValidTitleProjection(source.parent, { ...source, first: { ...source.first, title: 'Edited' } })).toBe(
      false,
    )
    const withoutSecond = { ...source }
    delete withoutSecond.second
    expect(hasValidTitleProjection(source.parent, withoutSecond)).toBe(false)
    expect(
      hasValidTitleProjection(source.parent, { ...source, second: { ...source.second, parent: 'somewhere-else' } }),
    ).toBe(false)
    expect(
      hasValidTitleProjection(source.parent, {
        ...source,
        'root-line': { ...source['root-line'], children: ['second', 'first'] },
      }),
    ).toBe(false)
  })

  it('sanitizes invalid projections without changing valid nodes', () => {
    const source = {
      ...nodes({ titleProjection: singleProjection }),
      stale: {
        id: 'stale',
        title: 'Edited',
        children: ['stale-child'],
        titleProjection: { sourceTitle: 'Source', childIds: ['stale-child'], nodeIds: ['stale-child'] },
      },
      'stale-child': { id: 'stale-child', title: 'Source', parent: 'stale', children: [] },
    }

    const result = sanitizeTitleProjections(source)

    expect(result.parent).toBe(source.parent)
    expect(result.stale.titleProjection).toBeUndefined()
  })

  it('remaps complete projected subtrees and drops incomplete remaps', () => {
    const projected = withTitleProjection(nodes().parent, 'Source', ['child'], ['child'])

    expect(remapTitleProjection(projected, { child: 'child-copy' }).titleProjection).toEqual({
      sourceTitle: 'Source',
      childIds: ['child-copy'],
      nodeIds: ['child-copy'],
    })
    expect(remapTitleProjection(projected, {}).titleProjection).toBeUndefined()
  })

  it('removes projection without mutating the original node', () => {
    const projected = withTitleProjection(nodes().parent, 'Source', ['child'], ['child'])
    const result = withoutTitleProjection(projected)

    expect(result.titleProjection).toBeUndefined()
    expect(projected.titleProjection).toEqual({ sourceTitle: 'Source', childIds: ['child'], nodeIds: ['child'] })
  })
})
