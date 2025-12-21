import type { VisibilityStateValue } from '@widgets/workflow/model/visibility-state'

type VisibilityTooltipMap = Record<VisibilityStateValue, string>

const tooltipKeyMap: VisibilityTooltipMap = {
  private: 'tabPrivate',
  unlisted: 'tabPublicUnlisted',
  public: 'tabPublic',
  'writeable-unlisted': 'collaborativeEditing',
  'writeable-public': 'collaborativeEditing',
} as const

export const getVisibilityTooltipKey = (state: VisibilityStateValue): string => tooltipKeyMap[state]
