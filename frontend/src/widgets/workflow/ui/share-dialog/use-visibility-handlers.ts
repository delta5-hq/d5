import { useCallback } from 'react'
import type { VisibilityStateValue } from '../../model/visibility-state'
import { rememberCollaborativeState } from '../../model/visibility-state'

interface UseVisibilityHandlersParams {
  currentValue: VisibilityStateValue
  onValueChange: (value: VisibilityStateValue) => void
  disabled: boolean
  canUseCollaborative: boolean
}

export const useVisibilityHandlers = ({
  currentValue,
  onValueChange,
  disabled,
  canUseCollaborative,
}: UseVisibilityHandlersParams) => {
  const handlePrivateClick = useCallback(() => {
    if (disabled) return
    onValueChange('private')
  }, [disabled, onValueChange])

  const handleUnlistedClick = useCallback(() => {
    if (disabled) return
    const isAlreadyUnlisted = currentValue === 'unlisted' || currentValue === 'writeable-unlisted'
    if (!isAlreadyUnlisted) {
      onValueChange('unlisted')
    }
  }, [disabled, currentValue, onValueChange])

  const handlePublicClick = useCallback(() => {
    if (disabled) return
    const isAlreadyPublic = currentValue === 'public' || currentValue === 'writeable-public'
    if (!isAlreadyPublic) {
      onValueChange('public')
    }
  }, [disabled, currentValue, onValueChange])

  const handleUnlistedCollaborativeToggle = useCallback(
    (checked: boolean) => {
      if (!canUseCollaborative) return
      rememberCollaborativeState(true, checked)
      onValueChange(checked ? 'writeable-unlisted' : 'unlisted')
    },
    [canUseCollaborative, onValueChange],
  )

  const handlePublicCollaborativeToggle = useCallback(
    (checked: boolean) => {
      if (!canUseCollaborative) return
      rememberCollaborativeState(false, checked)
      onValueChange(checked ? 'writeable-public' : 'public')
    },
    [canUseCollaborative, onValueChange],
  )

  return {
    handlePrivateClick,
    handleUnlistedClick,
    handlePublicClick,
    handleUnlistedCollaborativeToggle,
    handlePublicCollaborativeToggle,
  }
}
