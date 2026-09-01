import { useEffect, useRef, useId, useMemo } from 'react'
import baseGenieJson from '@shared/assets/genie/base-genie.json'
import eyesBlinkJson from '@shared/assets/genie/eyes-blink.json'
import radialFlashJson from '@shared/assets/genie/radial-flash.json'
import type { TgsPlayerInstance } from './types'
import { loadPlayerRuntime } from './player-runtime'

type GenieVariant = 'base' | 'eyes' | 'flash' | 'eyes-flash'

export interface GenieLottieProps {
  size?: number
  className?: string
  variant?: GenieVariant
  flashColor?: string
  eyeColor?: string
}

function hexToRgba(hex: string): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255, 1]
  }
  return [0, 0.9, 1, 1]
}

function replaceEyeColor(json: unknown, newColor: string): unknown {
  const rgba = hexToRgba(newColor)
  const str = JSON.stringify(json)
  const replaced = str.replace(/"k":\s*\[\s*0\s*,\s*0\.9\s*,\s*1\s*,\s*1\s*\]/g, `"k":${JSON.stringify(rgba)}`)
  return JSON.parse(replaced)
}

const variantData: Record<GenieVariant, unknown[]> = {
  base: [baseGenieJson],
  eyes: [eyesBlinkJson],
  flash: [radialFlashJson],
  'eyes-flash': [radialFlashJson, eyesBlinkJson],
}

export const GenieLottie = ({ size = 36, className, variant = 'base', flashColor, eyeColor }: GenieLottieProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const playersRef = useRef<TgsPlayerInstance[]>([])
  const uniqueId = useId().replace(/:/g, '')
  const playerId = `genie-${uniqueId}`

  const animations = useMemo(() => {
    const base = variantData[variant]
    if (eyeColor && (variant === 'eyes' || variant === 'eyes-flash')) {
      return base.map(data => {
        if (data === eyesBlinkJson) {
          return replaceEyeColor(data, eyeColor)
        }
        return data
      })
    }
    return base
  }, [variant, eyeColor])

  useEffect(() => {
    if (!containerRef.current) return

    /* Clean up existing players before creating new ones */
    playersRef.current.forEach(p => p?.stop())
    playersRef.current = []
    animations.forEach((_, i) => {
      const el = document.getElementById(`${playerId}-${i}`)
      if (el) el.innerHTML = ''
    })
    let cancelled = false

    const initPlayer = async () => {
      const loaded = await loadPlayerRuntime()
      if (cancelled || !loaded || !window.TgsPlayer || !containerRef.current || playersRef.current.length) return

      playersRef.current = animations.map((data, i) => {
        const id = `${playerId}-${i}`
        const el = document.getElementById(id)
        if (el) el.innerHTML = ''
        const player = new window.TgsPlayer!(data, id)
        player.play()
        return player
      })
    }

    initPlayer()

    return () => {
      cancelled = true
      playersRef.current.forEach(p => p?.stop())
      playersRef.current = []
      animations.forEach((_, i) => {
        const el = document.getElementById(`${playerId}-${i}`)
        if (el) el.innerHTML = ''
      })
    }
  }, [playerId, variant, animations, eyeColor])

  return (
    <div
      className={className}
      ref={containerRef}
      style={{
        width: size,
        height: size,
        position: 'relative',
        ...(flashColor && ({ '--genie-flash-color': flashColor } as Record<string, string>)),
        ...(eyeColor && ({ '--genie-eye-color': eyeColor } as Record<string, string>)),
      }}
    >
      {animations.map((_, i) => (
        <div
          id={`${playerId}-${i}`}
          key={i}
          style={{
            width: size,
            height: size,
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      ))}
    </div>
  )
}
