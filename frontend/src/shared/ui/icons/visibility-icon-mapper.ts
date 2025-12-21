import type { ComponentType } from 'react'
import type { VisibilityStateValue } from '@widgets/workflow/model/visibility-state'
import type { IconProps } from './visibility/icon-props'
import { PrivateIcon, UnlistedIcon, PublicIcon, WriteableUnlistedIcon, WriteablePublicIcon } from './visibility'

type VisibilityIconMap = Record<VisibilityStateValue, ComponentType<IconProps>>

const visibilityIconMap: VisibilityIconMap = {
  private: PrivateIcon,
  unlisted: UnlistedIcon,
  public: PublicIcon,
  'writeable-unlisted': WriteableUnlistedIcon,
  'writeable-public': WriteablePublicIcon,
} as const

export const getVisibilityIcon = (state: VisibilityStateValue): ComponentType<IconProps> => visibilityIconMap[state]

export const hasVisualIcon = (state: VisibilityStateValue): boolean => state !== 'private'
