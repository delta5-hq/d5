import { useMemo } from 'react'
import { ANIMATION_DURATION, ANIMATION_SCALE } from '@shared/config'
import { cn } from '@shared/lib/utils'

interface DialogAnimationConfig {
  fadeIn: boolean
  zoom: boolean
  slide: boolean
  duration: keyof typeof ANIMATION_DURATION
}

const DEFAULT_CONFIG: DialogAnimationConfig = {
  fadeIn: true,
  zoom: true,
  slide: false,
  duration: 'MEDIUM',
}

export const useDialogAnimation = (config: Partial<DialogAnimationConfig> = {}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  const classes = useMemo(() => {
    const baseClasses = ['data-[state=open]:animate-in', 'data-[state=closed]:animate-out']

    if (finalConfig.fadeIn) {
      baseClasses.push('data-[state=closed]:fade-out-0', 'data-[state=open]:fade-in-0')
    }

    if (finalConfig.zoom) {
      const zoomScale = Math.round(ANIMATION_SCALE.SUBTLE_ZOOM * 100)
      baseClasses.push(`data-[state=closed]:zoom-out-${zoomScale}`, `data-[state=open]:zoom-in-${zoomScale}`)
    }

    if (finalConfig.slide) {
      baseClasses.push('data-[state=closed]:slide-out-to-top-[2%]', 'data-[state=open]:slide-in-from-top-[2%]')
    }

    const duration = ANIMATION_DURATION[finalConfig.duration]
    baseClasses.push(
      `data-[state=closed]:duration-${ANIMATION_DURATION.DEFAULT}`,
      `data-[state=open]:duration-${duration}`,
    )

    return cn(baseClasses)
  }, [finalConfig.fadeIn, finalConfig.zoom, finalConfig.slide, finalConfig.duration])

  return classes
}
