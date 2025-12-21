import React from 'react'
import { BASE_ICON_ATTRIBUTES, type IconProps } from './icon-props'

export const PublicIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...BASE_ICON_ATTRIBUTES} className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
)
