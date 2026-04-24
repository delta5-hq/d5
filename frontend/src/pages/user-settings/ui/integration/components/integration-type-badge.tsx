import * as React from 'react'
import { Badge } from '@shared/ui/badge'

interface IntegrationTypeBadgeProps {
  type: string
  className?: string
}

const BADGE_VARIANT_MAP: Record<string, 'default' | 'secondary' | 'outline'> = {
  stdio: 'default',
  'streamable-http': 'secondary',
  ssh: 'default',
  http: 'secondary',
  'acp-local': 'outline',
}

const BADGE_LABEL_MAP: Record<string, string> = {
  stdio: 'STDIO',
  'streamable-http': 'HTTP',
  ssh: 'SSH',
  http: 'HTTP',
  'acp-local': 'ACP',
}

export const IntegrationTypeBadge: React.FC<IntegrationTypeBadgeProps> = ({ type, className }) => {
  const variant = BADGE_VARIANT_MAP[type] || 'default'
  const label = BADGE_LABEL_MAP[type] || type.toUpperCase()

  return (
    <Badge className={className} variant={variant}>
      {label}
    </Badge>
  )
}
