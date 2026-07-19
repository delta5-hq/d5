import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditableTextArea } from '../editable-text-area'

describe('EditableTextArea', () => {
  describe('read-only display', () => {
    it('shows value when non-empty', () => {
      render(<EditableTextArea onChange={vi.fn()} value="Hello" />)
      expect(screen.getByText('Hello')).toBeInTheDocument()
    })

    it('shows placeholder when value is empty', () => {
      render(<EditableTextArea onChange={vi.fn()} placeholder="Type here" value="" />)
      expect(screen.getByText('Type here')).toBeInTheDocument()
    })

    it('applies italic styling when value is empty', () => {
      render(<EditableTextArea onChange={vi.fn()} placeholder="Untitled" value="" />)
      expect(screen.getByText('Untitled').className).toContain('italic')
    })

    it('does not apply italic styling when value is non-empty', () => {
      render(<EditableTextArea onChange={vi.fn()} value="Hello" />)
      expect(screen.getByText('Hello').className).not.toContain('italic')
    })

    it('preserves whitespace and newlines in read-only span', () => {
      render(<EditableTextArea onChange={vi.fn()} value="Line one\n\nLine two" />)
      const span = screen.getByText(/Line one/)
      expect(span.className).toContain('whitespace-pre-wrap')
    })

    it('shows title attribute on read-only span', () => {
      render(<EditableTextArea onChange={vi.fn()} title="Double-click to edit" value="Hello" />)
      expect(screen.getByText('Hello')).toHaveAttribute('title', 'Double-click to edit')
    })

    it('forwards className to read-only span', () => {
      render(<EditableTextArea className="custom-class" onChange={vi.fn()} value="Hello" />)
      expect(screen.getByText('Hello').className).toContain('custom-class')
    })

    it('forwards readOnlyClassName to read-only span', () => {
      render(<EditableTextArea onChange={vi.fn()} readOnlyClassName="read-only-class" value="Hello" />)
      expect(screen.getByText('Hello').className).toContain('read-only-class')
    })

    it('applies touch-action manipulation for mobile compatibility', () => {
      render(<EditableTextArea onChange={vi.fn()} value="Hello" />)
      expect((screen.getByText('Hello') as HTMLElement).style.touchAction).toBe('manipulation')
    })
  })

  describe('editing transition', () => {
    it('switches to textarea on double-click', () => {
      render(<EditableTextArea onChange={vi.fn()} value="Hello" />)
      fireEvent.dblClick(screen.getByText('Hello'))
      expect(screen.getByDisplayValue('Hello').tagName).toBe('TEXTAREA')
    })

    it('starts in edit mode with autoFocus', () => {
      render(<EditableTextArea autoFocus onChange={vi.fn()} value="Prefilled" />)
      expect(screen.getByDisplayValue('Prefilled').tagName).toBe('TEXTAREA')
    })

    it('passes placeholder to textarea while editing', () => {
      render(<EditableTextArea onChange={vi.fn()} placeholder="Type here" value="" />)
      fireEvent.dblClick(screen.getByText('Type here'))
      expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument()
    })

    it('forwards className to textarea while editing', () => {
      render(<EditableTextArea autoFocus className="custom-class" onChange={vi.fn()} value="Hello" />)
      expect(screen.getByDisplayValue('Hello').className).toContain('custom-class')
    })

    it('enters edit mode when autoFocus prop changes from false to true', () => {
      const { rerender } = render(<EditableTextArea autoFocus={false} onChange={vi.fn()} value="Hello" />)
      expect(screen.queryByDisplayValue('Hello')).not.toBeInTheDocument()

      rerender(<EditableTextArea autoFocus onChange={vi.fn()} value="Hello" />)

      expect(screen.getByDisplayValue('Hello').tagName).toBe('TEXTAREA')
    })

    it('stays in edit mode when autoFocus changes from true to false', () => {
      const { rerender } = render(<EditableTextArea autoFocus onChange={vi.fn()} value="Hello" />)
      expect(screen.getByDisplayValue('Hello').tagName).toBe('TEXTAREA')

      rerender(<EditableTextArea autoFocus={false} onChange={vi.fn()} value="Hello" />)

      expect(screen.getByDisplayValue('Hello').tagName).toBe('TEXTAREA')
    })

    it('does not re-enter edit mode when autoFocus stays true after edit is cancelled', () => {
      const { rerender } = render(<EditableTextArea autoFocus onChange={vi.fn()} value="Hello" />)
      fireEvent.keyDown(screen.getByDisplayValue('Hello'), { key: 'Escape' })
      expect(screen.getByText('Hello').tagName).toBe('SPAN')

      rerender(<EditableTextArea autoFocus onChange={vi.fn()} value="Hello" />)

      expect(screen.getByText('Hello').tagName).toBe('SPAN')
    })
  })

  describe('edit commit', () => {
    it('commits and calls onChange on blur', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="Hello" />)
      fireEvent.dblClick(screen.getByText('Hello'))
      const textarea = screen.getByDisplayValue('Hello')
      fireEvent.change(textarea, { target: { value: 'World' } })
      fireEvent.blur(textarea)
      expect(onChange).toHaveBeenCalledWith('World')
    })

    it('commits and calls onChange on Enter key', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="Hello" />)
      fireEvent.dblClick(screen.getByText('Hello'))
      const textarea = screen.getByDisplayValue('Hello')
      fireEvent.change(textarea, { target: { value: 'World' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })
      expect(onChange).toHaveBeenCalledWith('World')
    })

    it('does not call onChange when committed value is unchanged', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="Hello" />)
      fireEvent.dblClick(screen.getByText('Hello'))
      fireEvent.blur(screen.getByDisplayValue('Hello'))
      expect(onChange).not.toHaveBeenCalled()
    })

    it('returns to span after commit', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="Hello" />)
      fireEvent.dblClick(screen.getByText('Hello'))
      fireEvent.keyDown(screen.getByDisplayValue('Hello'), { key: 'Enter' })
      expect(screen.getByText('Hello').tagName).toBe('SPAN')
    })
  })

  describe('Shift+Enter newline behavior', () => {
    it('does not commit on Shift+Enter — allows newlines within the textarea', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="Hello" />)
      fireEvent.dblClick(screen.getByText('Hello'))
      const textarea = screen.getByDisplayValue('Hello')
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
      expect(onChange).not.toHaveBeenCalled()
      expect(textarea).toBeInTheDocument()
    })
  })

  describe('edit cancel', () => {
    it('cancels on Escape without calling onChange', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="Hello" />)
      fireEvent.dblClick(screen.getByText('Hello'))
      const textarea = screen.getByDisplayValue('Hello')
      fireEvent.change(textarea, { target: { value: 'Discarded' } })
      fireEvent.keyDown(textarea, { key: 'Escape' })
      expect(onChange).not.toHaveBeenCalled()
      expect(screen.getByText('Hello')).toBeInTheDocument()
    })
  })
})
