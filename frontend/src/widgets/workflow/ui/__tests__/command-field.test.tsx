import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommandField } from '../command-field'

type ComboCase = readonly [
  label: string,
  modifiers: Record<string, boolean>,
  callbackProp: 'onEnter' | 'onCtrlEnter' | 'onShiftCtrlEnter',
  blursOnCommit: boolean,
]

const KEY_COMBOS: readonly ComboCase[] = [
  ['Enter', {}, 'onEnter', true],
  ['Ctrl+Enter', { ctrlKey: true }, 'onCtrlEnter', false],
  ['Shift+Ctrl+Enter', { ctrlKey: true, shiftKey: true }, 'onShiftCtrlEnter', false],
] as const

const storage: Record<string, string> = {}

vi.mock('@shared/lib/storage', () => ({
  safeLocalStorage: {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => {
      storage[key] = value
    },
    removeItem: (key: string) => {
      delete storage[key]
    },
  },
}))

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  vi.clearAllMocks()
})

const NODE_A = 'node-a'
const NODE_B = 'node-b'
const KEY_A = `workflow:node:${NODE_A}:command`
const KEY_B = `workflow:node:${NODE_B}:command`
const IDLE_COMMIT_MS = 3000

function renderField(overrides: Partial<Parameters<typeof CommandField>[0]> = {}) {
  const onChange = vi.fn()
  const result = render(<CommandField nodeId={NODE_A} onChange={onChange} value="" {...overrides} />)
  const textarea = () => screen.getByRole('textbox')
  return { ...result, onChange, textarea }
}

async function advanceIdleTimer() {
  await vi.advanceTimersByTimeAsync(IDLE_COMMIT_MS)
}

describe('CommandField', () => {
  describe('Initial display value', () => {
    it('shows the committed value when no localStorage draft exists', () => {
      renderField({ value: 'hello' })
      expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
    })

    it('shows the localStorage draft instead of the committed value when a draft is stored', () => {
      storage[KEY_A] = 'saved-draft'
      renderField({ value: 'committed' })
      expect(screen.getByDisplayValue('saved-draft')).toBeInTheDocument()
    })

    it('shows an empty string when committed value is empty and no draft is stored', () => {
      renderField({ value: '' })
      expect(screen.getByRole('textbox')).toHaveValue('')
    })

    it('shows the committed value when the stored draft matches the committed value exactly', () => {
      storage[KEY_A] = 'same'
      renderField({ value: 'same' })
      expect(screen.getByDisplayValue('same')).toBeInTheDocument()
    })
  })

  describe('Value prop sync', () => {
    it('updates the display when the committed value changes while no draft is stored', () => {
      const { rerender, textarea } = renderField({ value: 'v1' })
      rerender(<CommandField nodeId={NODE_A} onChange={vi.fn()} value="v2" />)
      expect(textarea()).toHaveValue('v2')
    })

    it('preserves the draft when the committed value changes while a draft is stored', () => {
      const { rerender, textarea } = renderField({ value: 'committed' })
      fireEvent.change(textarea(), { target: { value: 'draft' } })
      rerender(<CommandField nodeId={NODE_A} onChange={vi.fn()} value="updated-committed" />)
      expect(textarea()).toHaveValue('draft')
    })

    it('syncs to the new node draft on nodeId change when that node has a stored draft', () => {
      storage[KEY_B] = 'node-b-draft'
      const { rerender, textarea } = renderField({ nodeId: NODE_A, value: 'node-a-value' })
      rerender(<CommandField nodeId={NODE_B} onChange={vi.fn()} value="node-b-value" />)
      expect(textarea()).toHaveValue('node-b-draft')
    })

    it('syncs to the committed value on nodeId change when the new node has no stored draft', () => {
      const { rerender, textarea } = renderField({ nodeId: NODE_A, value: 'node-a-value' })
      rerender(<CommandField nodeId={NODE_B} onChange={vi.fn()} value="node-b-value" />)
      expect(textarea()).toHaveValue('node-b-value')
    })
  })

  describe('Props forwarding', () => {
    it('forwards the placeholder to the textarea', () => {
      renderField({ placeholder: 'Type a command…' })
      expect(screen.getByPlaceholderText('Type a command…')).toBeInTheDocument()
    })

    it('forwards a custom className to the textarea', () => {
      renderField({ className: 'my-custom-class' })
      expect(screen.getByRole('textbox').className).toContain('my-custom-class')
    })

    it('preserves the custom className alongside the dirty border class', () => {
      renderField({ value: 'original', className: 'my-custom-class' })
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'modified' } })
      const ta = screen.getByRole('textbox')
      expect(ta.className).toContain('my-custom-class')
      expect(ta.className).toContain('border-amber-400')
    })
  })

  describe('localStorage draft persistence', () => {
    it('writes typed text to localStorage when it differs from the committed value', () => {
      renderField({ value: 'original' })
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'typed' } })
      expect(storage[KEY_A]).toBe('typed')
    })

    it('removes the localStorage entry when the draft is restored to the committed value', () => {
      renderField({ value: 'original' })
      const ta = screen.getByRole('textbox')
      fireEvent.change(ta, { target: { value: 'typed' } })
      fireEvent.change(ta, { target: { value: 'original' } })
      expect(storage[KEY_A]).toBeUndefined()
    })

    it('overwrites the localStorage entry on successive keystrokes', () => {
      renderField({ value: 'original' })
      const ta = screen.getByRole('textbox')
      fireEvent.change(ta, { target: { value: 'a' } })
      fireEvent.change(ta, { target: { value: 'ab' } })
      fireEvent.change(ta, { target: { value: 'abc' } })
      expect(storage[KEY_A]).toBe('abc')
    })

    it('scopes entries to the nodeId — a different node does not share storage', () => {
      storage[KEY_B] = 'node-b-draft'
      renderField({ nodeId: NODE_A, value: 'original' })
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'typed' } })
      expect(storage[KEY_B]).toBe('node-b-draft')
    })

    it('uses the workflow:node:{nodeId}:command key format', () => {
      renderField({ nodeId: NODE_A, value: 'original' })
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'typed' } })
      expect(storage[KEY_A]).toBe('typed')
      expect(Object.keys(storage).every(k => k === KEY_A)).toBe(true)
    })

    it('resolves to separate keys for distinct nodeIds', () => {
      storage[KEY_A] = 'draft-a'
      storage[KEY_B] = 'draft-b'
      const { rerender, textarea } = renderField({ nodeId: NODE_A, value: '' })
      expect(textarea()).toHaveValue('draft-a')
      rerender(<CommandField nodeId={NODE_B} onChange={vi.fn()} value="" />)
      expect(textarea()).toHaveValue('draft-b')
    })
  })

  describe('Dirty border indicator', () => {
    it('applies the amber border class when the draft differs from the committed value', () => {
      renderField({ value: 'original' })
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'modified' } })
      expect(screen.getByRole('textbox').className).toContain('border-amber-400')
    })

    it('removes the amber border class when the draft is set back to the committed value', () => {
      renderField({ value: 'original' })
      const ta = screen.getByRole('textbox')
      fireEvent.change(ta, { target: { value: 'modified' } })
      fireEvent.change(ta, { target: { value: 'original' } })
      expect(ta.className).not.toContain('border-amber-400')
    })

    it('shows the amber border on mount when a localStorage draft already differs from the committed value', () => {
      storage[KEY_A] = 'stale-draft'
      renderField({ value: 'committed' })
      expect(screen.getByRole('textbox').className).toContain('border-amber-400')
    })

    it('amber border persists after blur until the parent re-renders with the committed value as the new value prop', () => {
      const { textarea, rerender } = renderField({ value: 'original' })
      fireEvent.change(textarea(), { target: { value: 'modified' } })
      fireEvent.blur(textarea())
      expect(textarea().className).toContain('border-amber-400')
      rerender(<CommandField nodeId={NODE_A} onChange={vi.fn()} value="modified" />)
      expect(textarea().className).not.toContain('border-amber-400')
    })
  })

  describe('Commit contract', () => {
    describe('via blur', () => {
      it('calls onChange with the current draft on blur when dirty', () => {
        const { onChange, textarea } = renderField({ value: 'old' })
        fireEvent.change(textarea(), { target: { value: 'new' } })
        fireEvent.blur(textarea())
        expect(onChange).toHaveBeenCalledWith('new')
        expect(onChange).toHaveBeenCalledTimes(1)
      })

      it('does not call onChange on blur when the draft equals the committed value', () => {
        const { onChange, textarea } = renderField({ value: 'same' })
        fireEvent.blur(textarea())
        expect(onChange).not.toHaveBeenCalled()
      })

      it('clears the localStorage entry after a blur commit', () => {
        renderField({ value: 'old' })
        const ta = screen.getByRole('textbox')
        fireEvent.change(ta, { target: { value: 'new' } })
        fireEvent.blur(ta)
        expect(storage[KEY_A]).toBeUndefined()
      })
    })

    describe('via unmount', () => {
      it('calls onChange on unmount when the draft is dirty', () => {
        const { onChange, textarea, unmount } = renderField({ value: 'old' })
        fireEvent.change(textarea(), { target: { value: 'unsaved' } })
        unmount()
        expect(onChange).toHaveBeenCalledWith('unsaved')
        expect(onChange).toHaveBeenCalledTimes(1)
      })

      it('does not call onChange on unmount when the draft equals the committed value', () => {
        const { onChange, unmount } = renderField({ value: 'same' })
        unmount()
        expect(onChange).not.toHaveBeenCalled()
      })

      it('clears the localStorage entry after an unmount commit', () => {
        const { textarea, unmount } = renderField({ value: 'old' })
        fireEvent.change(textarea(), { target: { value: 'unsaved' } })
        unmount()
        expect(storage[KEY_A]).toBeUndefined()
      })
    })

    describe('idempotency', () => {
      it.each(KEY_COMBOS)('%s before blur does not cause a second commit', (_label, modifiers, callbackProp) => {
        const { onChange, textarea } = renderField({ value: 'old', [callbackProp]: vi.fn() })
        fireEvent.change(textarea(), { target: { value: 'new' } })
        fireEvent.keyDown(textarea(), { key: 'Enter', ...modifiers })
        fireEvent.blur(textarea())
        expect(onChange).toHaveBeenCalledTimes(1)
      })

      it('blur before unmount does not cause a second commit', () => {
        const { onChange, textarea, unmount } = renderField({ value: 'old' })
        fireEvent.change(textarea(), { target: { value: 'new' } })
        fireEvent.blur(textarea())
        unmount()
        expect(onChange).toHaveBeenCalledTimes(1)
      })

      it('Escape before unmount does not commit at all', () => {
        const { onChange, textarea, unmount } = renderField({ value: 'original' })
        fireEvent.change(textarea(), { target: { value: 'typed' } })
        fireEvent.keyDown(textarea(), { key: 'Escape' })
        unmount()
        expect(onChange).not.toHaveBeenCalled()
      })
    })
  })

  describe('Keyboard — key combo dispatch', () => {
    describe('each combo commits the draft and calls only its own callback', () => {
      it.each(KEY_COMBOS)('%s commits the draft and delivers it to the callback', (_label, modifiers, callbackProp) => {
        const cb = vi.fn()
        const { onChange, textarea } = renderField({ value: 'old', [callbackProp]: cb })
        fireEvent.change(textarea(), { target: { value: 'new' } })
        fireEvent.keyDown(textarea(), { key: 'Enter', ...modifiers })
        expect(cb).toHaveBeenCalledTimes(1)
        expect(cb).toHaveBeenCalledWith('new')
        expect(onChange).toHaveBeenCalledWith('new')
      })

      it.each(KEY_COMBOS)('%s — Meta key (macOS) triggers the same callback', (_label, modifiers, callbackProp) => {
        if (Object.keys(modifiers).length === 0) return
        const metaModifiers = { ...modifiers, ctrlKey: false, metaKey: true }
        const cb = vi.fn()
        const { onChange, textarea } = renderField({ value: 'old', [callbackProp]: cb })
        fireEvent.change(textarea(), { target: { value: 'new' } })
        fireEvent.keyDown(textarea(), { key: 'Enter', ...metaModifiers })
        expect(cb).toHaveBeenCalledTimes(1)
        expect(cb).toHaveBeenCalledWith('new')
        expect(onChange).toHaveBeenCalledWith('new')
      })

      it.each(KEY_COMBOS)(
        '%s calls the callback with the current value even when the draft equals the committed value',
        (_label, modifiers, callbackProp) => {
          const cb = vi.fn()
          const { onChange, textarea } = renderField({ value: 'same', [callbackProp]: cb })
          fireEvent.keyDown(textarea(), { key: 'Enter', ...modifiers })
          expect(cb).toHaveBeenCalledTimes(1)
          expect(cb).toHaveBeenCalledWith('same')
          expect(onChange).not.toHaveBeenCalled()
        },
      )

      it.each(KEY_COMBOS)(
        '%s delivers the last typed value after multiple intermediate edits without a prior commit',
        (_label, modifiers, callbackProp) => {
          const cb = vi.fn()
          const { textarea } = renderField({ value: 'start', [callbackProp]: cb })
          const ta = textarea()
          fireEvent.change(ta, { target: { value: 'a' } })
          fireEvent.change(ta, { target: { value: 'ab' } })
          fireEvent.change(ta, { target: { value: '/chat final' } })
          fireEvent.keyDown(ta, { key: 'Enter', ...modifiers })
          expect(cb).toHaveBeenCalledWith('/chat final')
        },
      )

      it.each(KEY_COMBOS)('%s does not trigger any other combo callback', (_label, modifiers, callbackProp) => {
        const all = { onEnter: vi.fn(), onCtrlEnter: vi.fn(), onShiftCtrlEnter: vi.fn() }
        const { textarea } = renderField({ value: 'v', ...all })
        fireEvent.keyDown(textarea(), { key: 'Enter', ...modifiers })
        Object.entries(all)
          .filter(([k]) => k !== callbackProp)
          .forEach(([, fn]) => expect(fn).not.toHaveBeenCalled())
      })
    })

    describe('absent callback behaviour', () => {
      it('Enter does nothing when onEnter is absent — no commit, no throw, draft preserved', () => {
        const { onChange, textarea } = renderField({ value: 'old' })
        fireEvent.change(textarea(), { target: { value: 'new' } })
        expect(() => fireEvent.keyDown(textarea(), { key: 'Enter' })).not.toThrow()
        expect(onChange).not.toHaveBeenCalled()
        expect(textarea()).toHaveValue('new')
      })

      it('Enter when onEnter is absent does not call preventDefault — the browser default is preserved', () => {
        const { textarea } = renderField({ value: 'old' })
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
        textarea().dispatchEvent(event)
        expect(preventDefaultSpy).not.toHaveBeenCalled()
      })

      it.each([
        ['Ctrl+Enter', { ctrlKey: true }] as const,
        ['Shift+Ctrl+Enter', { ctrlKey: true, shiftKey: true }] as const,
      ])('%s always commits even when its callback is absent', (_label, modifiers) => {
        const { onChange, textarea } = renderField({ value: 'old' })
        fireEvent.change(textarea(), { target: { value: 'new' } })
        expect(() => fireEvent.keyDown(textarea(), { key: 'Enter', ...modifiers })).not.toThrow()
        expect(onChange).toHaveBeenCalledWith('new')
      })
    })

    describe('focus behaviour after commit', () => {
      it.each(KEY_COMBOS)('%s — textarea %s focus after commit', (_label, modifiers, callbackProp, blursOnCommit) => {
        const { textarea } = renderField({ value: 'old', [callbackProp]: vi.fn() })
        textarea().focus()
        fireEvent.keyDown(textarea(), { key: 'Enter', ...modifiers })
        const remainsFocused = document.activeElement === textarea()
        expect(remainsFocused).toBe(!blursOnCommit)
      })

      it('Enter blurs before the callback receives control', () => {
        let isBlurredWhenCallbackFires = false
        const { textarea } = renderField({
          value: 'old',
          onEnter: () => {
            isBlurredWhenCallbackFires = document.activeElement !== textarea()
          },
        })
        textarea().focus()
        fireEvent.change(textarea(), { target: { value: 'new' } })
        fireEvent.keyDown(textarea(), { key: 'Enter' })
        expect(isBlurredWhenCallbackFires).toBe(true)
      })

      it('Enter without onEnter does not blur — focus is preserved', () => {
        const { textarea } = renderField({ value: 'old' })
        textarea().focus()
        fireEvent.keyDown(textarea(), { key: 'Enter' })
        expect(document.activeElement).toBe(textarea())
      })
    })

    describe('Shift+Enter — newline insertion', () => {
      it('does not commit and does not call any callback', () => {
        const all = { onEnter: vi.fn(), onCtrlEnter: vi.fn(), onShiftCtrlEnter: vi.fn() }
        const { onChange, textarea } = renderField({ value: 'old', ...all })
        fireEvent.change(textarea(), { target: { value: 'new' } })
        fireEvent.keyDown(textarea(), { key: 'Enter', shiftKey: true })
        expect(onChange).not.toHaveBeenCalled()
        Object.values(all).forEach(fn => expect(fn).not.toHaveBeenCalled())
      })
    })

    describe('Escape — discard draft', () => {
      it('restores the committed value', () => {
        const { textarea } = renderField({ value: 'original' })
        fireEvent.change(textarea(), { target: { value: 'modified' } })
        fireEvent.keyDown(textarea(), { key: 'Escape' })
        expect(textarea()).toHaveValue('original')
      })

      it('does not call onChange', () => {
        const { onChange, textarea } = renderField({ value: 'original' })
        fireEvent.change(textarea(), { target: { value: 'modified' } })
        fireEvent.keyDown(textarea(), { key: 'Escape' })
        expect(onChange).not.toHaveBeenCalled()
      })

      it('clears the localStorage entry', () => {
        renderField({ value: 'original' })
        const ta = screen.getByRole('textbox')
        fireEvent.change(ta, { target: { value: 'modified' } })
        fireEvent.keyDown(ta, { key: 'Escape' })
        expect(storage[KEY_A]).toBeUndefined()
      })

      it('is a no-op when the field is already clean', () => {
        const { onChange, textarea } = renderField({ value: 'clean' })
        expect(() => fireEvent.keyDown(textarea(), { key: 'Escape' })).not.toThrow()
        expect(onChange).not.toHaveBeenCalled()
        expect(textarea()).toHaveValue('clean')
      })

      it('does not call any keyboard callback', () => {
        const all = { onEnter: vi.fn(), onCtrlEnter: vi.fn(), onShiftCtrlEnter: vi.fn() }
        const { textarea } = renderField({ value: 'old', ...all })
        fireEvent.keyDown(textarea(), { key: 'Escape' })
        Object.values(all).forEach(fn => expect(fn).not.toHaveBeenCalled())
      })
    })
  })

  describe('Value edge cases', () => {
    it('handles committing to an empty string', () => {
      const { onChange, textarea } = renderField({ value: 'content' })
      fireEvent.change(textarea(), { target: { value: '' } })
      fireEvent.blur(textarea())
      expect(onChange).toHaveBeenCalledWith('')
    })

    it('handles multiline content with embedded newlines', () => {
      const { onChange, textarea } = renderField({ value: 'line1' })
      fireEvent.change(textarea(), { target: { value: 'line1\nline2\nline3' } })
      fireEvent.blur(textarea())
      expect(onChange).toHaveBeenCalledWith('line1\nline2\nline3')
    })

    it('handles Unicode and emoji content', () => {
      const { onChange, textarea } = renderField({ value: '' })
      fireEvent.change(textarea(), { target: { value: '你好 🌍 Привет' } })
      fireEvent.blur(textarea())
      expect(onChange).toHaveBeenCalledWith('你好 🌍 Привет')
    })

    it('rapid successive changes — only the final value is committed on blur', () => {
      const { onChange, textarea } = renderField({ value: 'start' })
      const ta = textarea()
      fireEvent.change(ta, { target: { value: 'a' } })
      fireEvent.change(ta, { target: { value: 'ab' } })
      fireEvent.change(ta, { target: { value: 'abc' } })
      fireEvent.blur(ta)
      expect(onChange).toHaveBeenCalledWith('abc')
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('preserves slash-command syntax verbatim', () => {
      const { onChange, textarea } = renderField({ value: '' })
      fireEvent.change(textarea(), { target: { value: '/chat Write a poem' } })
      fireEvent.blur(textarea())
      expect(onChange).toHaveBeenCalledWith('/chat Write a poem')
    })
  })

  describe('Idle-commit', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('calls onChange after 3 s of inactivity when dirty', async () => {
      const { onChange, textarea } = renderField({ value: 'original' })
      fireEvent.change(textarea(), { target: { value: 'idle-typed' } })
      await advanceIdleTimer()
      expect(onChange).toHaveBeenCalledWith('idle-typed')
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('does not call onChange before 3 s have elapsed', async () => {
      const { onChange, textarea } = renderField({ value: 'original' })
      fireEvent.change(textarea(), { target: { value: 'idle-typed' } })
      await vi.advanceTimersByTimeAsync(IDLE_COMMIT_MS - 1)
      expect(onChange).not.toHaveBeenCalled()
    })

    it('resets the timer on each keystroke — only fires 3 s after the last change', async () => {
      const { onChange, textarea } = renderField({ value: 'original' })
      const ta = textarea()
      fireEvent.change(ta, { target: { value: 'a' } })
      await vi.advanceTimersByTimeAsync(2000)
      fireEvent.change(ta, { target: { value: 'ab' } })
      await vi.advanceTimersByTimeAsync(2000)
      expect(onChange).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1000)
      expect(onChange).toHaveBeenCalledWith('ab')
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('does not fire when the draft equals the committed value', async () => {
      const { onChange, textarea } = renderField({ value: 'same' })
      fireEvent.change(textarea(), { target: { value: 'same' } })
      await advanceIdleTimer()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('clears the localStorage entry after the idle commit', async () => {
      renderField({ value: 'original' })
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'idle-typed' } })
      await advanceIdleTimer()
      expect(storage[KEY_A]).toBeUndefined()
    })

    it('does not fire after Escape discards the draft', async () => {
      const { onChange, textarea } = renderField({ value: 'original' })
      fireEvent.change(textarea(), { target: { value: 'modified' } })
      fireEvent.keyDown(textarea(), { key: 'Escape' })
      await advanceIdleTimer()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('cancels the pending timer on unmount — does not fire after component is gone', async () => {
      const { onChange, textarea, unmount } = renderField({ value: 'original' })
      fireEvent.change(textarea(), { target: { value: 'typed' } })
      unmount()
      await advanceIdleTimer()
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('is idempotent with blur — onChange fires exactly once when blur precedes the idle timer', async () => {
      const { onChange, textarea } = renderField({ value: 'original' })
      fireEvent.change(textarea(), { target: { value: 'typed' } })
      fireEvent.blur(textarea())
      await advanceIdleTimer()
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it.each(KEY_COMBOS)(
      'is idempotent with %s — onChange fires exactly once when the combo precedes the idle timer',
      async (_label, modifiers, callbackProp) => {
        const { onChange, textarea } = renderField({ value: 'original', [callbackProp]: vi.fn() })
        fireEvent.change(textarea(), { target: { value: 'typed' } })
        fireEvent.keyDown(textarea(), { key: 'Enter', ...modifiers })
        await advanceIdleTimer()
        expect(onChange).toHaveBeenCalledTimes(1)
      },
    )

    it('uses the latest onChange reference when committing via idle timer', async () => {
      const first = vi.fn()
      const second = vi.fn()
      const { textarea, rerender } = renderField({ value: 'old', onChange: first })
      fireEvent.change(textarea(), { target: { value: 'new' } })
      rerender(<CommandField nodeId={NODE_A} onChange={second} value="old" />)
      await advanceIdleTimer()
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledWith('new')
    })
  })

  describe('Callback freshness — always uses the latest prop reference', () => {
    it.each(KEY_COMBOS)(
      '%s uses the latest callback reference after a prop change',
      (_label, modifiers, callbackProp) => {
        const first = vi.fn()
        const second = vi.fn()
        const { rerender, textarea } = renderField({ value: 'v', [callbackProp]: first })
        rerender(<CommandField nodeId={NODE_A} onChange={vi.fn()} {...{ [callbackProp]: second }} value="v" />)
        fireEvent.keyDown(textarea(), { key: 'Enter', ...modifiers })
        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledTimes(1)
      },
    )

    it('uses the latest onChange reference when committing via blur', () => {
      const first = vi.fn()
      const second = vi.fn()
      const { textarea, rerender } = renderField({ value: 'old', onChange: first })
      fireEvent.change(textarea(), { target: { value: 'new' } })
      rerender(<CommandField nodeId={NODE_A} onChange={second} value="old" />)
      fireEvent.blur(textarea())
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledWith('new')
    })

    it('uses the latest onChange reference when committing via unmount', () => {
      const first = vi.fn()
      const second = vi.fn()
      const { textarea, rerender, unmount } = renderField({ value: 'old', onChange: first })
      fireEvent.change(textarea(), { target: { value: 'new' } })
      rerender(<CommandField nodeId={NODE_A} onChange={second} value="old" />)
      unmount()
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledWith('new')
    })

    it('unmount commit uses the current storageKey after a nodeId change mid-mount', () => {
      const onChange = vi.fn()
      const { textarea, rerender, unmount } = renderField({ nodeId: NODE_A, value: 'v', onChange })
      fireEvent.change(textarea(), { target: { value: 'draft' } })
      rerender(<CommandField nodeId={NODE_B} onChange={onChange} value="v" />)
      unmount()
      expect(storage[KEY_B]).toBeUndefined()
    })

    it('nodeId change mid-mount flushes the old draft to onChange before switching to the new node', () => {
      const onChange = vi.fn()
      const { textarea, rerender } = renderField({ nodeId: NODE_A, value: 'committed-a', onChange })
      fireEvent.change(textarea(), { target: { value: 'draft-a' } })
      fireEvent.blur(textarea())
      rerender(<CommandField nodeId={NODE_B} onChange={onChange} value="committed-b" />)
      expect(onChange).toHaveBeenCalledWith('draft-a')
    })
  })
})
