import { useEffect, useRef, useId, useImperativeHandle, forwardRef, useMemo, type CSSProperties } from 'react'
import radialFlashJson from '@shared/assets/genie/radial-flash.json'
import { playerCache, RADIAL_FLASH_PREFIX } from '@shared/lib/player-cache'
import type { TgsPlayerInstance } from './types'
import { loadPlayerRuntime } from './player-runtime'

export interface RadialFlashRef {
  flash: () => void
}

export interface RadialFlashProps {
  size?: number
  className?: string
  flashColor?: string
  nodeId?: string
}

function hexToRgba(hex: string): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255, 1]
  }
  return [1, 0, 1, 1]
}

function replaceFlashColor(json: unknown, newColor: string): unknown {
  const rgba = hexToRgba(newColor)
  const str = JSON.stringify(json)
  const replaced = str.replace(/"k":\s*\[\s*0\s*,\s*0\.7\s*,\s*1\s*,\s*1\s*\]/g, `"k":${JSON.stringify(rgba)}`)
  return JSON.parse(replaced)
}

/* Cleanup player from cache when node is permanently removed */
export function cleanupPlayerCache(nodeId: string): void {
  const playerId = `${RADIAL_FLASH_PREFIX}${nodeId}`
  playerCache.delete(playerId)
}

/* Clear entire player cache (e.g., on route change) */
export function clearPlayerCache(): void {
  playerCache.clear()
}

export const RadialFlash = forwardRef<RadialFlashRef, RadialFlashProps>(
  ({ size = 128, className, flashColor = '#ff00ff', nodeId }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<TgsPlayerInstance | null>(null)
    const initializedRef = useRef(false)
    const fallbackId = useId().replace(/:/g, '')
    const playerId = nodeId ? `${RADIAL_FLASH_PREFIX}${nodeId}` : `${RADIAL_FLASH_PREFIX}${fallbackId}`
    const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const flashJson = useMemo(() => replaceFlashColor(radialFlashJson, flashColor), [flashColor])

    useImperativeHandle(ref, () => ({
      flash: () => {
        if (playerRef.current) {
          if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current)
          }
          playerRef.current.stop()
          playerRef.current.play()
          const duration = (playerRef.current.totalFrames / playerRef.current.frameRate) * 1000
          stopTimerRef.current = setTimeout(() => {
            playerRef.current?.pause()
          }, duration)
        }
      },
    }))

    useEffect(() => {
      if (!containerRef.current || initializedRef.current) return
      initializedRef.current = true
      let cancelled = false

      const initPlayer = async () => {
        const loaded = await loadPlayerRuntime()
        if (cancelled || !loaded || !window.TgsPlayer || !containerRef.current || playerRef.current) return

        const cachedPlayer = playerCache.get(playerId)
        if (cachedPlayer) {
          playerRef.current = cachedPlayer
          return
        }

        const el = document.getElementById(playerId)
        if (el) el.innerHTML = ''
        playerRef.current = new window.TgsPlayer(flashJson, playerId)
        playerCache.set(playerId, playerRef.current)
      }

      initPlayer()

      return () => {
        cancelled = true
        if (stopTimerRef.current) {
          clearTimeout(stopTimerRef.current)
        }
        playerRef.current?.stop()
        playerRef.current = null
        initializedRef.current = false
      }
    }, [playerId, flashJson, flashColor])

    return (
      <div
        className={className}
        ref={containerRef}
        style={
          {
            width: size,
            height: size,
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            '--genie-flash-color': flashColor,
          } as CSSProperties
        }
      >
        <div
          id={playerId}
          style={{
            width: size,
            height: size,
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      </div>
    )
  },
)

RadialFlash.displayName = 'RadialFlash'
