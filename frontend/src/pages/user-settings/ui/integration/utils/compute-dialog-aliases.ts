import type { IntegrationSettings } from '@shared/base-types'

export interface DialogAliases {
  mcpDialogAliases: string[]
  rpcDialogAliases: string[]
}

export function computeDialogAliases(
  data: IntegrationSettings | undefined,
  inheritedData: IntegrationSettings | undefined,
): DialogAliases {
  const ownMCPAliases = (data?.mcp ?? []).map(m => m.alias)
  const ownRPCAliases = (data?.rpc ?? []).map(r => r.alias)
  const inheritedMCPAliases = (inheritedData?.mcp ?? []).map(m => m.alias)
  const inheritedRPCAliases = (inheritedData?.rpc ?? []).map(r => r.alias)

  return {
    mcpDialogAliases: [...ownMCPAliases, ...ownRPCAliases, ...inheritedRPCAliases],
    rpcDialogAliases: [...ownMCPAliases, ...ownRPCAliases, ...inheritedMCPAliases],
  }
}
