import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useClickOutside } from '../use-click-outside'
import { createRef } from 'react'

describe('useClickOutside', () => {
  let container: HTMLDivElement
  let innerElement: HTMLDivElement
  let outerElement: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    innerElement = document.createElement('div')
    innerElement.id = 'inner'
    outerElement = document.createElement('div')
    outerElement.id = 'outer'

    container.appendChild(innerElement)
    document.body.appendChild(container)
    document.body.appendChild(outerElement)
  })

  afterEach(() => {
    document.body.removeChild(container)
    document.body.removeChild(outerElement)
  })

  describe('Boundary Detection', () => {
    it('triggers on pointer down outside ref element', () => {
      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: innerElement, writable: false })
      const onClickOutside = vi.fn()

      renderHook(() => useClickOutside({ ref, onClickOutside }))

      outerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))

      expect(onClickOutside).toHaveBeenCalledTimes(1)
      expect(onClickOutside).toHaveBeenCalledWith(expect.any(PointerEvent))
    })

    it('does not trigger on pointer down inside ref element', () => {
      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: innerElement, writable: false })
      const onClickOutside = vi.fn()

      renderHook(() => useClickOutside({ ref, onClickOutside }))

      innerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))

      expect(onClickOutside).not.toHaveBeenCalled()
    })

    it('does not trigger on pointer down on ref element itself', () => {
      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: container, writable: false })
      const onClickOutside = vi.fn()

      renderHook(() => useClickOutside({ ref, onClickOutside }))

      container.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))

      expect(onClickOutside).not.toHaveBeenCalled()
    })

    it('does not trigger on deeply nested child within ref boundary', () => {
      const deepChild = document.createElement('span')
      const midChild = document.createElement('div')
      midChild.appendChild(deepChild)
      innerElement.appendChild(midChild)

      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: container, writable: false })
      const onClickOutside = vi.fn()

      renderHook(() => useClickOutside({ ref, onClickOutside }))

      deepChild.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))

      expect(onClickOutside).not.toHaveBeenCalled()
    })
  })

  describe('Pointer Button Filtering', () => {
    it('ignores middle-button (button=1) pointer down', () => {
      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: innerElement, writable: false })
      const onClickOutside = vi.fn()

      renderHook(() => useClickOutside({ ref, onClickOutside }))

      outerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 1 }))

      expect(onClickOutside).not.toHaveBeenCalled()
    })

    it('ignores right-button (button=2) pointer down', () => {
      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: innerElement, writable: false })
      const onClickOutside = vi.fn()

      renderHook(() => useClickOutside({ ref, onClickOutside }))

      outerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2 }))

      expect(onClickOutside).not.toHaveBeenCalled()
    })
  })

  describe('Enabled State', () => {
    it('does not trigger when enabled is false', () => {
      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: innerElement, writable: false })
      const onClickOutside = vi.fn()

      renderHook(() => useClickOutside({ ref, onClickOutside, enabled: false }))

      outerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))

      expect(onClickOutside).not.toHaveBeenCalled()
    })

    it('responds to enabled state changes', () => {
      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: innerElement, writable: false })
      const onClickOutside = vi.fn()

      const { rerender } = renderHook(({ enabled }) => useClickOutside({ ref, onClickOutside, enabled }), {
        initialProps: { enabled: false },
      })

      outerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      expect(onClickOutside).not.toHaveBeenCalled()

      rerender({ enabled: true })

      outerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      expect(onClickOutside).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge Cases', () => {
    it('does not trigger when ref.current is null', () => {
      const ref = createRef<HTMLDivElement>()
      const onClickOutside = vi.fn()

      renderHook(() => useClickOutside({ ref, onClickOutside }))

      outerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))

      expect(onClickOutside).not.toHaveBeenCalled()
    })

    it('does not trigger when event.target is null', () => {
      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: innerElement, writable: false })
      const onClickOutside = vi.fn()

      renderHook(() => useClickOutside({ ref, onClickOutside }))

      const event = new PointerEvent('pointerdown', { bubbles: true })
      Object.defineProperty(event, 'target', { value: null, writable: false })
      document.dispatchEvent(event)

      expect(onClickOutside).not.toHaveBeenCalled()
    })

    it('handles ref changing from null to valid element', () => {
      const ref = { current: null as HTMLDivElement | null }
      const onClickOutside = vi.fn()

      const { rerender } = renderHook(() => useClickOutside({ ref, onClickOutside }))

      outerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      expect(onClickOutside).not.toHaveBeenCalled()

      ref.current = innerElement
      rerender()

      outerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      expect(onClickOutside).toHaveBeenCalledTimes(1)
    })
  })

  describe('Lifecycle', () => {
    it('registers event listener on mount', () => {
      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: innerElement, writable: false })
      const onClickOutside = vi.fn()
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

      renderHook(() => useClickOutside({ ref, onClickOutside }))

      expect(addEventListenerSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    })

    it('removes event listener on unmount', () => {
      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: innerElement, writable: false })
      const onClickOutside = vi.fn()
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      const { unmount } = renderHook(() => useClickOutside({ ref, onClickOutside }))

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    })

    it('does not trigger after unmount', () => {
      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: innerElement, writable: false })
      const onClickOutside = vi.fn()

      const { unmount } = renderHook(() => useClickOutside({ ref, onClickOutside }))

      unmount()

      outerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))

      expect(onClickOutside).not.toHaveBeenCalled()
    })
  })

  describe('Handler Stability', () => {
    it('invokes latest handler after handler prop changes', () => {
      const ref = createRef<HTMLDivElement>()
      Object.defineProperty(ref, 'current', { value: innerElement, writable: false })
      const firstHandler = vi.fn()
      const secondHandler = vi.fn()

      const { rerender } = renderHook(({ handler }) => useClickOutside({ ref, onClickOutside: handler }), {
        initialProps: { handler: firstHandler },
      })

      outerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      expect(firstHandler).toHaveBeenCalledTimes(1)
      expect(secondHandler).not.toHaveBeenCalled()

      rerender({ handler: secondHandler })

      outerElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      expect(firstHandler).toHaveBeenCalledTimes(1)
      expect(secondHandler).toHaveBeenCalledTimes(1)
    })
  })
})
