import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/assets/genie/base-genie.player.js?url', () => ({
  default: '/assets/base-genie.player-test.js',
}))

describe('loadPlayerRuntime', () => {
  beforeEach(() => {
    vi.resetModules()
    delete window.TgsPlayer
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete window.TgsPlayer
  })

  it('loads the emitted asset once for concurrent consumers', async () => {
    const fetchRuntime = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => {
        window.TgsPlayer = vi.fn() as unknown as NonNullable<typeof window.TgsPlayer>
        return 'window.TgsPlayer = window.TgsPlayer'
      },
    })
    vi.stubGlobal('fetch', fetchRuntime)
    const appendScript = vi.spyOn(document.head, 'appendChild')
    const { loadPlayerRuntime } = await import('../player-runtime')

    const results = await Promise.all([loadPlayerRuntime(), loadPlayerRuntime()])

    expect(results).toEqual([true, true])
    expect(fetchRuntime).toHaveBeenCalledOnce()
    expect(fetchRuntime).toHaveBeenCalledWith('/assets/base-genie.player-test.js')
    expect(appendScript).toHaveBeenCalledOnce()
  })

  it('fails closed and allows a retry when the asset is unavailable', async () => {
    const fetchRuntime = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchRuntime)
    const appendScript = vi.spyOn(document.head, 'appendChild')
    const { loadPlayerRuntime } = await import('../player-runtime')

    await expect(loadPlayerRuntime()).resolves.toBe(false)
    await expect(loadPlayerRuntime()).resolves.toBe(false)

    expect(fetchRuntime).toHaveBeenCalledTimes(2)
    expect(appendScript).not.toHaveBeenCalled()
  })

  it('reuses an already available runtime without fetching', async () => {
    window.TgsPlayer = vi.fn() as unknown as NonNullable<typeof window.TgsPlayer>
    const fetchRuntime = vi.fn()
    vi.stubGlobal('fetch', fetchRuntime)
    const { loadPlayerRuntime } = await import('../player-runtime')

    await expect(loadPlayerRuntime()).resolves.toBe(true)

    expect(fetchRuntime).not.toHaveBeenCalled()
  })
})
