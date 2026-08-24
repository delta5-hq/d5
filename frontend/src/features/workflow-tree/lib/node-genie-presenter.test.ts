import { describe, expect, it } from 'vitest'
import { getNodeGeniePresentation } from './node-genie-presenter'

describe('getNodeGeniePresentation', () => {
  it('presents command-bearing nodes as full genies with role color', () => {
    expect(getNodeGeniePresentation({ command: '/chat hello' }, { depth: 1 })).toEqual({
      color: '#ffa726',
      showHandRibs: true,
      variant: 'full',
    })
  })

  it('presents commandless nodes as muted clipboards', () => {
    expect(getNodeGeniePresentation({ command: '   ' }, { depth: 1 })).toEqual({
      color: 'var(--muted-foreground)',
      showHandRibs: false,
      variant: 'clipboard',
    })
  })

  it('keeps hand ribs off outside shallow tree rows', () => {
    expect(getNodeGeniePresentation({ command: '/chat hello' }, { depth: 3 }).showHandRibs).toBe(false)
    expect(getNodeGeniePresentation({ command: '/chat hello' }).showHandRibs).toBe(false)
  })
})
