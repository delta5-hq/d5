import type { NodeStore, EnrichedNodeData } from './node-store'
import type { IndentedTextParams } from './indented-text'
import { indentedText } from './indented-text'
import { referencePatterns } from './reference-patterns'
import { HASHREF_DEF_PREFIX, REF_DEF_PREFIX } from './reference-constants'
import { substituteReferences } from './substitute-references'
import { substituteHashrefs } from './substitute-hashrefs'
import { clearReferences } from './reference-utils'

function substituteAllRefs(node: EnrichedNodeData, store: NodeStore, params?: IndentedTextParams): string {
  const initialStartsWithForeach = node.title?.startsWith('/foreach') || node.command?.startsWith('/foreach') || false
  return indentedText(node, store, params)
    .map(t => {
      if (
        referencePatterns.withAssignmentPrefix().test(t.text) &&
        (initialStartsWithForeach || !t.text.startsWith('/foreach'))
      ) {
        const nodeDepth = (t.node as EnrichedNodeData & { depth?: number }).depth ?? 0
        const nodeParentDepth = (node as EnrichedNodeData & { depth?: number }).depth ?? 0
        return substituteReferences(t.text, nodeDepth - nodeParentDepth, store, [], params?.nonPromptNode ?? false)
      }
      return t.text
    })
    .join('\n')
}

function substituteAllHashrefs(node: EnrichedNodeData, store: NodeStore, params?: IndentedTextParams): string {
  const initialStartsWithForeach = node.title?.startsWith('/foreach') || node.command?.startsWith('/foreach') || false
  return indentedText(node, store, params)
    .map(t => {
      if (
        referencePatterns.withAssignmentPrefix(HASHREF_DEF_PREFIX).test(t.text) &&
        (initialStartsWithForeach || !t.text.startsWith('/foreach'))
      ) {
        const nodeDepth = (t.node as EnrichedNodeData & { depth?: number }).depth ?? 0
        const nodeParentDepth = (node as EnrichedNodeData & { depth?: number }).depth ?? 0
        return substituteHashrefs(
          t.text,
          nodeDepth - nodeParentDepth,
          store,
          t.node,
          [],
          params?.nonPromptNode ?? false,
        )
      }
      return t.text
    })
    .join('\n')
}

function buildResolveParams(overrides?: IndentedTextParams): IndentedTextParams {
  return {
    nonPromptNode: true,
    saveFirst: true,
    useCommand: true,
    ignorePostProccessCommand: true,
    ...overrides,
  }
}

export function resolveNodeReferences(
  node: EnrichedNodeData,
  store: NodeStore,
  overrides?: IndentedTextParams,
): string {
  const params = buildResolveParams(overrides)

  const atRefContent = substituteAllRefs(node, store, params)

  const proxyNode: EnrichedNodeData & { depth?: number } = {
    ...node,
    title: atRefContent,
    command: atRefContent,
    depth: (node as EnrichedNodeData & { depth?: number }).depth,
    children: [],
  }

  const hashrefContent = substituteAllHashrefs(proxyNode, store, params)

  return clearReferences(clearReferences(hashrefContent, REF_DEF_PREFIX), HASHREF_DEF_PREFIX).trim()
}
