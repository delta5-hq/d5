import React from 'react'
import { ICON_OPACITY, PENCIL_OVERLAY_PROPS } from './icon-props'

interface PencilOverlayProps {
  backgroundColor?: string
}

export const PencilOverlay: React.FC<PencilOverlayProps> = ({ backgroundColor = 'var(--background, white)' }) => (
  <g
    transform={`rotate(${PENCIL_OVERLAY_PROPS.rotation} ${PENCIL_OVERLAY_PROPS.rotationCenter.x} ${PENCIL_OVERLAY_PROPS.rotationCenter.y})`}
  >
    <circle
      cx={PENCIL_OVERLAY_PROPS.rotationCenter.x}
      cy={PENCIL_OVERLAY_PROPS.rotationCenter.y}
      fill={backgroundColor}
      r={PENCIL_OVERLAY_PROPS.backgroundRadius}
      stroke="none"
    />

    <rect
      fill="none"
      height="8"
      rx="0.5"
      stroke="currentColor"
      strokeWidth={PENCIL_OVERLAY_PROPS.strokeWidth}
      width="4"
      x="15"
      y="11"
    />

    <path d="M15 19 L17 22 L19 19 Z" fill="none" stroke="currentColor" strokeWidth={PENCIL_OVERLAY_PROPS.strokeWidth} />

    <line stroke="currentColor" strokeWidth={PENCIL_OVERLAY_PROPS.strokeWidth} x1="15" x2="19" y1="12.5" y2="12.5" />
  </g>
)

interface BaseIconWithPencilProps {
  className?: string
  children: React.ReactNode
}

export const BaseIconWithPencil: React.FC<BaseIconWithPencilProps> = ({ className, children }) => (
  <svg
    className={className}
    fill="none"
    height="16"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g opacity={ICON_OPACITY.base} strokeWidth="1.5">
      {children}
    </g>
    <PencilOverlay />
  </svg>
)
