import type { NodeData } from '@/shared/base-types/workflow'
import type { DynamicAlias } from '@shared/lib/command-querytype-mapper'
import { extractQueryTypeFromCommand } from '@shared/lib/command-querytype-mapper'
import { getCommandRole } from '@shared/constants/command-roles'
import { getColorForRole } from '@shared/ui/genie/role-colors'
import { Genie } from '@shared/ui/genie'
import { normalizeNodeTitle } from '@entities/workflow/lib'
import { CommandChip } from './command-node-chip'

interface NodeDropGhostProps {
  node: NodeData
  aliases: DynamicAlias[]
}

/* Semi-transparent ghost of the dragged node, shown at an inside drop location.
   Presentational only: no interaction, no live state, decorative aria-hidden. */
export const NodeDropGhost = ({ node, aliases }: NodeDropGhostProps) => {
  const command = node.command?.trim()
  const hasCommand = Boolean(command)
  const title = normalizeNodeTitle(node.title)
  const color = command
    ? getColorForRole(getCommandRole(extractQueryTypeFromCommand(command, aliases)))
    : 'var(--muted-foreground)'

  return (
    <div aria-hidden="true" className="workflow-tree-ghost-node" data-testid="drag-ghost-node">
      <Genie color={color} size={28} state="idle" variant={hasCommand ? 'clipboard-eyes' : 'clipboard'} />
      <CommandChip aliases={aliases} command={node.command} />
      <span className="workflow-tree-ghost-title">{title}</span>
    </div>
  )
}
