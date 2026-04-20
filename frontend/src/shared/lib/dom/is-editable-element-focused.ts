const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export const isEditableElementFocused = (): boolean => {
  const el = document.activeElement
  if (!el) return false
  if (EDITABLE_TAGS.has(el.tagName)) return true
  return el.getAttribute('contenteditable') === 'true'
}
