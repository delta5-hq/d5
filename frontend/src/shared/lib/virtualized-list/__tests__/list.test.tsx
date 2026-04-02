import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { createElement, useState, type ReactNode } from 'react'

import { List, type ListImperativeAPI } from '../list'
import type { RowComponentProps } from '../types'
import { setupResizeObserverMock } from './resize-observer-mock'
import { resetInstanceCounter, TrackedRow, type LifecycleEvent, type TestRowProps } from './tracked-row'

setupResizeObserverMock()

const waitForRender = async () => act(async () => new Promise(r => setTimeout(r, 50)))

describe('List - Component Lifecycle', () => {
  beforeEach(() => resetInstanceCounter())
  afterEach(() => vi.restoreAllMocks())

  describe('with itemKey (stable keys)', () => {
    it('preserves component identity when items reorder', async () => {
      const events: LifecycleEvent[] = []
      const onMount = vi.fn((id: string, instanceId: string) => events.push({ type: 'mount', id, instanceId }))
      const onUnmount = vi.fn((id: string, instanceId: string) => events.push({ type: 'unmount', id, instanceId }))

      let setIds: (ids: string[]) => void

      const TestComponent = () => {
        const [ids, _setIds] = useState(['a', 'b', 'c'])
        setIds = _setIds
        return createElement(List<TestRowProps>, {
          defaultHeight: 200,
          rowComponent: TrackedRow,
          rowCount: ids.length,
          rowHeight: 50,
          rowProps: { ids, onMount, onUnmount },
          itemKey: index => ids[index],
        })
      }

      render(createElement(TestComponent))
      await waitForRender()

      events.length = 0

      await act(async () => {
        setIds(['c', 'a', 'b'])
        await waitForRender()
      })

      const unmounts = events.filter(e => e.type === 'unmount')
      const mounts = events.filter(e => e.type === 'mount')

      /* itemKey: reordering items preserves component instances - no remounts */
      expect(unmounts).toHaveLength(0)
      expect(mounts).toHaveLength(0)
    })

    it('preserves instances when items removed', async () => {
      const events: LifecycleEvent[] = []
      const onMount = vi.fn((id: string, instanceId: string) => events.push({ type: 'mount', id, instanceId }))
      const onUnmount = vi.fn((id: string, instanceId: string) => events.push({ type: 'unmount', id, instanceId }))

      let setIds: (ids: string[]) => void

      const TestComponent = () => {
        const [ids, _setIds] = useState(['a', 'b', 'c', 'd'])
        setIds = _setIds
        return createElement(List<TestRowProps>, {
          defaultHeight: 200,
          rowComponent: TrackedRow,
          rowCount: ids.length,
          rowHeight: 50,
          rowProps: { ids, onMount, onUnmount },
          itemKey: index => ids[index],
        })
      }

      render(createElement(TestComponent))
      await waitForRender()

      events.length = 0

      await act(async () => {
        setIds(['a', 'c', 'd'])
        await waitForRender()
      })

      const unmounts = events.filter(e => e.type === 'unmount')
      const mounts = events.filter(e => e.type === 'mount')

      /* itemKey: only removed item unmounts, remaining instances preserved */
      expect(unmounts).toHaveLength(1)
      expect(unmounts[0].id).toBe('b')
      expect(mounts).toHaveLength(0)
    })

    it('preserves instances when item added at start', async () => {
      const events: LifecycleEvent[] = []
      const onMount = vi.fn((id: string, instanceId: string) => events.push({ type: 'mount', id, instanceId }))
      const onUnmount = vi.fn((id: string, instanceId: string) => events.push({ type: 'unmount', id, instanceId }))

      let setIds: (ids: string[]) => void

      const TestComponent = () => {
        const [ids, _setIds] = useState(['b', 'c', 'd'])
        setIds = _setIds
        return createElement(List<TestRowProps>, {
          defaultHeight: 200,
          rowComponent: TrackedRow,
          rowCount: ids.length,
          rowHeight: 50,
          rowProps: { ids, onMount, onUnmount },
          itemKey: index => ids[index],
        })
      }

      render(createElement(TestComponent))
      await waitForRender()

      events.length = 0

      await act(async () => {
        setIds(['a', 'b', 'c', 'd'])
        await waitForRender()
      })

      const mounts = events.filter(e => e.type === 'mount')
      const unmounts = events.filter(e => e.type === 'unmount')

      /* itemKey: prepending item preserves existing instances, only new item mounts */
      expect(unmounts).toHaveLength(0)
      expect(mounts).toHaveLength(1)
      expect(mounts[0].id).toBe('a')
    })

    it('preserves instances when item added at end', async () => {
      const events: LifecycleEvent[] = []
      const onMount = vi.fn((id: string, instanceId: string) => events.push({ type: 'mount', id, instanceId }))
      const onUnmount = vi.fn((id: string, instanceId: string) => events.push({ type: 'unmount', id, instanceId }))

      let setIds: (ids: string[]) => void

      const TestComponent = () => {
        const [ids, _setIds] = useState(['a', 'b', 'c'])
        setIds = _setIds
        return createElement(List<TestRowProps>, {
          defaultHeight: 200,
          rowComponent: TrackedRow,
          rowCount: ids.length,
          rowHeight: 50,
          rowProps: { ids, onMount, onUnmount },
          itemKey: index => ids[index],
        })
      }

      render(createElement(TestComponent))
      await waitForRender()

      events.length = 0

      await act(async () => {
        setIds(['a', 'b', 'c', 'd'])
        await waitForRender()
      })

      const mounts = events.filter(e => e.type === 'mount')
      const unmounts = events.filter(e => e.type === 'unmount')

      /* itemKey: adding to end preserves existing instances, only new item mounts */
      expect(unmounts).toHaveLength(0)
      expect(mounts).toHaveLength(1)
      expect(mounts[0].id).toBe('d')
    })

    it('preserves instances when item removed from middle', async () => {
      const events: LifecycleEvent[] = []
      const onMount = vi.fn((id: string, instanceId: string) => events.push({ type: 'mount', id, instanceId }))
      const onUnmount = vi.fn((id: string, instanceId: string) => events.push({ type: 'unmount', id, instanceId }))

      let setIds: (ids: string[]) => void

      const TestComponent = () => {
        const [ids, _setIds] = useState(['a', 'b', 'c', 'd', 'e'])
        setIds = _setIds
        return createElement(List<TestRowProps>, {
          defaultHeight: 200,
          rowComponent: TrackedRow,
          rowCount: ids.length,
          rowHeight: 50,
          rowProps: { ids, onMount, onUnmount },
          itemKey: index => ids[index],
        })
      }

      render(createElement(TestComponent))
      await waitForRender()

      events.length = 0

      await act(async () => {
        setIds(['a', 'b', 'd', 'e'])
        await waitForRender()
      })

      const unmounts = events.filter(e => e.type === 'unmount')
      const mounts = events.filter(e => e.type === 'mount')

      /* itemKey: removing middle item only unmounts that item, rest preserved */
      expect(unmounts).toHaveLength(1)
      expect(unmounts[0].id).toBe('c')
      expect(mounts).toHaveLength(0)
    })
  })

  describe('without itemKey (index-based keys)', () => {
    it('triggers remounts when item removed from middle', async () => {
      const events: LifecycleEvent[] = []
      const onMount = vi.fn((id: string, instanceId: string) => events.push({ type: 'mount', id, instanceId }))
      const onUnmount = vi.fn((id: string, instanceId: string) => events.push({ type: 'unmount', id, instanceId }))

      let setIds: (ids: string[]) => void

      const TestComponent = () => {
        const [ids, _setIds] = useState(['a', 'b', 'c', 'd'])
        setIds = _setIds
        return createElement(List<TestRowProps>, {
          defaultHeight: 200,
          rowComponent: TrackedRow,
          rowCount: ids.length,
          rowHeight: 50,
          rowProps: { ids, onMount, onUnmount },
        })
      }

      render(createElement(TestComponent))
      await waitForRender()

      events.length = 0

      await act(async () => {
        setIds(['a', 'c', 'd'])
        await waitForRender()
      })

      const unmounts = events.filter(e => e.type === 'unmount')
      const mounts = events.filter(e => e.type === 'mount')

      /* Without itemKey: removing middle item causes shifted items to remount */
      expect(unmounts.length).toBeGreaterThan(0)
      expect(mounts.length).toBeGreaterThan(0)
    })
  })
})

describe('List - Edge Cases', () => {
  const onMount = vi.fn()
  const onUnmount = vi.fn()

  beforeEach(() => {
    resetInstanceCounter()
    onMount.mockClear()
    onUnmount.mockClear()
  })

  it('handles empty list', async () => {
    const TestComponent = () =>
      createElement(List<TestRowProps>, {
        defaultHeight: 200,
        rowComponent: TrackedRow,
        rowCount: 0,
        rowHeight: 50,
        rowProps: { ids: [], onMount, onUnmount },
      })

    const { container } = render(createElement(TestComponent))
    await waitForRender()

    expect(container.querySelector('[role="list"]')).toBeInTheDocument()
    expect(onMount).not.toHaveBeenCalled()
  })

  it('handles single item', async () => {
    const TestComponent = () =>
      createElement(List<TestRowProps>, {
        defaultHeight: 200,
        rowComponent: TrackedRow,
        rowCount: 1,
        rowHeight: 50,
        rowProps: { ids: ['single'], onMount, onUnmount },
        itemKey: (index, props) => props.ids[index],
      })

    render(createElement(TestComponent))
    await waitForRender()

    expect(onMount).toHaveBeenCalledTimes(1)
    expect(onMount).toHaveBeenCalledWith('single', expect.any(String))
  })

  it('handles transition from empty to populated', async () => {
    let setIds: (ids: string[]) => void

    const TestComponent = () => {
      const [ids, _setIds] = useState<string[]>([])
      setIds = _setIds
      return createElement(List<TestRowProps>, {
        defaultHeight: 200,
        rowComponent: TrackedRow,
        rowCount: ids.length,
        rowHeight: 50,
        rowProps: { ids, onMount, onUnmount },
        itemKey: (index, props) => props.ids[index],
      })
    }

    render(createElement(TestComponent))
    await waitForRender()

    expect(onMount).not.toHaveBeenCalled()

    await act(async () => {
      setIds(['a', 'b', 'c'])
      await waitForRender()
    })

    expect(onMount).toHaveBeenCalledTimes(3)
  })

  it('handles transition from populated to empty', async () => {
    let setIds: (ids: string[]) => void

    const TestComponent = () => {
      const [ids, _setIds] = useState(['a', 'b', 'c'])
      setIds = _setIds
      return createElement(List<TestRowProps>, {
        defaultHeight: 200,
        rowComponent: TrackedRow,
        rowCount: ids.length,
        rowHeight: 50,
        rowProps: { ids, onMount, onUnmount },
        itemKey: (index, props) => props.ids[index],
      })
    }

    render(createElement(TestComponent))
    await waitForRender()

    onMount.mockClear()
    onUnmount.mockClear()

    await act(async () => {
      setIds([])
      await waitForRender()
    })

    expect(onUnmount).toHaveBeenCalledTimes(3)
    expect(onMount).not.toHaveBeenCalled()
  })
})

describe('List - Virtualization', () => {
  it('only renders visible items plus overscan', async () => {
    const renderCounts: Record<string, number> = {}

    const CountingRow = ({ index, rowProps }: RowComponentProps<{ ids: string[] }>): ReactNode => {
      const { ids } = rowProps
      const id = ids[index]
      renderCounts[id] = (renderCounts[id] || 0) + 1
      return createElement('div', null, id)
    }

    const ids = Array.from({ length: 100 }, (_, i) => `item-${i}`)

    render(
      createElement(List<{ ids: string[] }>, {
        defaultHeight: 200,
        rowComponent: CountingRow,
        rowCount: ids.length,
        rowHeight: 50,
        rowProps: { ids },
        overscanCount: 2,
        itemKey: (index, props) => props.ids[index],
      }),
    )

    await waitForRender()

    const renderedCount = Object.keys(renderCounts).length
    expect(renderedCount).toBeLessThanOrEqual(8)
    expect(renderedCount).toBeGreaterThanOrEqual(4)
  })

  it('respects overscanCount parameter', async () => {
    const renderCounts: Record<string, number> = {}

    const CountingRow = ({ index, rowProps }: RowComponentProps<{ ids: string[] }>): ReactNode => {
      const { ids } = rowProps
      const id = ids[index]
      renderCounts[id] = (renderCounts[id] || 0) + 1
      return createElement('div', null, id)
    }

    const ids = Array.from({ length: 100 }, (_, i) => `item-${i}`)

    render(
      createElement(List<{ ids: string[] }>, {
        defaultHeight: 200,
        rowComponent: CountingRow,
        rowCount: ids.length,
        rowHeight: 50,
        rowProps: { ids },
        overscanCount: 5,
        itemKey: (index, props) => props.ids[index],
      }),
    )

    await waitForRender()

    const renderedCount = Object.keys(renderCounts).length
    expect(renderedCount).toBeGreaterThan(8)
  })
})

describe('List - Imperative API', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = function (this: HTMLElement, options?: ScrollToOptions | number, _y?: number) {
      if (typeof options === 'object' && options?.top !== undefined) {
        this.scrollTop = options.top
      }
    }
  })

  it('exposes element via ref', async () => {
    let api: ListImperativeAPI | null = null

    const TestComponent = () =>
      createElement(List<TestRowProps>, {
        defaultHeight: 200,
        rowComponent: TrackedRow,
        rowCount: 3,
        rowHeight: 50,
        rowProps: { ids: ['a', 'b', 'c'], onMount: vi.fn(), onUnmount: vi.fn() },
        listRef: ref => {
          api = ref
        },
      })

    render(createElement(TestComponent))
    await waitForRender()

    expect(api).toBeDefined()
    expect(api!.element).toBeInstanceOf(HTMLDivElement)
  })

  it('scrollToRow scrolls to specified item', async () => {
    let api: ListImperativeAPI | null = null
    const ids = Array.from({ length: 100 }, (_, i) => `item-${i}`)

    const SimpleRow = ({ index }: RowComponentProps<{ ids: string[] }>): ReactNode =>
      createElement('div', { 'data-testid': `item-${index}` }, `Item ${index}`)

    const TestComponent = () =>
      createElement(List<{ ids: string[] }>, {
        defaultHeight: 200,
        rowComponent: SimpleRow,
        rowCount: ids.length,
        rowHeight: 50,
        rowProps: { ids },
        listRef: ref => {
          api = ref
        },
      })

    render(createElement(TestComponent))
    await waitForRender()

    expect(api!.element!.scrollTop).toBe(0)

    act(() => {
      api!.scrollToRow({ index: 50, align: 'start' })
    })

    await waitForRender()

    expect(api!.element!.scrollTop).toBeGreaterThan(0)
  })

  it('scrollToRow handles invalid index gracefully', async () => {
    let api: ListImperativeAPI | null = null

    const TestComponent = () =>
      createElement(List<TestRowProps>, {
        defaultHeight: 200,
        rowComponent: TrackedRow,
        rowCount: 3,
        rowHeight: 50,
        rowProps: { ids: ['a', 'b', 'c'], onMount: vi.fn(), onUnmount: vi.fn() },
        listRef: ref => {
          api = ref
        },
      })

    render(createElement(TestComponent))
    await waitForRender()

    expect(() => {
      api!.scrollToRow({ index: -1 })
    }).not.toThrow()

    expect(() => {
      api!.scrollToRow({ index: 999 })
    }).not.toThrow()
  })
})

describe('List - Callbacks', () => {
  it('calls onRowsRendered with visible range', async () => {
    const onRowsRendered = vi.fn()

    const TestComponent = () =>
      createElement(List<TestRowProps>, {
        defaultHeight: 200,
        rowComponent: TrackedRow,
        rowCount: 10,
        rowHeight: 50,
        rowProps: { ids: Array.from({ length: 10 }, (_, i) => `item-${i}`), onMount: vi.fn(), onUnmount: vi.fn() },
        onRowsRendered,
      })

    render(createElement(TestComponent))
    await waitForRender()

    expect(onRowsRendered).toHaveBeenCalled()
    const lastCall = onRowsRendered.mock.calls[onRowsRendered.mock.calls.length - 1]
    expect(lastCall[0]).toHaveProperty('startIndex')
    expect(lastCall[0]).toHaveProperty('stopIndex')
  })
})
