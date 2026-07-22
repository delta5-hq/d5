import type { IntegrationSettings, MCPIntegration, RPCIntegration } from '@shared/base-types'

interface ClassifiedIntegrationData {
  editable: IntegrationSettings
  inherited: IntegrationSettings
}

export function classifyInheritedData(
  currentScope: IntegrationSettings | undefined,
  appWideScope: IntegrationSettings | undefined,
  selectedWorkflowId?: string | null,
): ClassifiedIntegrationData {
  const empty: IntegrationSettings = {}

  if (!appWideScope) {
    return { editable: currentScope || empty, inherited: empty }
  }

  if (!currentScope) {
    return { editable: empty, inherited: appWideScope }
  }

  const hasWorkflowInResponse = 'workflowId' in currentScope && currentScope.workflowId !== null
  const isInWorkflowView = selectedWorkflowId !== null && selectedWorkflowId !== undefined

  if (!isInWorkflowView && !hasWorkflowInResponse) {
    return { editable: currentScope, inherited: empty }
  }

  if (isInWorkflowView && !hasWorkflowInResponse) {
    // Fallback: API returned app-wide data because no workflow-specific doc exists yet.
    return { editable: empty, inherited: appWideScope }
  }

  const workflowAliases = new Set<string>([
    ...(currentScope.mcp || []).map(m => m.alias),
    ...(currentScope.rpc || []).map(r => r.alias),
  ])

  const inheritedMCP = filterInheritedArrayItems(appWideScope.mcp, workflowAliases)
  const inheritedRPC = filterInheritedArrayItems(appWideScope.rpc, workflowAliases)

  const inherited: IntegrationSettings = {
    mcp: inheritedMCP,
    rpc: inheritedRPC,
  }

  if (appWideScope.openai && !currentScope.openai) inherited.openai = appWideScope.openai
  if (appWideScope.claude && !currentScope.claude) inherited.claude = appWideScope.claude
  if (appWideScope.yandex && !currentScope.yandex) inherited.yandex = appWideScope.yandex
  if (appWideScope.qwen && !currentScope.qwen) inherited.qwen = appWideScope.qwen
  if (appWideScope.deepseek && !currentScope.deepseek) inherited.deepseek = appWideScope.deepseek
  if (appWideScope.perplexity && !currentScope.perplexity) inherited.perplexity = appWideScope.perplexity
  if (appWideScope.custom_llm && !currentScope.custom_llm) inherited.custom_llm = appWideScope.custom_llm
  if (appWideScope.google && !currentScope.google) inherited.google = appWideScope.google

  return {
    editable: currentScope,
    inherited,
  }
}

function filterInheritedArrayItems<T extends MCPIntegration | RPCIntegration>(
  appWideItems: T[] | undefined,
  workflowAliases: Set<string>,
): T[] {
  if (!appWideItems) return []
  return appWideItems.filter(item => !workflowAliases.has(item.alias))
}
