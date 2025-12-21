import React from 'react'
import type { IconProps } from './icon-props'
import { BaseIconWithPencil } from './pencil-overlay'

export const WriteablePublicIcon: React.FC<IconProps> = ({ className }) => (
  <BaseIconWithPencil className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </BaseIconWithPencil>
)
