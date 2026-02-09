import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditableTextArea } from '../editable-text-area'

describe('EditableTextArea', () => {
  describe('rendering', () => {
    it('always renders a textarea element', () => {
      render(<EditableTextArea onChange={vi.fn()} value="content" />)
      expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA')
    })

    it('shows current value', () => {
      render(<EditableTextArea onChange={vi.fn()} value="Hello World" />)
      expect(screen.getByDisplayValue('Hello World')).toBeInTheDocument()
    })

    it('shows placeholder when value is empty', () => {
      render(<EditableTextArea onChange={vi.fn()} placeholder="Enter command..." value="" />)
      expect(screen.getByPlaceholderText('Enter command...')).toBeInTheDocument()
    })

    it('forwards className to textarea', () => {
      render(<EditableTextArea className="custom-class" onChange={vi.fn()} value="" />)
      expect(screen.getByRole('textbox').className).toContain('custom-class')
    })
  })

  describe('commit and cancel', () => {
    it('commits on blur when value changed', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="old" />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'new' } })
      fireEvent.blur(textarea)

      expect(onChange).toHaveBeenCalledWith('new')
    })

    it('does not commit on blur when value unchanged', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="same" />)

      fireEvent.blur(screen.getByRole('textbox'))

      expect(onChange).not.toHaveBeenCalled()
    })

    it('does not commit on plain Enter', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="old" />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'new' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })

      expect(onChange).not.toHaveBeenCalled()
    })

    it('commits on Ctrl+Enter', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="old" />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'new' } })
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

      expect(onChange).toHaveBeenCalledWith('new')
    })

    it('commits on Meta+Enter', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="old" />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'new' } })
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })

      expect(onChange).toHaveBeenCalledWith('new')
    })

    it('cancels on Escape without calling onChange', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="original" />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'modified' } })
      fireEvent.keyDown(textarea, { key: 'Escape' })

      expect(onChange).not.toHaveBeenCalled()
      expect(screen.getByDisplayValue('original')).toBeInTheDocument()
    })
  })
})
