import type { NodeId } from '@shared/base-types'
import type { EnrichedNodeData } from './node-store'
import { REF_DEF_PREFIX } from './reference-constants'
import { referencePatterns } from './reference-patterns'

export function clearReferences(str: string, prefix = REF_DEF_PREFIX): string {
  return str.replace(referencePatterns.withAssignmentPrefix(prefix), '')
}

export function getReferences(
  value: string | undefined,
  prefix = REF_DEF_PREFIX,
  postfixes: string | string[] = '',
): string[] {
  if (typeof value !== 'string') return []
  return Array.from(value.matchAll(referencePatterns.withPrefixAndPostfixs(prefix, postfixes))).map(m => m[0])
}

export function findInNodeArray(
  nodes: EnrichedNodeData[],
  checkCommandFirst: boolean,
  titleOrCommandPredicate: (text: string | null | undefined) => boolean,
  commandPredicate?: (text: string | null | undefined) => boolean,
): EnrichedNodeData | undefined {
  const cmdPred = commandPredicate ?? titleOrCommandPredicate

  if (checkCommandFirst) {
    const withCommand = nodes.find(n => cmdPred(n.command))
    return withCommand ?? nodes.find(n => titleOrCommandPredicate(n.title))
  }

  const withTitle = nodes.find(n => titleOrCommandPredicate(n.title))
  return withTitle ?? nodes.find(n => cmdPred(n.command))
}

export function findInNodeMap(
  nodeMap: Record<NodeId, EnrichedNodeData>,
  checkCommandFirst: boolean,
  titleOrCommandPredicate: (text: string | null | undefined) => boolean,
  commandPredicate?: (text: string | null | undefined) => boolean,
): EnrichedNodeData | undefined {
  return findInNodeArray(Object.values(nodeMap), checkCommandFirst, titleOrCommandPredicate, commandPredicate)
}

export function findAllInNodeArray(
  nodes: EnrichedNodeData[],
  checkCommandFirst: boolean,
  titleOrCommandPredicate: (text: string | null | undefined) => boolean,
  commandPredicate?: (text: string | null | undefined) => boolean,
): EnrichedNodeData[] {
  const cmdPred = commandPredicate ?? titleOrCommandPredicate
  return nodes.filter(n =>
    checkCommandFirst
      ? cmdPred(n.command) || titleOrCommandPredicate(n.title)
      : titleOrCommandPredicate(n.title) || cmdPred(n.command),
  )
}

export function findAllSiblingsMatch(
  firstNode: EnrichedNodeData,
  nodeMap: Record<NodeId, EnrichedNodeData>,
  checkCommandFirst: boolean,
  titleOrCommandGetter: (text: string | null | undefined) => boolean,
  commandGetter?: (text: string | null | undefined) => boolean,
  nodeFilter?: (n: EnrichedNodeData) => boolean,
): EnrichedNodeData[] {
  const visited = new Set<string>()
  let currentNode: EnrichedNodeData | undefined = firstNode

  while (currentNode?.parent && nodeMap[currentNode.parent]) {
    const parentNode: EnrichedNodeData = nodeMap[currentNode.parent]
    currentNode = parentNode

    const siblings: EnrichedNodeData[] = (parentNode.children ?? [])
      .map((id: string) => nodeMap[id])
      .filter((n: EnrichedNodeData | undefined): n is EnrichedNodeData => Boolean(n))
      .filter((n: EnrichedNodeData) => !visited.has(n.id))
      .filter(
        (n: EnrichedNodeData, i: number, arr: EnrichedNodeData[]) =>
          arr.findIndex((m: EnrichedNodeData) => m.id === n.id) === i,
      )

    if (!siblings.length) continue

    const matches = findAllInNodeArray(siblings, checkCommandFirst, titleOrCommandGetter, commandGetter)
    if (matches.length > 0) return matches

    const subQueue = [...siblings]
    const childMatches: EnrichedNodeData[] = []

    while (subQueue.length > 0) {
      const node = subQueue.shift()!
      if (visited.has(node.id)) continue
      visited.add(node.id)

      let childNodes = (node.children ?? []).map(id => nodeMap[id]).filter((n): n is EnrichedNodeData => Boolean(n))
      if (nodeFilter) childNodes = childNodes.filter(nodeFilter)

      subQueue.unshift(...childNodes)
      childMatches.push(...findAllInNodeArray(childNodes, checkCommandFirst, titleOrCommandGetter, commandGetter))
    }

    if (childMatches.length) return childMatches
  }

  return []
}
