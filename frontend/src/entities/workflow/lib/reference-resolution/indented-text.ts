import type { NodeId } from '@shared/base-types'
import type { NodeStore, EnrichedNodeData } from './node-store'
import { clearStepsPrefix, matchesAnyCommand } from '@shared/lib/command-regexp'

export interface TextLine {
  node: EnrichedNodeData
  text: string
}

export interface IndentedTextParams {
  saveFirst?: boolean
  parentIndentation?: number
  nonPromptNode?: boolean
  useCommand?: boolean
  ignorePostProccessCommand?: boolean
}

type XYNode = EnrichedNodeData & { x?: number; y?: number }

function hasDenseConnections(nodeId: NodeId, store: NodeStore): boolean {
  const node = store.getNode(nodeId)
  if (!node) return false

  const edgesMap: Record<string, string[]> = {}
  Object.keys(store._edges).forEach(edgeId => {
    const [s, t] = edgeId.split(':')
    ;[s, t].forEach(n => {
      edgesMap[n] ??= []
      edgesMap[n].push(edgeId)
    })
  })

  const visitedEdges = new Set<string>()
  let totalNodes = 0
  let totalEdges = 0

  const queue = (node.children ?? []).map(id => store.getNode(id)).filter((n): n is EnrichedNodeData => Boolean(n))
  while (queue.length) {
    const current = queue.pop()!
    totalNodes += 1
    const edges = edgesMap[current.id]
    if (!edges) continue
    edges.forEach(eid => {
      if (!visitedEdges.has(eid)) {
        visitedEdges.add(eid)
        totalEdges += 1
      }
    })
  }

  return totalNodes > 0 && totalEdges / totalNodes > 0.5
}

function formatIncomingConnections(node: EnrichedNodeData, store: NodeStore, ignoreIds: Set<string>): string {
  if (!Object.keys(store._edges).length) return ''
  const titles: string[] = []

  Object.values(store._edges).forEach(({ end, start, title: edgeTitle }) => {
    const endNode = store.getNode(end)
    if (!endNode) return
    if (start === node.id && endNode.depth === node.depth) {
      ignoreIds.add(endNode.id)
      if (edgeTitle?.trim() && endNode.title?.trim()) {
        titles.push(`${edgeTitle} ${endNode.title}`)
      }
    }
  })

  return titles.join(', ')
}

function isPostProcessNode(title: string): boolean {
  return title.startsWith('/foreach') || title.startsWith('/summarize')
}

function resolveTitle(node: EnrichedNodeData, useCommand: boolean): string | undefined {
  return useCommand ? node.command || node.title : node.title
}

export function indentedText(startNode: EnrichedNodeData, store: NodeStore, params?: IndentedTextParams): TextLine[] {
  const {
    saveFirst = false,
    parentIndentation = 0,
    nonPromptNode = false,
    useCommand = false,
    ignorePostProccessCommand = false,
  } = params ?? {}

  const lines: TextLine[] = []
  let children: EnrichedNodeData[] = [startNode]
  const stack: EnrichedNodeData[][] = []
  const ignoreIds = new Set<string>()
  const formattedIds = new Set<string>()
  const denseConnectionCache: Record<string, boolean> = {}

  const rawTitle = resolveTitle(startNode, useCommand)
  const headTitle = rawTitle ? clearStepsPrefix(rawTitle) : ''
  const head: TextLine = {
    node: startNode,
    text: saveFirst || !matchesAnyCommand(headTitle) ? headTitle : '',
  }

  while (children.length > 0) {
    const node = children.pop()!
    const rawNodeTitle = resolveTitle(node, useCommand)
    const clearedTitle = rawNodeTitle ? clearStepsPrefix(rawNodeTitle) : ''

    if (!matchesAnyCommand(clearedTitle) && node.id !== startNode.id) {
      const indentation = (node.depth - startNode.depth + parentIndentation) * 2
      let text = `${' '.repeat(indentation)}${clearedTitle}`

      const parentId = node.parent
      if (parentId !== undefined) {
        if (!(parentId in denseConnectionCache)) {
          denseConnectionCache[parentId] = hasDenseConnections(parentId, store)
        }

        if (denseConnectionCache[parentId]) {
          const formattedConnections = formatIncomingConnections(node, store, ignoreIds)
          if (formattedConnections.length) {
            formattedIds.add(node.id)
            text += ` ${formattedConnections}`
          }
        }
      }

      lines.push({ node, text })
    }

    const shouldIgnorePostProcess = ignorePostProccessCommand && isPostProcessNode(clearedTitle)

    if ((node.children?.length ?? 0) > 0 && !shouldIgnorePostProcess) {
      if (children.length > 0) stack.push(children)

      const allChildren = (node.children ?? [])
        .map(id => store.getNode(id))
        .filter((n): n is EnrichedNodeData => Boolean(n))

      const withCoords = (allChildren as XYNode[]).filter(c => c.x || c.y)
      const withoutCoords = (allChildren as XYNode[]).filter(c => !(c.x && c.y))

      withCoords.sort((a, b) => -(a.x ?? 0) + (b.x ?? 0) || -(a.y ?? 0) + (b.y ?? 0))

      children = [...withoutCoords.reverse(), ...withCoords]

      if (nonPromptNode) {
        children = children.filter(n => !startNode.prompts?.includes(n.id))
      }
    } else if (children.length === 0) {
      children = stack.pop() ?? []
    }
  }

  return [head, ...lines.filter(({ node }) => formattedIds.has(node.id) || !ignoreIds.has(node.id))]
}
