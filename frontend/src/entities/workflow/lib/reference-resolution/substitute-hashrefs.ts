import type { NodeStore, EnrichedNodeData } from './node-store'
import { HASHREF_DEF_PREFIX, HASHREF_PREFIX } from './reference-constants'
import { referencePatterns } from './reference-patterns'
import { clearReferences, findAllInNodeArray, findAllSiblingsMatch, getReferences } from './reference-utils'
import { indentedText, type TextLine } from './indented-text'

function nodeStartsWithForeach(node: EnrichedNodeData): boolean {
  return node.title?.startsWith('/foreach') || node.command?.startsWith('/foreach') || false
}

function getLastLineIndent(text: string): number {
  return text.split('\n').at(-1)?.match(/^\s*/)?.[0].length ?? 0
}

function indentBlock(text: string, indentSize: number): string {
  const indent = ' '.repeat(indentSize)
  return text
    .split('\n')
    .map(line => (line.trim() ? indent + line : line))
    .join('\n')
}

function getNodeTextLines(
  n: EnrichedNodeData,
  store: NodeStore,
  parentIndentation: number,
  isPrompt: boolean,
): { textArr: TextLine[]; head: TextLine } {
  const textArr = indentedText(n, store, { saveFirst: false, parentIndentation, useCommand: isPrompt })
  const head = textArr.shift()!
  return { textArr, head }
}

function processTextLines(
  lines: TextLine[],
  reference: string,
  parentIndentation: number,
  store: NodeStore,
  refs: string[],
  isPrompt: boolean,
): string {
  return lines
    .map(({ node: n, text }) => {
      if (referencePatterns.withAssignmentPrefix(HASHREF_DEF_PREFIX).test(text)) {
        return substituteHashrefs(text, parentIndentation, store, n, refs, isPrompt)
      }
      return text
    })
    .join('\n')
    .replace(reference, '')
}

function cleanReferenceText(text: string): string {
  return text ? clearReferences(text, HASHREF_DEF_PREFIX).trimEnd() : ''
}

function buildBodyWithHead(
  beforeText: string,
  head: TextLine,
  contextNode: EnrichedNodeData,
  parentIndentation: number,
  store: NodeStore,
  refs: string[],
  isPrompt: boolean,
): string {
  let body = beforeText
  let clearedHead = head.text.trim()
  if (clearedHead) {
    if (referencePatterns.withAssignmentPrefix(HASHREF_DEF_PREFIX).test(clearedHead)) {
      clearedHead = substituteHashrefs(clearedHead, parentIndentation, store, contextNode, refs, isPrompt)
    }
    body += ` ${clearedHead}`
  }
  return body
}

function buildReplacementBlock(
  headLine: TextLine,
  replacement: string,
  refNode: EnrichedNodeData,
  parentIndentation: number,
  store: NodeStore,
  refs: string[],
  isPrompt: boolean,
): string {
  let cleanedHead = headLine.text
  if (cleanedHead && referencePatterns.withAssignmentPrefix(HASHREF_DEF_PREFIX).test(cleanedHead)) {
    cleanedHead = substituteHashrefs(cleanedHead, parentIndentation, store, refNode, refs, isPrompt)
  }
  const result = replacement ? (cleanedHead ? `${cleanedHead}\n${replacement}` : replacement) : cleanedHead
  return result.trimEnd()
}

function processNode(
  refNode: EnrichedNodeData,
  reference: string,
  title: string,
  parentIndentation: number,
  store: NodeStore,
  node: EnrichedNodeData,
  refs: string[],
  isPrompt: boolean,
): string {
  const { textArr, head } = getNodeTextLines(refNode, store, parentIndentation, isPrompt)
  const textFromRefNode = processTextLines(textArr, reference, parentIndentation, store, refs, isPrompt)
  const replacement = cleanReferenceText(textFromRefNode)

  const matchIndex = title.indexOf(reference)
  const before = clearReferences(title.slice(0, matchIndex).trimEnd(), HASHREF_DEF_PREFIX)

  let body = buildBodyWithHead(before, head, refNode, parentIndentation, store, refs, isPrompt)
  if (replacement) body += `\n${replacement}`

  const after = title.slice(matchIndex + reference.length)
  const afterRes = substituteHashrefs(after, parentIndentation, store, node, refs, isPrompt).trim()
  if (afterRes) {
    const depth = before.split('\n').at(-1)?.match(/^\s*/)?.[0].length ?? 0
    body += `\n${' '.repeat(depth)}${afterRes}`
  }

  return body
}

function processMultipleNodes(
  refNodes: EnrichedNodeData[],
  reference: string,
  title: string,
  parentIndentation: number,
  store: NodeStore,
  node: EnrichedNodeData,
  refs: string[],
  isPrompt: boolean,
): string {
  const replacementBlocks = refNodes
    .map(refNode => {
      const { textArr: lines, head: headLine } = getNodeTextLines(refNode, store, parentIndentation, isPrompt)
      const processedBody = processTextLines(lines, reference, parentIndentation, store, refs, isPrompt)
      const replacement = cleanReferenceText(processedBody)
      return buildReplacementBlock(headLine, replacement, refNode, parentIndentation, store, refs, isPrompt)
    })
    .filter(Boolean)

  const matchIndex = title.indexOf(reference)
  const titleBefore = title.slice(0, matchIndex).trimEnd()
  const clearedBefore = clearReferences(titleBefore, HASHREF_DEF_PREFIX)

  const after = title.slice(matchIndex + reference.length)
  const afterProcessed = substituteHashrefs(after, parentIndentation, store, node, refs, isPrompt).trim()

  const lastLineIndent = getLastLineIndent(clearedBefore)
  const indentedBlocks = replacementBlocks.map(block => indentBlock(block, lastLineIndent + 1))

  const body = [clearedBefore, ...indentedBlocks.map(block => `\n${block}`)].join('')
  return afterProcessed ? `${body}\n${' '.repeat(lastLineIndent)}${afterProcessed}` : body
}

function findRefNode(
  reference: string,
  name: string,
  node: EnrichedNodeData,
  store: NodeStore,
  checkCommandFirst: boolean,
): { refName: string; nodeOrNodes: EnrichedNodeData | EnrichedNodeData[] | undefined } {
  const isFirstRef = referencePatterns.hashrefFirst.test(reference)
  const isLastRef = referencePatterns.hashrefLast.test(reference)

  const refName = isFirstRef
    ? name.replace(referencePatterns.firstPostfix, '')
    : isLastRef
      ? name.replace(referencePatterns.lastPostfix, '')
      : name

  const predicate = (text: string | null | undefined): boolean => {
    if (!text) return false
    return referencePatterns.specificWholeWord(refName, HASHREF_DEF_PREFIX).test(text)
  }

  const matchedNodes = findAllSiblingsMatch(
    node,
    store._nodes,
    checkCommandFirst,
    predicate,
    undefined,
    n => !nodeStartsWithForeach(n),
  )

  let nodeOrNodes: EnrichedNodeData | EnrichedNodeData[] | undefined

  if (matchedNodes.length > 0) {
    nodeOrNodes = isFirstRef ? matchedNodes[0] : isLastRef ? matchedNodes[matchedNodes.length - 1] : matchedNodes
  } else {
    const fallback = findAllInNodeArray(Object.values(store._nodes), checkCommandFirst, predicate, predicate)
    nodeOrNodes = fallback
  }

  return { refName, nodeOrNodes }
}

export function substituteHashrefs(
  title: string,
  parentIndentation: number,
  store: NodeStore,
  node: EnrichedNodeData,
  refs: string[] = [],
  isPrompt = false,
): string {
  const wildcardMatch = title.match(referencePatterns.wildcardHashref)
  if (wildcardMatch) {
    const wildcardRef = wildcardMatch[0]
    const wildcardPattern = `${wildcardMatch[1]}([a-zA-Z0-9_]+(_[a-zA-Z0-9]+)*)`
    const pattern = referencePatterns.specificWholeWord(wildcardPattern, HASHREF_DEF_PREFIX)

    const relatedNodes = Object.values(store._nodes).filter(n => n.title?.match(pattern) || n.command?.match(pattern))

    const replaced = relatedNodes
      .flatMap(n => n.title?.match(referencePatterns.hashrefs) ?? n.command?.match(referencePatterns.hashrefs) ?? [])
      .map(hashref => `#${hashref}`)
      .join(' ')

    const replacedTitle = title.replace(wildcardRef, replaced)
    return substituteHashrefs(replacedTitle, parentIndentation, store, node, refs, isPrompt)
  }

  const matches = getReferences(title, HASHREF_PREFIX, referencePatterns.postfixes)
  if (matches.length === 0) return clearReferences(title, HASHREF_DEF_PREFIX)

  const firstRef = matches[0]
  const refName = firstRef.replace(HASHREF_PREFIX, '')
  const { refName: resolvedName, nodeOrNodes } = findRefNode(firstRef, refName, node, store, isPrompt)

  if ((nodeOrNodes || Array.isArray(nodeOrNodes)) && !refs.includes(resolvedName)) {
    refs.push(resolvedName)

    const isSingleNode = !Array.isArray(nodeOrNodes) || (nodeOrNodes as EnrichedNodeData[]).length === 1
    const isMultipleNodes = Array.isArray(nodeOrNodes) && (nodeOrNodes as EnrichedNodeData[]).length > 1

    if (isSingleNode) {
      const refNode = Array.isArray(nodeOrNodes)
        ? (nodeOrNodes as EnrichedNodeData[])[0]
        : (nodeOrNodes as EnrichedNodeData)
      return processNode(refNode, firstRef, title, parentIndentation, store, node, refs, isPrompt)
    }

    if (isMultipleNodes) {
      return clearReferences(
        processMultipleNodes(
          nodeOrNodes as EnrichedNodeData[],
          firstRef,
          title,
          parentIndentation,
          store,
          node,
          refs,
          isPrompt,
        ),
        HASHREF_DEF_PREFIX,
      )
    }
  }

  if (refs.includes(resolvedName)) {
    const newTitle = title.replace(firstRef, '')
    return referencePatterns.withAssignmentPrefix(HASHREF_DEF_PREFIX).test(newTitle)
      ? substituteHashrefs(newTitle, parentIndentation, store, node, refs, isPrompt)
      : newTitle
  }

  return clearReferences(title, HASHREF_DEF_PREFIX)
}
