import * as React from 'react'
import { cn } from '@shared/lib/utils'

interface PasswordStrengthIndicatorProps {
  password: string
  className?: string
}

type StrengthLevel = 'weak' | 'medium' | 'strong' | 'very-strong'

const calculateStrength = (password: string): { level: StrengthLevel; score: number } => {
  let score = 0

  if (!password) return { level: 'weak', score: 0 }

  // Length scoring
  if (password.length >= 7) score += 1
  if (password.length >= 10) score += 1
  if (password.length >= 14) score += 1

  // Character variety scoring
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^a-zA-Z0-9]/.test(password)) score += 1

  // Determine level
  if (score <= 2) return { level: 'weak', score }
  if (score <= 4) return { level: 'medium', score }
  if (score <= 6) return { level: 'strong', score }
  return { level: 'very-strong', score }
}

const strengthConfig = {
  weak: {
    label: 'Weak',
    color: 'bg-destructive',
    textColor: 'text-destructive',
    bars: 1,
  },
  medium: {
    label: 'Medium',
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
    bars: 2,
  },
  strong: {
    label: 'Strong',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    bars: 3,
  },
  'very-strong': {
    label: 'Very Strong',
    color: 'bg-green-500',
    textColor: 'text-green-600',
    bars: 4,
  },
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password, className }) => {
  const { level } = calculateStrength(password)
  const config = strengthConfig[level]

  if (!password) return null

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(bar => (
          <div
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              bar <= config.bars ? config.color : 'bg-muted',
            )}
            key={bar}
          />
        ))}
      </div>
      <p className={cn('text-sm font-medium', config.textColor)}>{config.label}</p>
    </div>
  )
}
