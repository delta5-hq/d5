import type { PublicShare } from '@shared/base-types'

export type VisibilityStateValue = 'private' | 'unlisted' | 'public' | 'writeable-unlisted' | 'writeable-public'

export interface VisibilityState {
  value: VisibilityStateValue
  isPublic: boolean
  isHidden: boolean
  isWriteable: boolean
}

const collaborativeMemory: {
  unlisted: boolean
  public: boolean
} = {
  unlisted: false,
  public: false,
}

export const rememberCollaborativeState = (isHidden: boolean, isWriteable: boolean) => {
  if (isHidden) {
    collaborativeMemory.unlisted = isWriteable
  } else {
    collaborativeMemory.public = isWriteable
  }
}

export const getCollaborativeMemory = (targetHidden: boolean): boolean =>
  targetHidden ? collaborativeMemory.unlisted : collaborativeMemory.public

export const visibilityStateFromShare = (share: PublicShare | undefined): VisibilityState => {
  if (!share?.enabled) {
    return {
      value: 'private',
      isPublic: false,
      isHidden: false,
      isWriteable: false,
    }
  }

  if (share.writeable) {
    const value = share.hidden ? 'writeable-unlisted' : 'writeable-public'
    return {
      value,
      isPublic: true,
      isHidden: !!share.hidden,
      isWriteable: true,
    }
  }

  if (share.hidden) {
    return {
      value: 'unlisted',
      isPublic: true,
      isHidden: true,
      isWriteable: false,
    }
  }

  return {
    value: 'public',
    isPublic: true,
    isHidden: false,
    isWriteable: false,
  }
}

export const visibilityStateToShare = (value: VisibilityStateValue): PublicShare => {
  switch (value) {
    case 'private':
      return { enabled: false, hidden: false, writeable: false }

    case 'unlisted': {
      const writeable = getCollaborativeMemory(true)
      return { enabled: true, hidden: true, writeable }
    }

    case 'public': {
      const writeable = getCollaborativeMemory(false)
      return { enabled: true, hidden: false, writeable }
    }

    case 'writeable-unlisted':
      return { enabled: true, hidden: true, writeable: true }

    case 'writeable-public':
      return { enabled: true, hidden: false, writeable: true }

    default:
      return { enabled: false, hidden: false, writeable: false }
  }
}

export const mapCompositeToBaseValue = (value: VisibilityStateValue): VisibilityStateValue => {
  if (value === 'writeable-unlisted') return 'unlisted'
  if (value === 'writeable-public') return 'public'
  return value
}

export interface VisibilityDisplayState {
  isPrivate: boolean
  isUnlisted: boolean
  isPublic: boolean
  isUnlistedCollaborative: boolean
  isPublicCollaborative: boolean
  radioValue: VisibilityStateValue
}

export const deriveVisibilityDisplayState = (value: VisibilityStateValue): VisibilityDisplayState => ({
  isPrivate: value === 'private',
  isUnlisted: value === 'unlisted' || value === 'writeable-unlisted',
  isPublic: value === 'public' || value === 'writeable-public',
  isUnlistedCollaborative: value === 'writeable-unlisted',
  isPublicCollaborative: value === 'writeable-public',
  radioValue: mapCompositeToBaseValue(value),
})
