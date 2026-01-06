import * as React from 'react'
import { useState } from 'react'
import { cn } from '@shared/lib/utils'

interface PasswordInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  error?: boolean
  errorHelper?: string | React.ReactNode
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, error, errorHelper, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)

    const togglePassword = () => {
      setShowPassword(!showPassword)
    }

    return (
      <div>
        <div className="relative">
          <input
            {...props}
            className={cn(
              'file:text-foreground placeholder:text-muted-foreground bg-input selection:bg-primary selection:text-primary-foreground dark:bg-input border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              error && 'ring-destructive/20 dark:ring-destructive/40 border-destructive',
              'pr-20',
              className,
            )}
            data-slot="input"
            ref={ref}
            type={showPassword ? 'text' : 'password'}
          />
          <button
            aria-label={showPassword ? 'Conceal text' : 'Reveal text'}
            className="absolute top-0 right-0 h-full px-3 text-sm font-light text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none"
            onClick={togglePassword}
            tabIndex={-1}
            type="button"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && errorHelper ? <p className="text-destructive text-sm">{errorHelper}</p> : null}
      </div>
    )
  },
)

PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
