import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import { describe, expect, it, vi } from 'vitest'
import { TreeAnimationProvider } from '../context'
import type { TreeNodeProps } from '../core/types'
import { SegmentRow } from './segment-row'
import { TreeNodeDefault } from './tree-node-default'

Object.defineProperty(SVGElement.prototype, 'getBBox', {
  configurable: true,
  value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
})

vi.mock('@entities/aliases', () => ({ useAliases: () => ({ aliases: [] }) }))
vi.mock('@shared/lib/use-genie-state', () => ({ useGenieState: () => 'idle' }))
vi.mock('@shared/composables/use-viewport-breakpoint', () => ({ useViewportBreakpoint: () => false }))
vi.mock('../store/workflow-selectors', () => ({ useIsNodeDirty: () => false, useIsAwaitingFanOutSpark: () => false }))
vi.mock('@shared/ui/genie', () => ({
  Genie: () => <div data-testid="genie" />,
}))

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

describe('TreeNodeDefault row operations', () => {
  it('renders a gapless thought tail only when the full Genie is present', () => {
    const { container } = renderRowWith({})

    expect(screen.getByTestId('node-thought-tail')).toBeInTheDocument()
    expect(container.querySelector('.workflow-tree-chip-strip')).toHaveClass('ml-0')
    expect(screen.getByTestId('node-thought-tail').querySelector('circle:last-child')).toHaveAttribute('cx', '13')
  })

  it('omits the thought tail for a clipboard-only row', () => {
    const { container } = renderRowWith({
      data: {
        ...props.data,
        node: { ...props.data.node, command: undefined },
      },
    })

    expect(screen.queryByTestId('node-thought-tail')).not.toBeInTheDocument()
    expect(container.querySelector('.workflow-tree-chip-strip')).toHaveClass('ml-2')
  })

  it('routes Add sibling from the overflow menu', async () => {
    const onAddSibling = vi.fn()
    const { container } = renderRowWith({ onAddSibling })
    const row = container.querySelector('[data-node-id="leaf1"]')!

    fireEvent.contextMenu(row)
    const item = await screen.findByText('Add Sibling')
    fireEvent.click(item)

    await waitFor(() => expect(onAddSibling).toHaveBeenCalledWith('leaf1'))
  })

  it('homes direct row operations on row controls and keeps structural operations in overflow', async () => {
    const { container } = renderRowWith({
      onAddChild: vi.fn(),
      onAddSibling: vi.fn(),
      onDelete: vi.fn(),
      onDuplicateNode: vi.fn(),
      onWrapNodes: vi.fn(),
    })
    const row = container.querySelector('[data-node-id="leaf1"]')!

    expect(screen.getByTestId('node-add-child')).toBeInTheDocument()
    expect(screen.getByTestId('node-delete')).toBeInTheDocument()
    expect(screen.getByTestId('node-chip-title')).toBeInTheDocument()

    fireEvent.contextMenu(row)

    expect(await screen.findByText('Add Sibling')).toBeInTheDocument()
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(screen.getByText('Wrap in card')).toBeInTheDocument()
    expect(screen.queryByText('Add Child')).not.toBeInTheDocument()
    expect(screen.queryByText('Rename')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  it('keeps root-only boundaries for row delete and overflow structural operations', async () => {
    const { container } = renderRowWith({
      data: {
        ...props.data,
        depth: 0,
        node: { ...props.data.node, parent: undefined },
      },
      onAddChild: vi.fn(),
      onAddSibling: vi.fn(),
      onDelete: vi.fn(),
      onDuplicateNode: vi.fn(),
      onWrapNodes: vi.fn(),
    })
    const row = container.querySelector('[data-node-id="leaf1"]')!

    expect(screen.getByTestId('node-add-child')).toBeInTheDocument()
    expect(screen.queryByTestId('node-delete')).not.toBeInTheDocument()

    fireEvent.contextMenu(row)

    expect(await screen.findByText('Add Sibling')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Duplicate')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Wrap in card')).toHaveAttribute('aria-disabled', 'true')
  })

  it('routes Wrap in card through container segments', async () => {
    const onWrapNodes = vi.fn()
    const { container } = render(
      <IntlProvider
        locale="en"
        messages={{
          delete: 'Delete',
          'workflowTree.node.addChild': 'Add Child',
          'workflowTree.node.addSibling': 'Add Sibling',
          'workflowTree.node.duplicate': 'Duplicate',
          'workflowTree.node.rename': 'Rename',
          'workflowTree.node.wrapInCard': 'Wrap in card',
        }}
      >
        <TreeAnimationProvider>
          <SegmentRow
            onWrapNodes={onWrapNodes}
            rowHeight={40}
            segment={{
              type: 'container',
              parentNode: props.data.node,
              parentTreeNode: props.data,
              config: { type: 'card' },
              children: [],
              childRowIndices: [],
              depth: props.data.depth,
              parentRowIndex: 0,
            }}
          />
        </TreeAnimationProvider>
      </IntlProvider>,
    )
    const row = container.querySelector('[data-node-id="leaf1"]')!

    fireEvent.contextMenu(row)
    fireEvent.click(await screen.findByText('Wrap in card'))

    await waitFor(() => expect(onWrapNodes).toHaveBeenCalledWith('leaf1'))
  })

  it('renders inside drops as target-owned markers without duplicating row content', () => {
    renderRowWith({
      activeDropPosition: 'inside',
      activeDropTargetId: 'leaf1',
    })

    const marker = screen.getByTestId('tree-drop-marker')
    expect(marker).toHaveAttribute('data-drop-position', 'inside')
    expect(marker).toHaveTextContent('')
    expect(screen.queryAllByTestId('node-chip-command')).toHaveLength(1)
    expect(screen.queryAllByTestId('node-chip-title')).toHaveLength(1)
  })
})

function renderRowWith(overrides: Partial<TreeNodeProps>) {
  return render(
    <IntlProvider
      locale="en"
      messages={{
        delete: 'Delete',
        'workflowTree.node.addChild': 'Add Child',
        'workflowTree.node.addSibling': 'Add Sibling',
        'workflowTree.node.duplicate': 'Duplicate',
        'workflowTree.node.rename': 'Rename',
        'workflowTree.node.wrapInCard': 'Wrap in card',
      }}
    >
      <TreeAnimationProvider>
        <TreeNodeDefault {...props} {...overrides} />
      </TreeAnimationProvider>
    </IntlProvider>,
  )
}
