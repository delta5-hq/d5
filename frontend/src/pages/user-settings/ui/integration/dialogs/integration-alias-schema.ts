import { z } from 'zod'

import { COMMAND_TO_QUERYTYPE_MAP } from '@/shared/lib/command-querytype-mapper'

export const legacyReservedIntegrationAliases = ['/completion', '/yandex'] as const

export const reservedIntegrationAliases = new Set([
  ...Object.keys(COMMAND_TO_QUERYTYPE_MAP),
  ...legacyReservedIntegrationAliases,
])

export const integrationAliasSchema = z
  .string()
  .regex(/^\/[a-zA-Z][a-zA-Z0-9_-]*$/, 'Alias must start with / followed by letters, numbers, underscores, or hyphens')
  .refine(alias => !reservedIntegrationAliases.has(alias.toLowerCase()), 'Built-in command aliases are reserved')
