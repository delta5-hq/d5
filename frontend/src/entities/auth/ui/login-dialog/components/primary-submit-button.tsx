import type { ReactNode } from 'react'
import { Button } from '@shared/ui/button'
import { Spinner } from '@shared/ui/spinner'
import { cn } from '@shared/lib/utils'
import { getButtonHoverAnimation, getLoadingTextAnimation, getTextTransition } from '@shared/lib/animation'

interface PrimarySubmitButtonProps {
  disabled?: boolean
  isLoading?: boolean
  children: ReactNode
  testId?: string
}

export const PrimarySubmitButton = ({ disabled, isLoading, children, testId }: PrimarySubmitButtonProps) => (
  <Button
    className={cn('w-full h-12 min-h-[44px] text-base font-medium', getButtonHoverAnimation())}
    data-testid={testId}
    data-type="confirm-login"
    disabled={disabled || isLoading}
    type="submit"
    variant="accent"
  >
    {isLoading ? (
      <>
        <Spinner className="mr-2 h-4 w-4" />
        <span className={getLoadingTextAnimation()}>{children}</span>
      </>
    ) : (
      <span className={getTextTransition()}>{children}</span>
    )}
  </Button>
)
