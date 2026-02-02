import { useEffect, useRef, useId } from 'react'
import baseGenieJson from '@shared/assets/genie/base-genie.json'
import eyesBlinkJson from '@shared/assets/genie/eyes-blink.json'
import radialFlashJson from '@shared/assets/genie/radial-flash.json'

type GenieVariant = 'base' | 'eyes' | 'flash' | 'eyes-flash'

interface GenieProps {
  size?: number
  className?: string
  variant?: GenieVariant
}

/* Declare TgsPlayer on window */
declare global {
  interface Window {
    TgsPlayer?: new (data: unknown, containerId: string) => { play: () => void; stop: () => void }
  }
}

/* Load player runtime once */
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
  } catch (error) {
    console.error('Failed to load TGS player runtime:', error)
    playerLoaded = false
  }
}

const variantData: Record<GenieVariant, unknown[]> = {
  base: [baseGenieJson],
  eyes: [eyesBlinkJson],
  flash: [radialFlashJson],
  'eyes-flash': [radialFlashJson, eyesBlinkJson],
}

/* TGS Genie animation component */
export const Genie = ({ size = 36, className, variant = 'base' }: GenieProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const playersRef = useRef<Array<{ play: () => void; stop: () => void }>>([])
  const initializedRef = useRef(false)
  const uniqueId = useId().replace(/:/g, '')
  const playerId = `genie-${uniqueId}`

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return
    initializedRef.current = true

    const initPlayer = async () => {
      await loadPlayerRuntime()

      /* Wait for TgsPlayer to be available */
      const waitForPlayer = () => {
        if (window.TgsPlayer && containerRef.current && !playersRef.current.length) {
          const animations = variantData[variant]
          playersRef.current = animations.map((data, i) => {
            const id = `${playerId}-${i}`
            const el = document.getElementById(id)
            /* Clear any existing content to prevent duplicates */
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
      initializedRef.current = false
      /* Clear container children on unmount */
      const animations = variantData[variant]
      animations.forEach((_, i) => {
        const el = document.getElementById(`${playerId}-${i}`)
        if (el) el.innerHTML = ''
      })
    }
  }, [playerId, variant])

  const animations = variantData[variant]

  return (
    <div className={className} ref={containerRef} style={{ width: size, height: size, position: 'relative' }}>
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
