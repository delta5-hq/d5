import { useEffect, useRef, useId, useMemo } from 'react'
import baseGenieJson from '@shared/assets/genie/base-genie.json'
import eyesBlinkJson from '@shared/assets/genie/eyes-blink.json'
import radialFlashJson from '@shared/assets/genie/radial-flash.json'
import type { TgsPlayerInstance } from './types'

type GenieVariant = 'base' | 'eyes' | 'flash' | 'eyes-flash'

export interface GenieLottieProps {
  size?: number
  className?: string
  variant?: GenieVariant
  flashColor?: string
  eyeColor?: string
}

declare global {
  interface Window {
    TgsPlayer?: new (data: unknown, containerId: string) => TgsPlayerInstance
  }
}

let playerLoaded = false
const loadPlayerRuntime = async () => {
  if (playerLoaded || typeof window === 'undefined') return
  playerLoaded = true

  try {
    const response = await fetch('/src/shared/assets/genie/base-genie.player.js')
    const code = await response.text()
    const script = document.createElement('script')
    script.textContent = code
    document.head.appendChild(script)
  } catch {
    playerLoaded = false
  }
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

    const initPlayer = async () => {
      await loadPlayerRuntime()

      const waitForPlayer = () => {
        if (window.TgsPlayer && containerRef.current && !playersRef.current.length) {
          playersRef.current = animations.map((data, i) => {
            const id = `${playerId}-${i}`
            const el = document.getElementById(id)
            if (el) el.innerHTML = ''
            const player = new window.TgsPlayer!(data, id)
            player.play()
            return player
          })
        } else if (!window.TgsPlayer) {
          setTimeout(waitForPlayer, 50)
        }
      }
      waitForPlayer()
    }

    initPlayer()

    return () => {
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
