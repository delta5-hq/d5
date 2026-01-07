import { ANIMATION_DURATION } from '@shared/config'
import { cn } from '@shared/lib/utils'

export const getButtonHoverAnimation = () =>
  cn(
    `transition-all duration-${ANIMATION_DURATION.DEFAULT} ease-out`,
    'hover:scale-[1.02] active:scale-[0.98]',
    'hover:shadow-lg',
  )

export const getFocusRingAnimation = () =>
  cn(
    'focus-visible:transition-shadow',
    `focus-visible:duration-${ANIMATION_DURATION.DEFAULT}`,
    'focus-visible:animate-in focus-visible:fade-in-0',
  )

export const getLoadingTextAnimation = () => cn('animate-pulse')

export const getTextTransition = () => cn(`transition-opacity duration-${ANIMATION_DURATION.FAST}`)
