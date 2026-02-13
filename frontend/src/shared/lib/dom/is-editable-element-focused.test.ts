import { describe, it, expect, afterEach } from 'vitest'
import { isEditableElementFocused } from './is-editable-element-focused'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('isEditableElementFocused', () => {
  it('returns false when no element has focus', () => {
    expect(isEditableElementFocused()).toBe(false)
  })

  it('returns true for focused input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    expect(isEditableElementFocused()).toBe(true)
  })

  it('returns true for focused textarea', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    expect(isEditableElementFocused()).toBe(true)
  })

  it('returns true for focused select', () => {
    const select = document.createElement('select')
    document.body.appendChild(select)
    select.focus()

    expect(isEditableElementFocused()).toBe(true)
  })

  it('returns true for focused contenteditable element', () => {
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    document.body.appendChild(div)
    div.focus()

    expect(isEditableElementFocused()).toBe(true)
  })

  it('returns false for focused non-editable element', () => {
    const div = document.createElement('div')
    div.tabIndex = 0
    document.body.appendChild(div)
    div.focus()

    expect(isEditableElementFocused()).toBe(false)
  })

  it('returns false for focused button', () => {
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()

    expect(isEditableElementFocused()).toBe(false)
  })

  it('returns false for contenteditable set to false', () => {
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'false')
    div.tabIndex = 0
    document.body.appendChild(div)
    div.focus()

    expect(isEditableElementFocused()).toBe(false)
  })
})
