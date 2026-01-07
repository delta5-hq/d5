import type { ReactNode } from 'react'
import { Button } from '@shared/ui/button'
import { Spinner } from '@shared/ui/spinner'

interface PrimarySubmitButtonProps {
  disabled?: boolean
  isLoading?: boolean
  children: ReactNode
  testId?: string
}

export const PrimarySubmitButton = ({ disabled, isLoading, children, testId }: PrimarySubmitButtonProps) => (
  <Button
    className="w-full h-12 min-h-[44px] text-base font-medium"
    data-testid={testId}
    data-type="confirm-login"
    disabled={disabled || isLoading}
    type="submit"
    variant="accent"
  >
    {isLoading ? (
      <>
        <Spinner className="mr-2 h-4 w-4" />
        {children}
      </>
    ) : (
      children
    )}
  </Button>
)
