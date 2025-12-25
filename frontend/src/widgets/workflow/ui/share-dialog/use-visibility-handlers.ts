import { useCallback } from 'react'
import type { VisibilityStateValue } from '../../model/visibility-state'
import { rememberCollaborativeState } from '../../model/visibility-state'

interface UseVisibilityHandlersParams {
  currentValue: VisibilityStateValue
  onValueChange: (value: VisibilityStateValue) => void
  disabled: boolean
}

export const useVisibilityHandlers = ({ currentValue, onValueChange, disabled }: UseVisibilityHandlersParams) => {
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
      rememberCollaborativeState(true, checked)
      onValueChange(checked ? 'writeable-unlisted' : 'unlisted')
    },
    [onValueChange],
  )

  const handlePublicCollaborativeToggle = useCallback(
    (checked: boolean) => {
      rememberCollaborativeState(false, checked)
      onValueChange(checked ? 'writeable-public' : 'public')
    },
    [onValueChange],
  )

  return {
    handlePrivateClick,
    handleUnlistedClick,
    handlePublicClick,
    handleUnlistedCollaborativeToggle,
    handlePublicCollaborativeToggle,
  }
}
