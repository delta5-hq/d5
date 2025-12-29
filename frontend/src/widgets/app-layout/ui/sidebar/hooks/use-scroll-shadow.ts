import { useEffect, useRef, useState } from 'react'

interface ScrollShadowState {
  isAtTop: boolean
  isAtBottom: boolean
}

export const useScrollShadow = () => {
  const scrollRef = useRef<HTMLElement>(null)
  const [state, setState] = useState<ScrollShadowState>({
    isAtTop: true,
    isAtBottom: false,
  })

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    const checkScrollPosition = () => {
      const { scrollTop, scrollHeight, clientHeight } = element
      const atTop = scrollTop <= 5
      const atBottom = scrollTop + clientHeight >= scrollHeight - 5

      setState({ isAtTop: atTop, isAtBottom: atBottom })
    }

    element.addEventListener('scroll', checkScrollPosition)
    checkScrollPosition()

    return () => element.removeEventListener('scroll', checkScrollPosition)
  }, [])

  return { scrollRef, ...state }
}
