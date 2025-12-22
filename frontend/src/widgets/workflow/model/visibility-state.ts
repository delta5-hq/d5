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
    rememberCollaborativeState(!!share.hidden, true)
  }

  if (share.writeable) {
    return {
      value: share.hidden ? 'writeable-unlisted' : 'writeable-public',
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
      const shouldBeWriteable = getCollaborativeMemory(true)
      return { enabled: true, hidden: true, writeable: shouldBeWriteable }
    }

    case 'public': {
      const shouldBeWriteable = getCollaborativeMemory(false)
      return { enabled: true, hidden: false, writeable: shouldBeWriteable }
    }

    case 'writeable-unlisted':
      rememberCollaborativeState(true, true)
      return { enabled: true, hidden: true, writeable: true }

    case 'writeable-public':
      rememberCollaborativeState(false, true)
      return { enabled: true, hidden: false, writeable: true }

    default:
      return { enabled: false, hidden: false, writeable: false }
  }
}
