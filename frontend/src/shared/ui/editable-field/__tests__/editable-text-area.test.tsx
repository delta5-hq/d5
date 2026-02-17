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

  describe('commit behavior', () => {
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

    it('commits on plain Enter', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="old" />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'new' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })

      expect(onChange).toHaveBeenCalledWith('new')
    })

    it('does not commit on Shift+Enter (allows newline insertion)', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="old" />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'new' } })
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

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

    it('commits on Meta+Enter (macOS)', () => {
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

  describe('onCommitAndCreateSibling — fires only on Ctrl/Meta+Enter', () => {
    it('fires on Ctrl+Enter and commits value', () => {
      const onChange = vi.fn()
      const onCommitAndCreateSibling = vi.fn()
      render(<EditableTextArea onChange={onChange} onCommitAndCreateSibling={onCommitAndCreateSibling} value="old" />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'new' } })
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

      expect(onChange).toHaveBeenCalledWith('new')
      expect(onCommitAndCreateSibling).toHaveBeenCalledTimes(1)
    })

    it('fires on Meta+Enter and commits value (macOS)', () => {
      const onChange = vi.fn()
      const onCommitAndCreateSibling = vi.fn()
      render(<EditableTextArea onChange={onChange} onCommitAndCreateSibling={onCommitAndCreateSibling} value="old" />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'new' } })
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })

      expect(onChange).toHaveBeenCalledWith('new')
      expect(onCommitAndCreateSibling).toHaveBeenCalledTimes(1)
    })

    it('does not fire on plain Enter (plain Enter only commits)', () => {
      const onChange = vi.fn()
      const onCommitAndCreateSibling = vi.fn()
      render(<EditableTextArea onChange={onChange} onCommitAndCreateSibling={onCommitAndCreateSibling} value="old" />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'new' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })

      expect(onChange).toHaveBeenCalledWith('new')
      expect(onCommitAndCreateSibling).not.toHaveBeenCalled()
    })

    it('does not fire on Shift+Enter (Shift+Enter is newline — no commit, no sibling)', () => {
      const onChange = vi.fn()
      const onCommitAndCreateSibling = vi.fn()
      render(<EditableTextArea onChange={onChange} onCommitAndCreateSibling={onCommitAndCreateSibling} value="old" />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'new' } })
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

      expect(onChange).not.toHaveBeenCalled()
      expect(onCommitAndCreateSibling).not.toHaveBeenCalled()
    })

    it('commits without throwing when onCommitAndCreateSibling is absent', () => {
      const onChange = vi.fn()
      render(<EditableTextArea onChange={onChange} value="old" />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'new' } })
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

      expect(onChange).toHaveBeenCalledWith('new')
    })
  })
})
