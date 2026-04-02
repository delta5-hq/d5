import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodePreviewSection } from '../node-preview-section'

vi.mock('@features/workflow-tree/store', () => ({
  useWorkflowNodes: () => ({}),
  useWorkflowEdges: () => ({}),
}))

const mockUseNodePreview = vi.fn()

vi.mock('@features/workflow-tree/hooks/use-node-preview', () => ({
  useNodePreview: (...args: unknown[]) => mockUseNodePreview(...args),
}))

beforeEach(() => {
  mockUseNodePreview.mockReset()
})

function renderSection(nodeId: string) {
  return render(<NodePreviewSection nodeId={nodeId} />)
}

describe('NodePreviewSection — resolved text rendering', () => {
  it('renders the resolved preview text in the preview element', () => {
    mockUseNodePreview.mockReturnValue({ previewText: 'resolved content' })
    renderSection('n1')
    expect(screen.getByTestId('node-preview-text')).toHaveTextContent('resolved content')
  })

  it('renders an empty preview element when previewText is empty', () => {
    mockUseNodePreview.mockReturnValue({ previewText: '' })
    renderSection('n1')
    expect(screen.getByTestId('node-preview-text')).toHaveTextContent('')
  })

  it('renders multiline text preserving content structure', () => {
    mockUseNodePreview.mockReturnValue({ previewText: 'line one\n  line two\n    line three' })
    renderSection('n1')
    expect(screen.getByTestId('node-preview-text').textContent).toBe('line one\n  line two\n    line three')
  })

  it('passes the nodeId to useNodePreview', () => {
    mockUseNodePreview.mockReturnValue({ previewText: '' })
    renderSection('specific-node-id')
    expect(mockUseNodePreview).toHaveBeenCalledWith(expect.objectContaining({ nodeId: 'specific-node-id' }))
  })
})
