import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommandField } from '../command-field'

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

    it('scopes localStorage entries to the nodeId — a different node does not share storage', () => {
      storage[KEY_B] = 'node-b-draft'
      renderField({ nodeId: NODE_A, value: 'original' })
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'typed' } })
      expect(storage[KEY_B]).toBe('node-b-draft')
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
  })

  describe('Commit contract — onChange is called exactly once with the latest draft', () => {
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

    describe('idempotency — onChange fires exactly once regardless of commit path sequence', () => {
      it('does not double-commit when Enter fires before blur', () => {
        const onEnterCommit = vi.fn()
        const { onChange, textarea } = renderField({ value: 'old', onEnterCommit })
        fireEvent.change(textarea(), { target: { value: 'new' } })
        fireEvent.keyDown(textarea(), { key: 'Enter' })
        fireEvent.blur(textarea())
        expect(onChange).toHaveBeenCalledTimes(1)
      })

      it('does not double-commit when Ctrl+Enter fires before blur', () => {
        const onCtrlEnter = vi.fn()
        const { onChange, textarea } = renderField({ value: 'old', onCtrlEnter })
        fireEvent.change(textarea(), { target: { value: 'new' } })
        fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true })
        fireEvent.blur(textarea())
        expect(onChange).toHaveBeenCalledTimes(1)
      })

      it('does not double-commit when blur fires before unmount', () => {
        const { onChange, textarea, unmount } = renderField({ value: 'old' })
        fireEvent.change(textarea(), { target: { value: 'new' } })
        fireEvent.blur(textarea())
        unmount()
        expect(onChange).toHaveBeenCalledTimes(1)
      })

      it('does not commit on unmount after Escape discards the draft', () => {
        const { onChange, textarea, unmount } = renderField({ value: 'original' })
        fireEvent.change(textarea(), { target: { value: 'typed' } })
        fireEvent.keyDown(textarea(), { key: 'Escape' })
        unmount()
        expect(onChange).not.toHaveBeenCalled()
      })
    })
  })

  describe('Keyboard — Enter (plain)', () => {
    it('commits and calls onEnterCommit when onEnterCommit is provided', () => {
      const onEnterCommit = vi.fn()
      const { onChange, textarea } = renderField({ value: 'old', onEnterCommit })
      fireEvent.change(textarea(), { target: { value: 'new' } })
      fireEvent.keyDown(textarea(), { key: 'Enter' })
      expect(onChange).toHaveBeenCalledWith('new')
      expect(onEnterCommit).toHaveBeenCalledTimes(1)
    })

    it('calls onEnterCommit even when the draft equals the committed value', () => {
      const onEnterCommit = vi.fn()
      const { onChange, textarea } = renderField({ value: 'same', onEnterCommit })
      fireEvent.keyDown(textarea(), { key: 'Enter' })
      expect(onChange).not.toHaveBeenCalled()
      expect(onEnterCommit).toHaveBeenCalledTimes(1)
    })

    it('does not commit or throw when onEnterCommit is absent', () => {
      const { onChange, textarea } = renderField({ value: 'old' })
      fireEvent.change(textarea(), { target: { value: 'new' } })
      expect(() => fireEvent.keyDown(textarea(), { key: 'Enter' })).not.toThrow()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('does not trigger onCtrlEnter on plain Enter', () => {
      const onCtrlEnter = vi.fn()
      const onEnterCommit = vi.fn()
      const { textarea } = renderField({ value: 'old', onCtrlEnter, onEnterCommit })
      fireEvent.keyDown(textarea(), { key: 'Enter' })
      expect(onCtrlEnter).not.toHaveBeenCalled()
    })

    it('uses the latest onEnterCommit reference after a prop change', () => {
      const first = vi.fn()
      const second = vi.fn()
      const { rerender, textarea } = renderField({ value: 'v', onEnterCommit: first })
      rerender(<CommandField nodeId={NODE_A} onChange={vi.fn()} onEnterCommit={second} value="v" />)
      fireEvent.keyDown(textarea(), { key: 'Enter' })
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledTimes(1)
    })
  })

  describe('Keyboard — Shift+Enter', () => {
    it('does not commit and does not call onEnterCommit (Shift+Enter inserts a newline)', () => {
      const onEnterCommit = vi.fn()
      const { onChange, textarea } = renderField({ value: 'old', onEnterCommit })
      fireEvent.change(textarea(), { target: { value: 'new' } })
      fireEvent.keyDown(textarea(), { key: 'Enter', shiftKey: true })
      expect(onChange).not.toHaveBeenCalled()
      expect(onEnterCommit).not.toHaveBeenCalled()
    })

    it('does not call onCtrlEnter on Shift+Enter', () => {
      const onCtrlEnter = vi.fn()
      const { textarea } = renderField({ value: 'old', onCtrlEnter })
      fireEvent.keyDown(textarea(), { key: 'Enter', shiftKey: true })
      expect(onCtrlEnter).not.toHaveBeenCalled()
    })
  })

  describe('Keyboard — Ctrl+Enter / Meta+Enter', () => {
    it.each([
      ['Ctrl+Enter', { ctrlKey: true }],
      ['Meta+Enter (macOS)', { metaKey: true }],
    ] as const)('%s commits and calls onCtrlEnter', (_label, modifiers) => {
      const onCtrlEnter = vi.fn()
      const { onChange, textarea } = renderField({ value: 'old', onCtrlEnter })
      fireEvent.change(textarea(), { target: { value: 'new' } })
      fireEvent.keyDown(textarea(), { key: 'Enter', ...modifiers })
      expect(onChange).toHaveBeenCalledWith('new')
      expect(onCtrlEnter).toHaveBeenCalledTimes(1)
    })

    it('calls onCtrlEnter even when the draft equals the committed value', () => {
      const onCtrlEnter = vi.fn()
      const { onChange, textarea } = renderField({ value: 'same', onCtrlEnter })
      fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true })
      expect(onChange).not.toHaveBeenCalled()
      expect(onCtrlEnter).toHaveBeenCalledTimes(1)
    })

    it('does not throw when onCtrlEnter is absent and Ctrl+Enter is pressed', () => {
      const { onChange, textarea } = renderField({ value: 'old' })
      fireEvent.change(textarea(), { target: { value: 'new' } })
      expect(() => fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true })).not.toThrow()
      expect(onChange).toHaveBeenCalledWith('new')
    })

    it('does not trigger onEnterCommit on Ctrl+Enter', () => {
      const onEnterCommit = vi.fn()
      const onCtrlEnter = vi.fn()
      const { textarea } = renderField({ value: 'old', onEnterCommit, onCtrlEnter })
      fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true })
      expect(onEnterCommit).not.toHaveBeenCalled()
    })

    it('does not fire on Shift+Ctrl+Enter', () => {
      const onCtrlEnter = vi.fn()
      const { onChange, textarea } = renderField({ value: 'old', onCtrlEnter })
      fireEvent.change(textarea(), { target: { value: 'new' } })
      fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true, shiftKey: true })
      expect(onCtrlEnter).not.toHaveBeenCalled()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('uses the latest onCtrlEnter reference after a prop change', () => {
      const first = vi.fn()
      const second = vi.fn()
      const { rerender, textarea } = renderField({ value: 'v', onCtrlEnter: first })
      rerender(<CommandField nodeId={NODE_A} onChange={vi.fn()} onCtrlEnter={second} value="v" />)
      fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true })
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledTimes(1)
    })
  })

  describe('Keyboard — Escape (discard)', () => {
    it('restores the committed value and discards the draft', () => {
      const { textarea } = renderField({ value: 'original' })
      fireEvent.change(textarea(), { target: { value: 'modified' } })
      fireEvent.keyDown(textarea(), { key: 'Escape' })
      expect(screen.getByDisplayValue('original')).toBeInTheDocument()
    })

    it('does not call onChange on Escape', () => {
      const { onChange, textarea } = renderField({ value: 'original' })
      fireEvent.change(textarea(), { target: { value: 'modified' } })
      fireEvent.keyDown(textarea(), { key: 'Escape' })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('clears the localStorage entry on Escape', () => {
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

    it('does not call onEnterCommit on Escape', () => {
      const onEnterCommit = vi.fn()
      const { textarea } = renderField({ value: 'old', onEnterCommit })
      fireEvent.keyDown(textarea(), { key: 'Escape' })
      expect(onEnterCommit).not.toHaveBeenCalled()
    })

    it('does not call onCtrlEnter on Escape', () => {
      const onCtrlEnter = vi.fn()
      const { textarea } = renderField({ value: 'old', onCtrlEnter })
      fireEvent.keyDown(textarea(), { key: 'Escape' })
      expect(onCtrlEnter).not.toHaveBeenCalled()
    })
  })

  describe('Value edge cases', () => {
    it('handles empty string as a valid committed value', () => {
      const { onChange, textarea } = renderField({ value: '' })
      fireEvent.change(textarea(), { target: { value: 'typed' } })
      fireEvent.blur(textarea())
      expect(onChange).toHaveBeenCalledWith('typed')
    })

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

  describe('Idle-commit — commits to store after 3 s of typing inactivity', () => {
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

    it('is idempotent with Enter — onChange fires exactly once when Enter precedes the idle timer', async () => {
      const onEnterCommit = vi.fn()
      const { onChange, textarea } = renderField({ value: 'original', onEnterCommit })
      fireEvent.change(textarea(), { target: { value: 'typed' } })
      fireEvent.keyDown(textarea(), { key: 'Enter' })
      await advanceIdleTimer()
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('is idempotent with Ctrl+Enter — onChange fires exactly once when Ctrl+Enter precedes the idle timer', async () => {
      const onCtrlEnter = vi.fn()
      const { onChange, textarea } = renderField({ value: 'original', onCtrlEnter })
      fireEvent.change(textarea(), { target: { value: 'typed' } })
      fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true })
      await advanceIdleTimer()
      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('Callback freshness — always uses the latest prop reference', () => {
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
  })
})
