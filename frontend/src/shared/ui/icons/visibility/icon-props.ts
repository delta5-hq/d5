export interface IconProps {
  className?: string
}

export const BASE_ICON_ATTRIBUTES = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: '1.5',
  viewBox: '0 0 24 24',
  width: 16,
  height: 16,
  xmlns: 'http://www.w3.org/2000/svg',
} as const

export const ICON_OPACITY = {
  base: 0.35,
  full: 1,
} as const

export const PENCIL_OVERLAY_PROPS = {
  rotation: -45,
  rotationCenter: { x: 17, y: 17 },
  backgroundRadius: 7,
  strokeWidth: '1.5',
} as const
