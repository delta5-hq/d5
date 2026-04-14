import React, { createContext, useContext, useMemo } from 'react'
import type { DynamicAlias } from '@shared/lib/command-querytype-mapper'
import type { IntegrationSettings } from '@shared/base-types'
import { useApiQuery } from '@shared/composables'
import { queryKeys } from '@shared/config'

interface AliasContextValue {
  aliases: DynamicAlias[]
  isLoading: boolean
}

const AliasContext = createContext<AliasContextValue | undefined>(undefined)

interface AliasProviderProps {
  children: React.ReactNode
}

export const AliasProvider: React.FC<AliasProviderProps> = ({ children }) => {
  const { data: integration, isLoading } = useApiQuery<IntegrationSettings>({
    queryKey: queryKeys.integration,
    url: '/integration',
    staleTime: 5 * 60 * 1000,
  })

  const aliases = useMemo((): DynamicAlias[] => {
    const result: DynamicAlias[] = []

    if (integration?.mcp) {
      integration.mcp.forEach(mcp => {
        if (mcp.alias) {
          result.push({
            alias: mcp.alias,
            queryType: `mcp:${mcp.alias.replace(/^\//, '')}`,
          })
        }
      })
    }

    if (integration?.rpc) {
      integration.rpc.forEach(rpc => {
        if (rpc.alias) {
          result.push({
            alias: rpc.alias,
            queryType: `rpc:${rpc.alias.replace(/^\//, '')}`,
          })
        }
      })
    }

    return result
  }, [integration])

  const value = useMemo(() => ({ aliases, isLoading }), [aliases, isLoading])

  return <AliasContext.Provider value={value}>{children}</AliasContext.Provider>
}

export const useAliases = (): AliasContextValue => {
  const context = useContext(AliasContext)
  if (context === undefined) {
    throw new Error('useAliases must be used within an AliasProvider')
  }
  return context
}
