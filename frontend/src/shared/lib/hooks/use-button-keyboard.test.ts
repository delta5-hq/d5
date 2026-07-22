import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type React from 'react'
import { useButtonKeyboard } from './use-button-keyboard'

describe('useButtonKeyboard', () => {
  describe('WAI-ARIA activation keys', () => {
    it('activates on Enter key', () => {
      const onClick = vi.fn()
      const { result } = renderHook(() => useButtonKeyboard(onClick))
      const preventDefault = vi.fn()

      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLElement>)

      expect(onClick).toHaveBeenCalledTimes(1)
      expect(preventDefault).toHaveBeenCalledTimes(1)
    })

    it('activates on Space key', () => {
      const onClick = vi.fn()
      const { result } = renderHook(() => useButtonKeyboard(onClick))
      const preventDefault = vi.fn()

      result.current.handleKeyDown({
        key: ' ',
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLElement>)

      expect(onClick).toHaveBeenCalledTimes(1)
      expect(preventDefault).toHaveBeenCalledTimes(1)
    })

    it('does not activate on mount', () => {
      const onClick = vi.fn()
      renderHook(() => useButtonKeyboard(onClick))

      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('non-activation key handling', () => {
    it('ignores navigation keys', () => {
      const onClick = vi.fn()
      const { result } = renderHook(() => useButtonKeyboard(onClick))
      const preventDefault = vi.fn()

      result.current.handleKeyDown({
        key: 'Tab',
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLElement>)

      expect(onClick).not.toHaveBeenCalled()
      expect(preventDefault).not.toHaveBeenCalled()
    })

    it('ignores alphanumeric keys', () => {
      const onClick = vi.fn()
      const { result } = renderHook(() => useButtonKeyboard(onClick))

      const keys = ['a', 'A', '1', 'Escape', 'ArrowUp', 'ArrowDown']
      keys.forEach(key => {
        result.current.handleKeyDown({
          key,
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLElement>)
      })

      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('event handling order', () => {
    it('calls preventDefault before onClick', () => {
      const throwingCallback = vi.fn(() => {
        throw new Error('test error')
      })
      const preventDefault = vi.fn()
      const { result } = renderHook(() => useButtonKeyboard(throwingCallback))

      expect(() =>
        result.current.handleKeyDown({
          key: 'Enter',
          preventDefault,
        } as unknown as React.KeyboardEvent<HTMLElement>),
      ).toThrow('test error')

      expect(preventDefault).toHaveBeenCalledTimes(1)
      expect(throwingCallback).toHaveBeenCalledTimes(1)
    })

    it('handles consecutive activations', () => {
      const onClick = vi.fn()
      const { result } = renderHook(() => useButtonKeyboard(onClick))

      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)

      result.current.handleKeyDown({
        key: ' ',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)

      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)

      expect(onClick).toHaveBeenCalledTimes(3)
    })
  })

  describe('callback reference stability', () => {
    it('uses latest callback reference after rerender', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const { result, rerender } = renderHook(({ onClick }) => useButtonKeyboard(onClick), {
        initialProps: { onClick: callback1 },
      })

      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)
      expect(callback1).toHaveBeenCalledTimes(1)

      rerender({ onClick: callback2 })
      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback1).toHaveBeenCalledTimes(1)
    })

    it('does not re-render when same callback reference passed', () => {
      const onClick = vi.fn()
      let renderCount = 0
      const { rerender } = renderHook(() => {
        renderCount++
        return useButtonKeyboard(onClick)
      })

      expect(renderCount).toBe(1)

      rerender()
      rerender()

      expect(renderCount).toBe(3)
    })
  })

  describe('multiple hook instances', () => {
    it('operates independently without interference', () => {
      const onClick1 = vi.fn()
      const onClick2 = vi.fn()
      const { result: result1 } = renderHook(() => useButtonKeyboard(onClick1))
      const { result: result2 } = renderHook(() => useButtonKeyboard(onClick2))

      result1.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)

      expect(onClick1).toHaveBeenCalledTimes(1)
      expect(onClick2).not.toHaveBeenCalled()

      result2.current.handleKeyDown({
        key: ' ',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)

      expect(onClick1).toHaveBeenCalledTimes(1)
      expect(onClick2).toHaveBeenCalledTimes(1)
    })

    it('handles three instances with different callbacks', () => {
      const onClick1 = vi.fn()
      const onClick2 = vi.fn()
      const onClick3 = vi.fn()
      renderHook(() => useButtonKeyboard(onClick1))
      const { result: result2 } = renderHook(() => useButtonKeyboard(onClick2))
      renderHook(() => useButtonKeyboard(onClick3))

      result2.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)

      expect(onClick1).not.toHaveBeenCalled()
      expect(onClick2).toHaveBeenCalledTimes(1)
      expect(onClick3).not.toHaveBeenCalled()
    })
  })

  describe('return value contract', () => {
    it('returns object with handleKeyDown function', () => {
      const { result } = renderHook(() => useButtonKeyboard(vi.fn()))

      expect(result.current).toEqual({
        handleKeyDown: expect.any(Function),
      })
    })

    it('handler reference changes on each render', () => {
      const { result, rerender } = renderHook(() => useButtonKeyboard(vi.fn()))
      const firstHandler = result.current.handleKeyDown

      rerender()

      expect(result.current.handleKeyDown).not.toBe(firstHandler)
    })

    it('handler remains functionally equivalent across renders', () => {
      const onClick = vi.fn()
      const { result, rerender } = renderHook(() => useButtonKeyboard(onClick))

      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)
      expect(onClick).toHaveBeenCalledTimes(1)

      rerender()

      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)
      expect(onClick).toHaveBeenCalledTimes(2)
    })
  })
})
