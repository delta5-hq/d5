import type { KeyboardEvent } from 'react'

export const useButtonKeyboard = (onClick: () => void) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return { handleKeyDown }
}
