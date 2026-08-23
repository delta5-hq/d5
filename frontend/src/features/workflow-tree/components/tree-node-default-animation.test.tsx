import { act, render } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TreeAnimationProvider } from '../context'
import { resetTreeAnimationState, scheduleTreeAnimation, shouldAnimateTree } from '../core/tree-animation-store'
import type { TreeNodeProps } from '../core/types'
import { TreeNodeDefault } from './tree-node-default'

Object.defineProperty(SVGElement.prototype, 'getBBox', {
  configurable: true,
  value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
})

vi.mock('@entities/aliases', () => ({ useAliases: () => ({ aliases: [] }) }))
vi.mock('@shared/lib/use-genie-state', () => ({ useGenieState: () => 'idle' }))
vi.mock('@shared/composables/use-viewport-breakpoint', () => ({ useViewportBreakpoint: () => false }))
vi.mock('../store/workflow-selectors', () => ({ useIsNodeDirty: () => false }))
vi.mock('@shared/ui/genie', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return {
    Genie: forwardRef((_props, ref) => {
      useImperativeHandle(ref, () => ({ flash: vi.fn(), play: vi.fn(), reset: vi.fn() }))
      return <div data-testid="genie" />
    }),
  }
})

const props: TreeNodeProps = {
  id: 'leaf1',
  data: {
    id: 'leaf1',
    node: { id: 'leaf1', title: 'A', command: '/chat A', parent: 'chat', children: ['result1'] },
    depth: 2,
    isOpen: false,
    isOpenByDefault: false,
    hasChildren: true,
    isPrompt: false,
    ancestorContinuation: [],
    hasMoreSiblings: false,
    rowsFromParent: 1,
    sparkDelay: 400,
  },
  isOpen: false,
  style: {},
}

function renderRow() {
  return render(
    <IntlProvider locale="en" messages={{}}>
      <TreeAnimationProvider>
        <TreeNodeDefault {...props} />
      </TreeAnimationProvider>
    </IntlProvider>,
  )
}

describe('TreeNodeDefault fan-out animation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    resetTreeAnimationState()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('activates a stable, already-mounted backend /foreach target when it is scheduled', () => {
    const { container } = renderRow()
    const spark = container.querySelector<HTMLElement>('.wire-tree-spark')!
    expect(spark).not.toHaveClass('wire-tree-spark--active')

    act(() => scheduleTreeAnimation(['leaf1'], 0, { leaf1: 0 }))
    act(() => vi.advanceTimersByTime(0))

    expect(spark).toHaveClass('wire-tree-spark--active')
    expect(spark.style.getPropertyValue('--wire-tree-spark-duration')).toBe('750ms')
  })

  it('bounds a late virtualized mount to the original completion deadline', () => {
    scheduleTreeAnimation(['leaf1'], 0, { leaf1: 100 })
    vi.advanceTimersByTime(300)

    const { container } = renderRow()
    const spark = container.querySelector<HTMLElement>('.wire-tree-spark')!
    act(() => vi.advanceTimersByTime(0))

    expect(spark).toHaveClass('wire-tree-spark--active')
    expect(spark.style.getPropertyValue('--wire-tree-spark-duration')).toBe('550ms')
  })

  it('skips a virtualized row that mounts after its animation deadline', () => {
    scheduleTreeAnimation(['leaf1'], 0, { leaf1: 100 })
    vi.advanceTimersByTime(900)

    const { container } = renderRow()
    const spark = container.querySelector<HTMLElement>('.wire-tree-spark')!
    act(() => vi.advanceTimersByTime(0))

    expect(spark).not.toHaveClass('wire-tree-spark--active')
    expect(shouldAnimateTree('leaf1')).toBe(false)
  })
})
