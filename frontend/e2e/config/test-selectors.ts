/* Centralized selector patterns for E2E tests */

export const SELECTORS = {
  /* Collaborative toggle switches by visibility mode */
  collaborativeToggle: (mode: 'public' | 'unlisted') => {
    return mode === 'public'
      ? 'button[role="switch"]:last-of-type'
      : 'button[role="switch"]:first-of-type'
  },
  
  /* Radio button by visibility mode */
  visibilityRadio: (mode: 'private' | 'public' | 'unlisted') => {
    return `button[role="radio"][value="${mode}"]`
  },
  
  /* Label by visibility mode */
  visibilityLabel: (mode: 'private' | 'public' | 'unlisted') => {
    return mode === 'unlisted'
      ? 'label[for="unlisted"]'
      : `label[for="${mode}"]`
  },
} as const

export type VisibilityMode = 'private' | 'public' | 'unlisted'
export type CollaborativeMode = 'public' | 'unlisted'
