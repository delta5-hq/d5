import type { CommandRole } from '@shared/constants/command-roles'

export const ROLE_COLORS: Record<CommandRole, string> = {
  llm: '#ffa726',
  search: '#42a5f5',
  transform: '#66bb6a',
  control: '#ab47bc',
  utility: '#9e9e9e',
}

export const DEFAULT_COLOR = '#9e9e9e'

export function getColorForRole(role: CommandRole | undefined): string {
  if (!role) return DEFAULT_COLOR
  return ROLE_COLORS[role] ?? DEFAULT_COLOR
}
