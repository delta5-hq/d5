import React from 'react'
import { BASE_ICON_ATTRIBUTES, type IconProps } from './icon-props'

export const UnlistedIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...BASE_ICON_ATTRIBUTES} className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
