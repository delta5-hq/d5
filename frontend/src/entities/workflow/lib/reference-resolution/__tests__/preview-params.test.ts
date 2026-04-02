import { describe, it, expect } from 'vitest'
import { buildPreviewParams } from '../preview-params'

describe('buildPreviewParams', () => {
  it('returns defaults for human-readable preview display', () => {
    expect(buildPreviewParams()).toEqual({
      useCommand: false,
      nonPromptNode: false,
      saveFirst: true,
      ignorePostProccessCommand: true,
    })
  })

  it('applies overrides on top of defaults', () => {
    const params = buildPreviewParams({ useCommand: true, parentIndentation: 5 })
    expect(params.useCommand).toBe(true)
    expect(params.parentIndentation).toBe(5)
    expect(params.nonPromptNode).toBe(false)
  })
})
