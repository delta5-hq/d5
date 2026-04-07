import { forwardRef, useImperativeHandle, useRef } from 'react'
import { GenieLottie } from './genie'
import { Clipboard } from './clipboard'
import { Hands } from './hands'
import { RadialFlash, type RadialFlashRef } from './radial-flash'
import './genie-reading.css'

export type GenieState = 'idle' | 'busy' | 'busy-alert' | 'done-success' | 'done-failure'
export type GenieVariant = 'full' | 'clipboard'

export interface GenieRef {
  flash: () => void
}

export interface GenieProps {
  size?: number
  className?: string
  state?: GenieState
  clipboardFill?: string
  clipboardEdge?: string
  color?: string
  showHandRibs?: boolean
  flashColor?: string
  nodeId?: string
  variant?: GenieVariant
}

const stateToEyeColor: Record<GenieState, string> = {
  idle: '#4a90e2',
  busy: '#ff9800',
  'busy-alert': '#ff9800',
  'done-success': '#4caf50',
  'done-failure': '#f44336',
}

export const Genie = forwardRef<GenieRef, GenieProps>(
  (
    {
      size = 128,
      className,
      state = 'idle',
      clipboardFill = '#ffffff',
      clipboardEdge = '#424242',
      color = '#ffa726',
      showHandRibs = false,
      flashColor,
      nodeId,
      variant = 'full',
    },
    ref,
  ) => {
    const flashRef = useRef<RadialFlashRef>(null)
    const eyeColor = stateToEyeColor[state]
    const isBusy = state === 'busy' || state === 'busy-alert'
    const showBackFlash = state === 'busy-alert'
    const eyesOffset = -size * 0.11
    const isClipboardOnly = variant === 'clipboard'

    useImperativeHandle(ref, () => ({
      flash: () => {
        if (isClipboardOnly) return
        flashRef.current?.flash()
      },
    }))

    return (
      <div className={className} style={{ position: 'relative', width: size, height: size }}>
        {isClipboardOnly ? null : (
          <div
            className={isBusy ? 'genie-reading' : undefined}
            style={{ position: 'absolute', top: eyesOffset, left: 0 }}
          >
            <GenieLottie eyeColor={eyeColor} size={size} variant={showBackFlash ? 'eyes-flash' : 'eyes'} />
          </div>
        )}
        <Clipboard edgeColor={clipboardEdge} fillColor={clipboardFill} size={size} />
        {isClipboardOnly ? null : <Hands fillColor={color} showRibs={showHandRibs} size={size} />}
        {isClipboardOnly ? null : <RadialFlash flashColor={flashColor} nodeId={nodeId} ref={flashRef} size={size} />}
      </div>
    )
  },
)

Genie.displayName = 'Genie'
