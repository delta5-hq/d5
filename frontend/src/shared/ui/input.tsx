import * as React from 'react'

import { cn } from '@shared/lib/utils'

interface InputProps extends React.ComponentProps<'input'> {
  error?: boolean
  errorHelper?: string | React.ReactNode
}

const Input = ({ className, type, error, errorHelper, ...props }: InputProps) => (
  <div>
    <input
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        error && 'ring-destructive/20 dark:ring-destructive/40 border-destructive',
        className,
      )}
      data-slot="input"
      type={type}
      {...props}
    />

    {error && errorHelper ? <p className="text-destructive text-sm">{errorHelper}</p> : null}
  </div>
)

export { Input }
