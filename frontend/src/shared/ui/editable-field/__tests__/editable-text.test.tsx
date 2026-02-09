import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditableText } from '../editable-text'

describe('EditableText', () => {
  describe('read-only display', () => {
    it('shows value when non-empty', () => {
      render(<EditableText onChange={vi.fn()} value="Hello" />)
      expect(screen.getByText('Hello')).toBeInTheDocument()
    })

    it('shows placeholder when value is empty', () => {
      render(<EditableText onChange={vi.fn()} placeholder="Type here" value="" />)
      expect(screen.getByText('Type here')).toBeInTheDocument()
    })

    it('applies italic styling when value is empty', () => {
      render(<EditableText onChange={vi.fn()} placeholder="Untitled" value="" />)
      const span = screen.getByText('Untitled')
      expect(span.className).toContain('italic')
    })

    it('does not apply italic styling when value is non-empty', () => {
      render(<EditableText onChange={vi.fn()} value="Hello" />)
      const span = screen.getByText('Hello')
      expect(span.className).not.toContain('italic')
    })

    it('renders as span element', () => {
      render(<EditableText onChange={vi.fn()} value="Hello" />)
      const el = screen.getByText('Hello')
      expect(el.tagName).toBe('SPAN')
    })

    it('applies touch-action manipulation for mobile compatibility', () => {
      render(<EditableText onChange={vi.fn()} value="Hello" />)
      const span = screen.getByText('Hello')
      expect(span.style.touchAction).toBe('manipulation')
    })

    it('forwards className to span', () => {
      render(<EditableText className="custom-class" onChange={vi.fn()} value="Hello" />)
      const span = screen.getByText('Hello')
      expect(span.className).toContain('custom-class')
    })

    it('forwards readOnlyClassName to span', () => {
      render(<EditableText onChange={vi.fn()} readOnlyClassName="read-only-class" value="Hello" />)
      const span = screen.getByText('Hello')
      expect(span.className).toContain('read-only-class')
    })
  })

  describe('title tooltip', () => {
    it('shows title attribute on read-only span', () => {
      render(<EditableText onChange={vi.fn()} title="Double-click to edit" value="Hello" />)
      const span = screen.getByText('Hello')
      expect(span).toHaveAttribute('title', 'Double-click to edit')
    })

    it('omits title attribute when not provided', () => {
      render(<EditableText onChange={vi.fn()} value="Hello" />)
      const span = screen.getByText('Hello')
      expect(span).not.toHaveAttribute('title')
    })

    it('hides title when entering edit mode', () => {
      render(<EditableText onChange={vi.fn()} title="Double-click to edit" value="Hello" />)

      const span = screen.getByText('Hello')
      fireEvent.dblClick(span)

      const input = screen.getByDisplayValue('Hello')
      expect(input.tagName).toBe('INPUT')
      expect(input).not.toHaveAttribute('title')
    })
  })

  describe('editing transition', () => {
    it('switches to input on double-click', () => {
      render(<EditableText onChange={vi.fn()} value="Hello" />)

      fireEvent.dblClick(screen.getByText('Hello'))

      expect(screen.getByDisplayValue('Hello')).toBeInTheDocument()
    })

    it('passes placeholder to input while editing', () => {
      render(<EditableText onChange={vi.fn()} placeholder="Type here" value="" />)

      fireEvent.dblClick(screen.getByText('Type here'))

      const input = screen.getByPlaceholderText('Type here')
      expect(input).toBeInTheDocument()
    })

    it('starts in edit mode with autoFocus', () => {
      render(<EditableText autoFocus onChange={vi.fn()} value="Auto" />)

      expect(screen.getByDisplayValue('Auto')).toBeInTheDocument()
    })

    it('forwards className to input while editing', () => {
      render(<EditableText autoFocus className="custom-class" onChange={vi.fn()} value="Hello" />)
      const input = screen.getByDisplayValue('Hello')
      expect(input.className).toContain('custom-class')
    })
  })

  describe('edit commit and cancel', () => {
    it('commits on blur', () => {
      const onChange = vi.fn()
      render(<EditableText onChange={onChange} value="Hello" />)

      fireEvent.dblClick(screen.getByText('Hello'))
      const input = screen.getByDisplayValue('Hello')
      fireEvent.change(input, { target: { value: 'World' } })
      fireEvent.blur(input)

      expect(onChange).toHaveBeenCalledWith('World')
    })

    it('commits on Enter key', () => {
      const onChange = vi.fn()
      render(<EditableText onChange={onChange} value="Hello" />)

      fireEvent.dblClick(screen.getByText('Hello'))
      const input = screen.getByDisplayValue('Hello')
      fireEvent.change(input, { target: { value: 'World' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(onChange).toHaveBeenCalledWith('World')
    })

    it('cancels on Escape without calling onChange', () => {
      const onChange = vi.fn()
      render(<EditableText onChange={onChange} value="Hello" />)

      fireEvent.dblClick(screen.getByText('Hello'))
      const input = screen.getByDisplayValue('Hello')
      fireEvent.change(input, { target: { value: 'World' } })
      fireEvent.keyDown(input, { key: 'Escape' })

      expect(onChange).not.toHaveBeenCalled()
      expect(screen.getByText('Hello')).toBeInTheDocument()
    })

    it('does not call onChange when committed value is unchanged', () => {
      const onChange = vi.fn()
      render(<EditableText onChange={onChange} value="Hello" />)

      fireEvent.dblClick(screen.getByText('Hello'))
      const input = screen.getByDisplayValue('Hello')
      fireEvent.blur(input)

      expect(onChange).not.toHaveBeenCalled()
    })

    it('returns to span after commit', () => {
      const onChange = vi.fn()
      render(<EditableText onChange={onChange} value="Hello" />)

      fireEvent.dblClick(screen.getByText('Hello'))
      fireEvent.keyDown(screen.getByDisplayValue('Hello'), { key: 'Enter' })

      expect(screen.getByText('Hello').tagName).toBe('SPAN')
    })
  })
})
