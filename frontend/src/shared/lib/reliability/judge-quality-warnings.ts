import type { IntegrationSettings, JudgeQualityWarning } from '@shared/base-types'
import type { NodeData, NodeId } from '@shared/base-types'
import { isValidElectCell } from './elect-params'
import { VALIDATE_QUERY } from '@shared/lib/commands/command-constants'

type LLMProviderKey = 'openai' | 'claude' | 'deepseek' | 'qwen' | 'yandex' | 'custom_llm'

const HIGHER_TIER_PROVIDERS: readonly LLMProviderKey[] = ['openai', 'claude', 'deepseek', 'qwen']
const LOWER_TIER_PROVIDERS: readonly LLMProviderKey[] = ['yandex', 'custom_llm']
const ALL_LLM_PROVIDERS: readonly LLMProviderKey[] = [...HIGHER_TIER_PROVIDERS, ...LOWER_TIER_PROVIDERS]
const REASONING_CAPABLE_PROVIDERS: readonly LLMProviderKey[] = ['openai', 'claude']

function isProviderConfigured(settings: IntegrationSettings, key: LLMProviderKey): boolean {
  const p = settings[key] as { apiKey?: string; apiRootUrl?: string } | undefined
  return Boolean(p?.apiKey?.trim() || p?.apiRootUrl?.trim())
}

export function getConfiguredFamilyCount(settings: IntegrationSettings | undefined): number {
  if (!settings) return 0
  return ALL_LLM_PROVIDERS.filter(key => isProviderConfigured(settings, key)).length
}

function hasOnlyLowestTierFamilies(settings: IntegrationSettings | undefined): boolean {
  if (!settings) return false
  const hasAny = ALL_LLM_PROVIDERS.some(key => isProviderConfigured(settings, key))
  const hasHigherTier = HIGHER_TIER_PROVIDERS.some(key => isProviderConfigured(settings, key))
  return hasAny && !hasHigherTier
}

function hasReasoningCapableProvider(settings: IntegrationSettings | undefined): boolean {
  if (!settings) return false
  return REASONING_CAPABLE_PROVIDERS.some(key => isProviderConfigured(settings, key))
}

function readValidateN(command: string | undefined): number | null {
  if (!command?.startsWith(VALIDATE_QUERY)) return null
  const match = command.match(/:n=(\d+)/)
  if (!match) return null
  const n = parseInt(match[1], 10)
  return n >= 2 ? n : null
}

export function computePreExecuteWarnings(
  nodeCommand: string | undefined,
  nodeId: NodeId,
  nodes: Record<NodeId, NodeData>,
  settings: IntegrationSettings | undefined,
): JudgeQualityWarning[] {
  if (!nodeCommand) return []

  const isElect = isValidElectCell(nodeCommand)
  const isValidate = nodeCommand.startsWith(VALIDATE_QUERY)
  if (!isElect && !isValidate) return []

  const familyCount = getConfiguredFamilyCount(settings)
  const warnings: JudgeQualityWarning[] = []

  if (isElect) {
    if (familyCount <= 1) {
      warnings.push({ condition: 'singleProvider', severity: 'high' })
    } else if (hasOnlyLowestTierFamilies(settings)) {
      warnings.push({ condition: 'lowestTierOnly', severity: 'medium' })
    }

    if (familyCount > 0 && !hasReasoningCapableProvider(settings)) {
      warnings.push({ condition: 'noReasoningMode', severity: 'medium' })
    }

    const hasFallback = /\bfallback\b/.test(nodeCommand)
    if (hasFallback && (familyCount <= 1 || hasOnlyLowestTierFamilies(settings))) {
      warnings.push({ condition: 'fallbackWithWeakJudge', severity: 'high' })
    }

    const node = nodes[nodeId]
    const parentId = node?.parent
    const parentNode = parentId ? nodes[parentId] : undefined
    if (parentNode && familyCount > 0) {
      for (const siblingId of parentNode.children ?? []) {
        if (siblingId === nodeId) continue
        const sibling = nodes[siblingId]
        const validateN = readValidateN(sibling?.command)
        if (validateN !== null && validateN > familyCount) {
          if (!warnings.some(w => w.condition === 'juryDuplicates')) {
            warnings.push({ condition: 'juryDuplicates', severity: 'medium' })
          }
        }
      }
    }
  }

  if (isValidate) {
    const validateN = readValidateN(nodeCommand)
    if (validateN !== null && familyCount > 0 && validateN > familyCount) {
      warnings.push({ condition: 'juryDuplicates', severity: 'medium' })
    }
  }

  return warnings
}
