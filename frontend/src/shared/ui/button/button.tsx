import React from 'react'
import styles from './button.module.scss'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@shared/lib/utils'

const Button = ({
  className,
  variant = 'accent',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & {
  variant?: 'accent' | 'warning' | 'danger' | 'default' | 'info' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean
}) => {
  const Comp = asChild ? Slot : 'button'

  return <Comp {...props} className={cn(styles.button, className)} data-size={size} data-variant={variant} />
}

export { Button }
