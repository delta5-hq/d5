import type { NodeData } from '@shared/base-types'
import { getCommandRole } from '@shared/constants/command-roles'
import { extractQueryTypeFromCommand, type DynamicAlias } from '@shared/lib/command-querytype-mapper'
import { matchesAnyCommandWithOrder } from '@shared/lib/command-validation/command-matcher'
import type { GenieVariant } from '@shared/ui/genie'
import { getColorForRole } from '@shared/ui/genie/role-colors'

interface NodeGeniePresenterOptions {
  aliases?: DynamicAlias[]
  depth?: number
}

export interface NodeGeniePresentation {
  color: string
  showHandRibs: boolean
  variant: GenieVariant
}

const MUTED_GENIE_COLOR = 'var(--muted-foreground)'

export function getNodeGeniePresentation(
  node: Pick<NodeData, 'command'> | undefined,
  options: NodeGeniePresenterOptions = {},
): NodeGeniePresentation {
  const command = node?.command?.trim()
  // Only a parsable, executable command earns the full presentation (command genie,
  // command pill, thought tail). Non-command text (e.g. plain text duplicated from
  // the title, or an unparsable command) renders as clipboard.
  const hasCommand = matchesAnyCommandWithOrder(command, options.aliases ?? [])

  return {
    color: hasCommand
      ? getColorForRole(getCommandRole(extractQueryTypeFromCommand(command, options.aliases ?? [])))
      : MUTED_GENIE_COLOR,
    showHandRibs: hasCommand && options.depth !== undefined && options.depth <= 2,
    variant: hasCommand ? 'full' : 'clipboard',
  }
}
