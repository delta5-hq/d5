import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { NodeData } from '@/shared/base-types/workflow'
import { NodeDropGhost } from './node-drop-ghost'

vi.mock('@shared/ui/genie', () => ({
  Genie: ({ color, size, variant, state }: { color?: string; size?: number; variant?: string; state?: string }) => (
    <div data-color={color} data-size={size} data-state={state} data-testid="genie" data-variant={variant} />
  ),
}))

const makeNode = (overrides: Partial<NodeData> = {}): NodeData => ({
  id: 'n1',
  title: 'Ghost title',
  children: [],
  command: '/chat hello',
  ...overrides,
})

describe('NodeDropGhost', () => {
  it('renders the ghost container at the drop location', () => {
    render(<NodeDropGhost aliases={[]} node={makeNode()} />)

    expect(screen.getByTestId('drag-ghost-node')).toBeInTheDocument()
  })

  it('is presentational and hidden from assistive technology', () => {
    render(<NodeDropGhost aliases={[]} node={makeNode()} />)

    expect(screen.getByTestId('drag-ghost-node')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the command chip for an assigned command node', () => {
    render(<NodeDropGhost aliases={[]} node={makeNode({ command: '/chat hi' })} />)

    expect(screen.getByTestId('node-chip-command')).toHaveTextContent('/chat')
  })

  it('shows the commandless chip for a node without a command', () => {
    render(<NodeDropGhost aliases={[]} node={makeNode({ command: undefined })} />)

    expect(screen.getByTestId('node-chip-commandless')).toHaveTextContent('Not assigned')
  })

  it('shows the normalized node title', () => {
    render(<NodeDropGhost aliases={[]} node={makeNode({ title: 'Draft outline' })} />)

    expect(screen.getByText('Draft outline')).toBeInTheDocument()
  })

  it('leaves the title span empty for a titleless node', () => {
    const { container } = render(<NodeDropGhost aliases={[]} node={makeNode({ title: '' })} />)

    expect(container.querySelector('.workflow-tree-ghost-title')?.textContent).toBe('')
  })

  it('renders an idle clipboard-eyes genie for command nodes', () => {
    render(<NodeDropGhost aliases={[]} node={makeNode({ command: '/chat hi' })} />)

    const genie = screen.getByTestId('genie')
    expect(genie).toHaveAttribute('data-variant', 'clipboard-eyes')
    expect(genie).toHaveAttribute('data-state', 'idle')
    expect(genie).toHaveAttribute('data-size', '28')
  })

  it('renders an idle clipboard genie for commandless nodes', () => {
    render(<NodeDropGhost aliases={[]} node={makeNode({ command: undefined })} />)

    expect(screen.getByTestId('genie')).toHaveAttribute('data-variant', 'clipboard')
  })

  it('colors the genie by role for command nodes and muted for commandless nodes', () => {
    const { rerender } = render(<NodeDropGhost aliases={[]} node={makeNode({ command: '/chat hi' })} />)
    expect(screen.getByTestId('genie')).toHaveAttribute('data-color', '#ffa726')

    rerender(<NodeDropGhost aliases={[]} node={makeNode({ command: undefined })} />)
    expect(screen.getByTestId('genie')).toHaveAttribute('data-color', 'var(--muted-foreground)')
  })
})
