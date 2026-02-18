import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFieldDraft } from '../use-field-draft'

const KEY_A = 'test:key:a'
const KEY_B = 'test:key:b'

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
})

function renderDraft(committedValue = 'committed', storageKey = KEY_A, onChange = vi.fn()) {
  return renderHook(
    ({ cv, sk, oc }: { cv: string; sk: string; oc: (v: string) => void }) =>
      useFieldDraft({ storageKey: sk, committedValue: cv, onChange: oc }),
    { initialProps: { cv: committedValue, sk: storageKey, oc: onChange } },
  )
}

describe('useFieldDraft', () => {
  describe('initial draft value', () => {
    it('uses committedValue when localStorage has no entry', () => {
      const { result } = renderDraft('hello')
      expect(result.current.draft).toBe('hello')
    })

    it('uses stored draft when localStorage entry differs from committedValue', () => {
      storage[KEY_A] = 'saved-draft'
      const { result } = renderDraft('hello')
      expect(result.current.draft).toBe('saved-draft')
    })

    it('treats empty string as a valid committedValue', () => {
      const { result } = renderDraft('')
      expect(result.current.draft).toBe('')
    })

    it('falls back to committedValue when stored entry is an empty string matching none', () => {
      storage[KEY_A] = ''
      const { result } = renderDraft('non-empty')
      expect(result.current.draft).toBe('non-empty')
    })
  })

  describe('isDirty', () => {
    it('is false on init when no stored draft exists', () => {
      const { result } = renderDraft('same')
      expect(result.current.isDirty).toBe(false)
    })

    it('is true on init when stored draft differs from committedValue', () => {
      storage[KEY_A] = 'different'
      const { result } = renderDraft('committed')
      expect(result.current.isDirty).toBe(true)
    })

    it('becomes true after setDraft with a different value', () => {
      const { result } = renderDraft('original')
      act(() => result.current.setDraft('changed'))
      expect(result.current.isDirty).toBe(true)
    })

    it('returns to false when draft is typed back to committedValue', () => {
      const { result } = renderDraft('original')
      act(() => result.current.setDraft('changed'))
      act(() => result.current.setDraft('original'))
      expect(result.current.isDirty).toBe(false)
    })

    it('is false after commit', () => {
      const { result } = renderDraft('original')
      act(() => result.current.setDraft('new'))
      act(() => result.current.commit())
      expect(result.current.isDirty).toBe(false)
    })

    it('is false after discard', () => {
      const { result } = renderDraft('original')
      act(() => result.current.setDraft('new'))
      act(() => result.current.discard())
      expect(result.current.isDirty).toBe(false)
    })
  })

  describe('setDraft', () => {
    it('updates the draft state to the given value', () => {
      const { result } = renderDraft('original')
      act(() => result.current.setDraft('typed'))
      expect(result.current.draft).toBe('typed')
    })

    it('writes to localStorage when draft differs from committedValue', () => {
      const { result } = renderDraft('original')
      act(() => result.current.setDraft('typed'))
      expect(storage[KEY_A]).toBe('typed')
    })

    it('removes localStorage entry when draft is set back to committedValue', () => {
      storage[KEY_A] = 'old'
      const { result } = renderDraft('original')
      act(() => result.current.setDraft('original'))
      expect(storage[KEY_A]).toBeUndefined()
    })

    it('overwrites a previous draft on successive calls', () => {
      const { result } = renderDraft('original')
      act(() => result.current.setDraft('first'))
      act(() => result.current.setDraft('second'))
      expect(result.current.draft).toBe('second')
      expect(storage[KEY_A]).toBe('second')
    })

    it('does not affect a different storageKey', () => {
      const { result: a } = renderDraft('v', KEY_A)
      const { result: b } = renderDraft('v', KEY_B)
      act(() => a.current.setDraft('a-changed'))
      expect(b.current.draft).toBe('v')
      expect(storage[KEY_B]).toBeUndefined()
    })
  })

  describe('commit', () => {
    it('calls onChange with current draft when it differs from committedValue', () => {
      const onChange = vi.fn()
      const { result } = renderDraft('original', KEY_A, onChange)
      act(() => result.current.setDraft('new value'))
      act(() => result.current.commit())
      expect(onChange).toHaveBeenCalledWith('new value')
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('does not call onChange when draft equals committedValue', () => {
      const onChange = vi.fn()
      const { result } = renderDraft('same', KEY_A, onChange)
      act(() => result.current.commit())
      expect(onChange).not.toHaveBeenCalled()
    })

    it('does not call onChange when stale draft already matches committedValue', () => {
      storage[KEY_A] = 'same'
      const onChange = vi.fn()
      const { result } = renderDraft('same', KEY_A, onChange)
      act(() => result.current.commit())
      expect(onChange).not.toHaveBeenCalled()
    })

    it('removes localStorage entry after commit', () => {
      storage[KEY_A] = 'draft'
      const { result } = renderDraft('original')
      act(() => result.current.commit())
      expect(storage[KEY_A]).toBeUndefined()
    })

    it('is idempotent — second commit does not call onChange again', () => {
      const onChange = vi.fn()
      const { result } = renderDraft('original', KEY_A, onChange)
      act(() => result.current.setDraft('new'))
      act(() => result.current.commit())
      act(() => result.current.commit())
      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('discard', () => {
    it('resets draft to committedValue', () => {
      const { result } = renderDraft('original')
      act(() => result.current.setDraft('changed'))
      act(() => result.current.discard())
      expect(result.current.draft).toBe('original')
    })

    it('removes localStorage entry', () => {
      storage[KEY_A] = 'draft'
      const { result } = renderDraft('original')
      act(() => result.current.discard())
      expect(storage[KEY_A]).toBeUndefined()
    })

    it('does not call onChange', () => {
      const onChange = vi.fn()
      const { result } = renderDraft('original', KEY_A, onChange)
      act(() => result.current.setDraft('changed'))
      act(() => result.current.discard())
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('committedValue changes externally', () => {
    it('adopts new committedValue when no localStorage entry exists', () => {
      const { result, rerender } = renderDraft('v1')
      rerender({ cv: 'v2', sk: KEY_A, oc: vi.fn() })
      expect(result.current.draft).toBe('v2')
    })

    it('preserves a stored draft when committedValue changes', () => {
      storage[KEY_A] = 'my-draft'
      const { result, rerender } = renderDraft('v1')
      rerender({ cv: 'v2', sk: KEY_A, oc: vi.fn() })
      expect(result.current.draft).toBe('my-draft')
    })

    it('isDirty reflects the updated committedValue', () => {
      const { result, rerender } = renderDraft('v1')
      act(() => result.current.setDraft('typed'))
      rerender({ cv: 'typed', sk: KEY_A, oc: vi.fn() })
      expect(result.current.isDirty).toBe(false)
    })
  })

  describe('storageKey isolation', () => {
    it('two hooks with different keys do not share draft state', () => {
      const { result: a } = renderDraft('original', KEY_A)
      const { result: b } = renderDraft('original', KEY_B)
      act(() => a.current.setDraft('a-only'))
      expect(b.current.draft).toBe('original')
    })

    it('commit on one key does not clear the other key in storage', () => {
      storage[KEY_B] = 'b-draft'
      const { result: a } = renderDraft('original', KEY_A)
      act(() => a.current.setDraft('a-value'))
      act(() => a.current.commit())
      expect(storage[KEY_B]).toBe('b-draft')
    })
  })
})
