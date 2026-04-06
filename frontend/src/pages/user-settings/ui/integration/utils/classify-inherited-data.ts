import type { IntegrationSettings, MCPIntegration, RPCIntegration } from '@shared/base-types'

interface ClassifiedIntegrationData {
  editable: IntegrationSettings
  inherited: IntegrationSettings
}

/**
 * Classifies integration data into editable (current scope) and inherited (app-wide).
 *
 * Rules:
 * - If currentScope has workflowId field, it's workflow-scoped → editable
 * - If currentScope lacks workflowId field, it's app-wide (fallback) → treat as editable, no inherited
 * - Inherited items: app-wide items not overridden in workflow scope
 * - Cross-type shadowing: workflow RPC /qa hides app-wide MCP /qa
 */
export function classifyInheritedData(
  currentScope: IntegrationSettings | undefined,
  appWideScope: IntegrationSettings | undefined,
): ClassifiedIntegrationData {
  const empty: IntegrationSettings = {}

  if (!appWideScope) {
    return { editable: currentScope || empty, inherited: empty }
  }

  if (!currentScope) {
    return { editable: empty, inherited: appWideScope }
  }

  const isWorkflowScoped = 'workflowId' in currentScope && currentScope.workflowId !== null

  if (!isWorkflowScoped) {
    return { editable: currentScope, inherited: empty }
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
