import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RadialFlash } from './radial-flash'

describe('RadialFlash lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not start player polling after unmount while the runtime is loading', async () => {
    vi.useFakeTimers()

    let resolveFetch: (response: { text: () => Promise<string> }) => void = () => {}
    const pendingFetch = new Promise<{ text: () => Promise<string> }>(resolve => {
      resolveFetch = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pendingFetch),
    )

    const { unmount } = render(<RadialFlash nodeId="lifecycle-proof" />)
    unmount()

    await act(async () => {
      resolveFetch({ text: async () => '' })
      await pendingFetch
      await Promise.resolve()
    })

    expect(vi.getTimerCount()).toBe(0)
  })
})
