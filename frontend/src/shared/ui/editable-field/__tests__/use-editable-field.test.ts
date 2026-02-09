import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditableField } from '../use-editable-field'
import type { KeyboardEvent } from 'react'

describe('useEditableField', () => {
  describe('State Management', () => {
    it('initializes with editing disabled and synced value', () => {
      const { result } = renderHook(() =>
        useEditableField({
          value: 'initial',
          onChange: vi.fn(),
        }),
      )

      expect(result.current.isEditing).toBe(false)
      expect(result.current.editValue).toBe('initial')
    })

    it('syncs editValue when external value changes while not editing', () => {
      const { result, rerender } = renderHook(({ value }) => useEditableField({ value, onChange: vi.fn() }), {
        initialProps: { value: 'v1' },
      })

      expect(result.current.editValue).toBe('v1')

      rerender({ value: 'v2' })
      expect(result.current.editValue).toBe('v2')
    })

    it('preserves editValue when external value changes during edit', () => {
      const { result, rerender } = renderHook(({ value }) => useEditableField({ value, onChange: vi.fn() }), {
        initialProps: { value: 'v1' },
      })

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('modified')
      })

      rerender({ value: 'v2' })
      expect(result.current.editValue).toBe('modified')
      expect(result.current.isEditing).toBe(true)
    })

    it('reverts editValue to external value after canceling edit', () => {
      const { result, rerender } = renderHook(({ value }) => useEditableField({ value, onChange: vi.fn() }), {
        initialProps: { value: 'v1' },
      })

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('modified')
        result.current.cancelEdit()
      })

      expect(result.current.editValue).toBe('v1')
      expect(result.current.isEditing).toBe(false)

      rerender({ value: 'v2' })
      expect(result.current.editValue).toBe('v2')
    })
  })

  describe('Edit Lifecycle', () => {
    it('starts editing when startEditing called', () => {
      const { result } = renderHook(() => useEditableField({ value: 'test', onChange: vi.fn() }))

      expect(result.current.isEditing).toBe(false)

      act(() => {
        result.current.startEditing()
      })

      expect(result.current.isEditing).toBe(true)
    })

    it('auto-starts editing when autoFocus is true', () => {
      const { result } = renderHook(() => useEditableField({ value: 'test', onChange: vi.fn(), autoFocus: true }))

      expect(result.current.isEditing).toBe(true)
    })

    it('does not auto-start when autoFocus changes to true after mount', () => {
      const { result, rerender } = renderHook(
        ({ autoFocus }) => useEditableField({ value: 'test', onChange: vi.fn(), autoFocus }),
        { initialProps: { autoFocus: false } },
      )

      expect(result.current.isEditing).toBe(false)

      rerender({ autoFocus: true })
      expect(result.current.isEditing).toBe(true)
    })

    it('commits edit and calls onChange when value changed', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useEditableField({ value: 'old', onChange }))

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('new')
        result.current.commitEdit()
      })

      expect(onChange).toHaveBeenCalledWith('new')
      expect(result.current.isEditing).toBe(false)
      expect(result.current.editValue).toBe('new')
    })

    it('commits edit without calling onChange when value unchanged', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useEditableField({ value: 'same', onChange }))

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('same')
        result.current.commitEdit()
      })

      expect(onChange).not.toHaveBeenCalled()
      expect(result.current.isEditing).toBe(false)
    })

    it('cancels edit without calling onChange', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useEditableField({ value: 'original', onChange }))

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('modified')
        result.current.cancelEdit()
      })

      expect(onChange).not.toHaveBeenCalled()
      expect(result.current.isEditing).toBe(false)
      expect(result.current.editValue).toBe('original')
    })
  })

  describe('Keyboard Handling', () => {
    describe('commitOnEnter: true', () => {
      it('commits on Enter key', () => {
        const onChange = vi.fn()
        const { result } = renderHook(() => useEditableField({ value: 'old', onChange, commitOnEnter: true }))

        act(() => {
          result.current.startEditing()
          result.current.setEditValue('new')
          result.current.handleKeyDown({
            key: 'Enter',
            preventDefault: vi.fn(),
          } as unknown as KeyboardEvent)
        })

        expect(onChange).toHaveBeenCalledWith('new')
        expect(result.current.isEditing).toBe(false)
      })

      it('does not commit on Enter+Shift (multiline behavior)', () => {
        const onChange = vi.fn()
        const { result } = renderHook(() => useEditableField({ value: 'old', onChange, commitOnEnter: true }))

        act(() => {
          result.current.startEditing()
          result.current.setEditValue('new')
          result.current.handleKeyDown({
            key: 'Enter',
            shiftKey: true,
            preventDefault: vi.fn(),
          } as unknown as KeyboardEvent)
        })

        expect(onChange).not.toHaveBeenCalled()
        expect(result.current.isEditing).toBe(true)
      })

      it('also commits on Ctrl+Enter when commitOnEnter is true', () => {
        const onChange = vi.fn()
        const { result } = renderHook(() => useEditableField({ value: 'old', onChange, commitOnEnter: true }))

        act(() => {
          result.current.startEditing()
          result.current.setEditValue('new')
          result.current.handleKeyDown({
            key: 'Enter',
            ctrlKey: true,
            preventDefault: vi.fn(),
          } as unknown as KeyboardEvent)
        })

        expect(onChange).toHaveBeenCalledWith('new')
        expect(result.current.isEditing).toBe(false)
      })

      it('cancels on Escape key', () => {
        const onChange = vi.fn()
        const { result } = renderHook(() => useEditableField({ value: 'original', onChange, commitOnEnter: true }))

        act(() => {
          result.current.startEditing()
          result.current.setEditValue('modified')
          result.current.handleKeyDown({
            key: 'Escape',
            preventDefault: vi.fn(),
          } as unknown as KeyboardEvent)
        })

        expect(onChange).not.toHaveBeenCalled()
        expect(result.current.isEditing).toBe(false)
        expect(result.current.editValue).toBe('original')
      })
    })

    describe('commitOnEnter: false', () => {
      it('commits on Ctrl+Enter', () => {
        const onChange = vi.fn()
        const { result } = renderHook(() => useEditableField({ value: 'old', onChange, commitOnEnter: false }))

        act(() => {
          result.current.startEditing()
          result.current.setEditValue('new')
          result.current.handleKeyDown({
            key: 'Enter',
            ctrlKey: true,
            preventDefault: vi.fn(),
          } as unknown as KeyboardEvent)
        })

        expect(onChange).toHaveBeenCalledWith('new')
        expect(result.current.isEditing).toBe(false)
      })

      it('commits on Meta+Enter (macOS)', () => {
        const onChange = vi.fn()
        const { result } = renderHook(() => useEditableField({ value: 'old', onChange, commitOnEnter: false }))

        act(() => {
          result.current.startEditing()
          result.current.setEditValue('new')
          result.current.handleKeyDown({
            key: 'Enter',
            metaKey: true,
            preventDefault: vi.fn(),
          } as unknown as KeyboardEvent)
        })

        expect(onChange).toHaveBeenCalledWith('new')
        expect(result.current.isEditing).toBe(false)
      })

      it('does not commit on plain Enter', () => {
        const onChange = vi.fn()
        const { result } = renderHook(() => useEditableField({ value: 'old', onChange, commitOnEnter: false }))

        act(() => {
          result.current.startEditing()
          result.current.setEditValue('new')
          result.current.handleKeyDown({
            key: 'Enter',
            preventDefault: vi.fn(),
          } as unknown as KeyboardEvent)
        })

        expect(onChange).not.toHaveBeenCalled()
        expect(result.current.isEditing).toBe(true)
      })

      it('does not commit on Shift+Enter', () => {
        const onChange = vi.fn()
        const { result } = renderHook(() => useEditableField({ value: 'old', onChange, commitOnEnter: false }))

        act(() => {
          result.current.startEditing()
          result.current.setEditValue('new')
          result.current.handleKeyDown({
            key: 'Enter',
            shiftKey: true,
            preventDefault: vi.fn(),
          } as unknown as KeyboardEvent)
        })

        expect(onChange).not.toHaveBeenCalled()
        expect(result.current.isEditing).toBe(true)
      })

      it('cancels on Escape key', () => {
        const onChange = vi.fn()
        const { result } = renderHook(() => useEditableField({ value: 'original', onChange, commitOnEnter: false }))

        act(() => {
          result.current.startEditing()
          result.current.setEditValue('modified')
          result.current.handleKeyDown({
            key: 'Escape',
            preventDefault: vi.fn(),
          } as unknown as KeyboardEvent)
        })

        expect(onChange).not.toHaveBeenCalled()
        expect(result.current.isEditing).toBe(false)
        expect(result.current.editValue).toBe('original')
      })
    })

    it('prevents default behavior for handled keys', () => {
      const { result } = renderHook(() => useEditableField({ value: 'test', onChange: vi.fn(), commitOnEnter: true }))

      const preventDefault = vi.fn()

      act(() => {
        result.current.startEditing()
      })

      act(() => {
        result.current.handleKeyDown({ key: 'Enter', preventDefault } as unknown as KeyboardEvent)
      })
      expect(preventDefault).toHaveBeenCalled()

      preventDefault.mockClear()
      act(() => {
        result.current.handleKeyDown({ key: 'Escape', preventDefault } as unknown as KeyboardEvent)
      })
      expect(preventDefault).toHaveBeenCalled()
    })

    it('does not prevent default for unrecognized keys', () => {
      const { result } = renderHook(() => useEditableField({ value: 'test', onChange: vi.fn(), commitOnEnter: true }))

      const preventDefault = vi.fn()

      act(() => {
        result.current.startEditing()
      })

      for (const key of ['Tab', 'a', 'Backspace', 'ArrowDown']) {
        preventDefault.mockClear()
        act(() => {
          result.current.handleKeyDown({ key, preventDefault } as unknown as KeyboardEvent)
        })
        expect(preventDefault).not.toHaveBeenCalled()
      }
    })
  })

  describe('Unmount Behavior', () => {
    it('commits pending changes on unmount', () => {
      const onChange = vi.fn()
      const { result, unmount } = renderHook(() => useEditableField({ value: 'old', onChange }))

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('new')
      })

      unmount()

      expect(onChange).toHaveBeenCalledWith('new')
    })

    it('does not commit when value unchanged on unmount', () => {
      const onChange = vi.fn()
      const { result, unmount } = renderHook(() => useEditableField({ value: 'same', onChange }))

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('same')
      })

      unmount()

      expect(onChange).not.toHaveBeenCalled()
    })

    it('does not commit when not editing on unmount', () => {
      const onChange = vi.fn()
      const { unmount } = renderHook(() => useEditableField({ value: 'test', onChange }))

      unmount()

      expect(onChange).not.toHaveBeenCalled()
    })

    it('uses latest onChange callback on unmount', () => {
      const onChange1 = vi.fn()
      const onChange2 = vi.fn()

      const { result, rerender, unmount } = renderHook(({ onChange }) => useEditableField({ value: 'old', onChange }), {
        initialProps: { onChange: onChange1 },
      })

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('new')
      })

      rerender({ onChange: onChange2 })

      unmount()

      expect(onChange1).not.toHaveBeenCalled()
      expect(onChange2).toHaveBeenCalledWith('new')
    })

    it('uses latest value reference on unmount', () => {
      const onChange = vi.fn()

      const { result, rerender, unmount } = renderHook(({ value }) => useEditableField({ value, onChange }), {
        initialProps: { value: 'v1' },
      })

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('modified')
      })

      rerender({ value: 'v2' })

      unmount()

      expect(onChange).toHaveBeenCalledWith('modified')
    })
  })

  describe('Ref Stability', () => {
    it('returns stable inputRef across renders', () => {
      const { result, rerender } = renderHook(() => useEditableField({ value: 'test', onChange: vi.fn() }))

      const ref1 = result.current.inputRef

      rerender()

      const ref2 = result.current.inputRef

      expect(ref1).toBe(ref2)
    })

    it('returns stable function references across renders when deps unchanged', () => {
      const onChange = vi.fn()
      const { result, rerender } = renderHook(() => useEditableField({ value: 'test', onChange }))

      const {
        startEditing: start1,
        setEditValue: set1,
        commitEdit: commit1,
        cancelEdit: cancel1,
        handleKeyDown: key1,
      } = result.current

      rerender()

      const {
        startEditing: start2,
        setEditValue: set2,
        commitEdit: commit2,
        cancelEdit: cancel2,
        handleKeyDown: key2,
      } = result.current

      expect(start1).toBe(start2)
      expect(set1).toBe(set2)
      expect(commit1).toBe(commit2)
      expect(cancel1).toBe(cancel2)
      expect(key1).toBe(key2)
    })

    it('keeps stable commitEdit even when value or onChange changes', () => {
      const onChange1 = vi.fn()
      const { result, rerender } = renderHook(({ value, onChange }) => useEditableField({ value, onChange }), {
        initialProps: { value: 'v1', onChange: onChange1 },
      })

      const commit1 = result.current.commitEdit

      rerender({ value: 'v2', onChange: onChange1 })
      const commit2 = result.current.commitEdit

      expect(commit1).toBe(commit2)
    })

    it('keeps stable cancelEdit even when value changes', () => {
      const { result, rerender } = renderHook(({ value }) => useEditableField({ value, onChange: vi.fn() }), {
        initialProps: { value: 'v1' },
      })

      const cancel1 = result.current.cancelEdit

      rerender({ value: 'v2' })
      const cancel2 = result.current.cancelEdit

      expect(cancel1).toBe(cancel2)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty string value', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useEditableField({ value: '', onChange }))

      expect(result.current.editValue).toBe('')

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('content')
        result.current.commitEdit()
      })

      expect(onChange).toHaveBeenCalledWith('content')
    })

    it('handles committing to empty string', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useEditableField({ value: 'content', onChange }))

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('')
        result.current.commitEdit()
      })

      expect(onChange).toHaveBeenCalledWith('')
    })

    it('handles multiline content', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useEditableField({ value: 'line1\nline2', onChange }))

      expect(result.current.editValue).toBe('line1\nline2')

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('line1\nline2\nline3')
        result.current.commitEdit()
      })

      expect(onChange).toHaveBeenCalledWith('line1\nline2\nline3')
    })

    it('handles special characters', () => {
      const onChange = vi.fn()
      const specialChars = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./'
      const { result } = renderHook(() => useEditableField({ value: specialChars, onChange }))

      expect(result.current.editValue).toBe(specialChars)

      act(() => {
        result.current.startEditing()
        result.current.setEditValue(`${specialChars}!`)
        result.current.commitEdit()
      })

      expect(onChange).toHaveBeenCalledWith(`${specialChars}!`)
    })

    it('handles Unicode characters', () => {
      const onChange = vi.fn()
      const unicode = '你好世界 🌍 Привет'
      const { result } = renderHook(() => useEditableField({ value: unicode, onChange }))

      expect(result.current.editValue).toBe(unicode)

      act(() => {
        result.current.startEditing()
        result.current.setEditValue(`${unicode} 🎉`)
        result.current.commitEdit()
      })

      expect(onChange).toHaveBeenCalledWith(`${unicode} 🎉`)
    })

    it('handles rapid value changes', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useEditableField({ value: 'initial', onChange }))

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('a')
        result.current.setEditValue('ab')
        result.current.setEditValue('abc')
        result.current.setEditValue('abcd')
      })

      expect(result.current.editValue).toBe('abcd')

      act(() => {
        result.current.commitEdit()
      })

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith('abcd')
    })

    it('handles multiple start/cancel cycles', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useEditableField({ value: 'original', onChange }))

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('edit1')
        result.current.cancelEdit()
      })

      expect(result.current.editValue).toBe('original')

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('edit2')
        result.current.cancelEdit()
      })

      expect(result.current.editValue).toBe('original')
      expect(onChange).not.toHaveBeenCalled()
    })

    it('handles commit followed immediately by new edit', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useEditableField({ value: 'v1', onChange }))

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('v2')
        result.current.commitEdit()
      })

      expect(onChange).toHaveBeenCalledWith('v2')
      onChange.mockClear()

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('v3')
        result.current.commitEdit()
      })

      expect(onChange).toHaveBeenCalledWith('v3')
    })
  })

  describe('onChange Callback Timing', () => {
    it('calls onChange with current editValue not stale closure', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useEditableField({ value: 'old', onChange }))

      act(() => {
        result.current.startEditing()
      })

      const setValueRef = result.current.setEditValue
      const commitRef = result.current.commitEdit

      act(() => {
        setValueRef('new')
      })

      act(() => {
        commitRef()
      })

      expect(onChange).toHaveBeenCalledWith('new')
    })

    it('does not call onChange on setEditValue', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() => useEditableField({ value: 'old', onChange }))

      act(() => {
        result.current.startEditing()
        result.current.setEditValue('intermediate')
        result.current.setEditValue('intermediate2')
        result.current.setEditValue('final')
      })

      expect(onChange).not.toHaveBeenCalled()

      act(() => {
        result.current.commitEdit()
      })

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith('final')
    })
  })
})
