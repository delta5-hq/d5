import {commandRegExp} from '../../constants/commandRegExp'
import {FOREACH_QUERY} from '../../constants/foreach'
import {clearStepsPrefix} from '../../constants/steps'
import {checkIsPostProccess} from '../utils/checkIsPostProccess'
import {
  clearReferences,
  findInNodeMap,
  getReferences,
  findAllSiblingsMatch,
  findAllInNodeArray,
} from './utils/referenceUtils'
import {clearCommandsWithParams} from '../../constants'
import {referencePatterns} from './utils/referencePatterns'
import {REF_DEF_PREFIX, REF_PREFIX, HASHREF_DEF_PREFIX, HASHREF_PREFIX} from './referenceConstants'

function nodeStartsWithForeach(node) {
  return node.title?.startsWith(FOREACH_QUERY) || node.command?.startsWith(FOREACH_QUERY) || false
}
// eslint-disable-next-line no-unused-vars
import Store from '../utils/Store'

/**
 * Determines whether a node children have a multiple connections
 *
 *
 * @param {string} nodeId
 * @param {Store} store
 * @returns {boolean}
 */
export const hasDenseConnections = (nodeId, store) => {
  const node = store.getNode(nodeId)
  if (!node) return false

  const nodes = node.children.map(id => store.getNode(id))

  // Map each nodeId from edgeId ("a:b") to its edgeId
  const edgesMap = Object.keys(store._edges).reduce((acc, edgeId) => {
    const [s, t] = edgeId.split(':')
    ;[s, t].forEach(n => (acc[n] ||= []).push(edgeId))
    return acc
  }, {})
  const visitedEdges = new Set()

  let totalNodes = 0
  let totalEdges = 0

  while (nodes.length) {
    const current = nodes.pop()
    totalNodes += 1

    const edges = edgesMap[current.id]

    if (!edges) continue
    edges.forEach(edgeId => {
      if (!visitedEdges.has(edgeId)) {
        visitedEdges.add(edgeId)
        totalEdges += 1
      }
    })
  }

  const averageEdgesPerNode = totalEdges / totalNodes
  return averageEdgesPerNode > 0.5
}

/**
 * Creates a comma-separated string of incoming edge titles and their corresponding start node titles,
 * for edges that connect to the given node at the same depth level
 *
 * Only includes edges where both the edge title and the start node title are non-empty
 *
 * @param {import('../utils/Store').NodeData | undefined} node
 * @param {Store} store
 * @param {Set<string>} [traversedIds]
 * @returns {string} - A comma-separated string describing valid incoming connections, or an empty string if none
 */
export const formatIncomingConnections = (node, store, traversedIds = new Set()) => {
  if (!node || !Object.keys(store._edges).length) return ''

  const titles = []

  Object.values(store._edges).forEach(({end, start, title: edgeTitle}) => {
    const endNode = store.getNode(end)
    if (start === node.id && endNode.depth === node.depth) {
      const endNodeTitle = endNode.title
      traversedIds.add(endNode.id)

      if (edgeTitle?.trim() && endNodeTitle?.trim()) {
        titles.push(`${edgeTitle} ${endNodeTitle}`)
      }
    }
  })

  return titles.join(', ')
}

export const indentedText = (startNode, store, params) => {
  const {
    saveFirst = false,
    parentIndentation = 0,
    nonPromptNode = false,
    useCommand = false,
    ignorePostProccessCommand = false,
  } = params ?? {}

  const lines = []
  let children = [startNode]
  const stack = []
  const ignoreIds = new Set()
  const formattedIds = new Set()

  const denseConnectionMap = {}

  const getTitle = (n, condition) => {
    let str
    if (condition) {
      if (n.command) {
        str = n.command
      } else {
        str = n.title
      }
    } else {
      str = n.title
    }

    return str
  }

  const head = {
    node: startNode,
    text: '',
  }
  const rawTitle = getTitle(startNode, useCommand)
  const headTitle = rawTitle ? clearStepsPrefix(rawTitle) : ''

  if (saveFirst || !commandRegExp.any.test(headTitle)) {
    head.text = headTitle
  }

  while (children && children.length > 0) {
    const node = children.pop()
    const title = getTitle(node, useCommand)
    const clearedTitle = title ? clearStepsPrefix(title) : ''

    if (!commandRegExp.any.test(clearedTitle) && node.id !== startNode.id) {
      const indentation = (node.depth - startNode.depth + parentIndentation) * 2

      let text = `${' '.repeat(indentation)}${clearedTitle}`

      const parentId = node.parentNode?.id

      if (typeof denseConnectionMap[parentId] !== 'boolean') {
        denseConnectionMap[parentId] = hasDenseConnections(node.parent, store)
      }

      if (denseConnectionMap[parentId]) {
        const formattedConnections = formatIncomingConnections(node, store, ignoreIds)
        if (formattedConnections.length) {
          formattedIds.add(node.id)
          text += ` ${formattedConnections}`
        }
      }

      lines.push({
        node,
        text,
      })
    }

    const isPostProccessNode = ignorePostProccessCommand && checkIsPostProccess(clearedTitle)

    if (node?.children?.length > 0 && !isPostProccessNode) {
      if (children.length > 0) stack.push(children)
      const filteredChildren = [...node.children.map(childId => store.getNode(childId))]

      const withCoords = filteredChildren.filter(c => c.x || c.y)
      const withoutCoords = filteredChildren.filter(c => !(c.x && c.y)).reverse()

      withCoords.sort((a, b) => -a.x + b.x || -a.y + b.y)

      children = [...withoutCoords, ...withCoords]

      if (nonPromptNode) {
        children = children.filter(n => !startNode.prompts?.includes(n.id))
      }
    } else if (children.length === 0) {
      children = stack.pop() || []
    }
  }

  return [head, ...lines.filter(({node}) => formattedIds.has(node.id) || !ignoreIds.has(node.id))]
}

export function substituteReferences(title, parentIndentation, store, refs = [], isPrompt = false) {
  const matches = getReferences(title, REF_PREFIX)

  if (matches.length > 0) {
    const firstRef = matches[0]
    const refName = firstRef.replace(REF_PREFIX, '')
    const refPattern = referencePatterns.specificWholeWord(refName, REF_DEF_PREFIX)
    const refNode = findInNodeMap(store._nodes, isPrompt, text => !!text && refPattern.test(text))

    if (refNode && !refs.includes(refName)) {
      refs.push(refName)
      const textArr = indentedText(refNode, store, {saveFirst: false, parentIndentation, useCommand: isPrompt})
      const head = textArr.shift()
      const textFromRefNode = textArr
        .map(({node: n, text}) => {
          if (referencePatterns.withAssignmentPrefix().test(text)) {
            return substituteReferences(text, n.depth - parentIndentation, store, refs, isPrompt)
          }
          return text
        })
        .join('\n')
        .replace(firstRef, '')

      const replacement = textFromRefNode.trim() ? clearReferences(textFromRefNode).trimEnd() : ''

      const matchIndex = title.indexOf(firstRef)
      const before = clearReferences(title.slice(0, matchIndex).trimEnd())

      let body = before

      let clearedHead = head.text.trim()
      if (clearedHead) {
        if (referencePatterns.withAssignmentPrefix().test(clearedHead)) {
          clearedHead = substituteReferences(clearedHead, parentIndentation, store, refs, isPrompt)
        }
        body += ` ${clearedHead}`
      }

      if (replacement) {
        body += `\n${replacement}`
      }

      const after = title.slice(matchIndex + firstRef.length)
      const afterRes = substituteReferences(after, parentIndentation, store, refs, isPrompt).trim()

      if (afterRes) {
        const depth = before.split('\n').at(-1)?.match(/^\s*/)?.[0].length || 0
        body += `\n${' '.repeat(depth)}${afterRes}`
      }

      return body
    }
    if (refs.includes(refName)) {
      const newTitle = title.replace(firstRef, '')
      return referencePatterns.withAssignmentPrefix().test(newTitle)
        ? substituteReferences(newTitle, parentIndentation, store, refs, isPrompt)
        : newTitle
    }
  }
  return clearReferences(title)
}

export const substituteAllRefs = (node, store, indentedTextParams) => {
  const initialNodeStartsWithForeach = nodeStartsWithForeach(node)
  return indentedText(node, store, indentedTextParams)
    .map(t => {
      if (
        referencePatterns.withAssignmentPrefix().test(t.text) &&
        (initialNodeStartsWithForeach || !t.text.startsWith(FOREACH_QUERY))
      ) {
        return substituteReferences(
          t.text,
          t.node.depth - node.depth,
          store,
          [],
          indentedTextParams?.nonPromptNode || false,
        )
      }
      return t.text
    })
    .join('\n')
}

export function substituteReferencesChildrenAndSelf(node, store, indentedTextParams) {
  const {
    nonPromptNode = true,
    saveFirst = true,
    useCommand = true,
    ignorePostProccessCommand = true,
  } = indentedTextParams || {}
  const params = {...indentedTextParams, nonPromptNode, saveFirst, useCommand, ignorePostProccessCommand}

  const nodesTitle = substituteAllRefs(node, store, params)

  if (nodesTitle.startsWith(FOREACH_QUERY)) {
    return clearCommandsWithParams(
      clearReferences(clearStepsPrefix(nodesTitle.replace(FOREACH_QUERY, '')), REF_DEF_PREFIX),
    ).trim()
  }

  return clearCommandsWithParams(
    clearReferences(
      clearStepsPrefix(nodesTitle.startsWith(FOREACH_QUERY) ? nodesTitle.replace(FOREACH_QUERY, '') : nodesTitle),
      REF_DEF_PREFIX,
    ),
  ).trim()
}

export function substituteHashrefs(title, parentIndentation, store, node, refs = [], isPrompt = false) {
  /**
   *
   * @param {[string, string]} param0
   * @returns {{
   *  nodeOrNodes: NodeData | NodeData[]
   *  refName: string
   * }}
   */
  function findRefNode(reference, name) {
    /**
     *
     * @param {string} str
     * @returns {(text: string | null | undefined) => boolean}
     */
    function createFindPredicate(str) {
      const pattern = referencePatterns.specificWholeWord(str, HASHREF_DEF_PREFIX)
      return text => !!text && pattern.test(text)
    }

    const isFirstRef = referencePatterns.hashrefFirst.test(reference)
    const isLastRef = referencePatterns.hashrefLast.test(reference)

    const refName = isFirstRef
      ? name.replace(referencePatterns.firstPostfix, '')
      : isLastRef
      ? name.replace(referencePatterns.lastPostfix, '')
      : name

    const predicate = createFindPredicate(refName)
    const matchedNodes = findAllSiblingsMatch(
      node,
      store._nodes,
      isPrompt,
      predicate,
      undefined,
      n => !nodeStartsWithForeach(n),
    )

    let result

    if (matchedNodes.length > 0) {
      result = isFirstRef ? matchedNodes.at(0) : isLastRef ? matchedNodes.at(-1) : matchedNodes
    } else {
      const fallbackSearch = findAllInNodeArray(Object.values(store._nodes), isPrompt, predicate, predicate)
      result = fallbackSearch
    }

    return {
      refName,
      nodeOrNodes: result,
    }
  }

  /**
   *
   * @param {NodeData} n
   * @param {Store} store
   * @returns {{textArr: Line[]; head: Line}}
   */
  function getNodeTextLines(n, store) {
    const textArr = indentedText(n, store, {
      saveFirst: false,
      parentIndentation,
      useCommand: isPrompt,
    })
    const head = textArr.shift()
    return {textArr, head}
  }

  /**
   *
   * @param {{node: NodeData, text: string}} lines
   * @param {string} reference
   * @returns {string}
   */
  function processTextLines(lines, reference) {
    return lines
      .map(({node: n, text}) => {
        if (referencePatterns.withAssignmentPrefix(HASHREF_DEF_PREFIX).test(text)) {
          return substituteHashrefs(text, n.depth - parentIndentation, store, n, refs, isPrompt)
        }
        return text
      })
      .join('\n')
      .replace(reference, '')
  }

  /**
   *
   * @param {string} text
   * @returns {string}
   */
  function cleanReferenceText(text) {
    return text ? clearReferences(text, HASHREF_DEF_PREFIX).trimEnd() : ''
  }

  /**
   *
   * @param {string} beforeText
   * @param {{node: NodeData, text: string}} head
   * @param {NodeData} contextNode
   * @returns {string}
   */
  function buildBodyWithHead(beforeText, head, contextNode) {
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

  /**
   *
   * @param {string} body
   * @param {string} replacement
   * @returns {string}
   */
  function appendReplacement(body, replacement) {
    if (replacement) {
      body += `\n${replacement}`
    }
    return body
  }

  /**
   *
   * @param {string} body
   * @param {string} afterText
   * @param {string} beforeText
   * @returns
   */
  function appendAfterText(body, afterText, beforeText) {
    const afterRes = substituteHashrefs(afterText, parentIndentation, store, node, refs, isPrompt).trim()
    if (afterRes) {
      const depth = beforeText.split('\n').at(-1)?.match(/^\s*/)?.[0].length || 0
      body += `\n${' '.repeat(depth)}${afterRes}`
    }
    return body
  }

  /**
   *
   * @param {{node: NodeData, text: string}} headLine
   * @param {string} replacement
   * @param {NodeData} refNode
   * @returns {string}
   */
  function buildReplacementBlock(headLine, replacement, refNode) {
    let cleanedHead = headLine.text
    if (cleanedHead && referencePatterns.withAssignmentPrefix(HASHREF_DEF_PREFIX).test(cleanedHead)) {
      cleanedHead = substituteHashrefs(cleanedHead, parentIndentation, store, refNode, refs, isPrompt)
    }

    let result = cleanedHead
    if (replacement) {
      result += result ? `\n${replacement}` : replacement
    }

    return result.trimEnd()
  }

  /**
   *
   * @param {string} text
   * @returns {number}
   */
  function getLastLineIndent(text) {
    return text.split('\n').at(-1)?.match(/^\s*/)?.[0].length || 0
  }

  /**
   *
   * @param {NodeData} refNode
   * @param {string} reference
   * @returns {string}
   */
  function processNode(refNode, reference) {
    const {textArr, head} = getNodeTextLines(refNode, store)
    const textFromRefNode = processTextLines(textArr, reference)
    const replacement = cleanReferenceText(textFromRefNode)

    const matchIndex = title.indexOf(reference)
    const before = clearReferences(title.slice(0, matchIndex).trimEnd(), HASHREF_DEF_PREFIX)

    let body = buildBodyWithHead(before, head, refNode)
    body = appendReplacement(body, replacement)
    body = appendAfterText(body, title.slice(matchIndex + reference.length), before)

    return body
  }

  /**
   *
   * @param {string} text
   * @param {number} indentSize
   * @returns {string}
   */
  function indentBlock(text, indentSize) {
    const indent = ' '.repeat(indentSize)
    return text
      .split('\n')
      .map(line => (line.trim() ? indent + line : line))
      .join('\n')
  }

  /**
   *
   * @param {NodeData[]} refNodes
   * @param {string} reference
   * @returns {string}
   */
  function processMultipleNodes(refNodes, reference) {
    const replacementBlocks = refNodes
      .map(refNode => {
        const {textArr: lines, head: headLine} = getNodeTextLines(refNode, store)
        const processedBody = processTextLines(lines, reference)
        const replacement = cleanReferenceText(processedBody)
        return buildReplacementBlock(headLine, replacement, refNode)
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

  const wildcardRefMatch = title.match(referencePatterns.wildcardHashref)
  if (wildcardRefMatch) {
    const wildcardRef = wildcardRefMatch[0]

    const wildcardHashref = `${wildcardRefMatch[1]}([a-zA-Z0-9_]+(_[a-zA-Z0-9]+)*)`
    // Generate a regular expression for finding specific matches
    const pattern = referencePatterns.specificWholeWord(wildcardHashref, HASHREF_DEF_PREFIX)

    // Filter to find those whose matches the wildcard pattern
    const relatedNodes = Object.values(store._nodes).filter(n => {
      const titleMatch = n.title?.match(pattern)
      if (titleMatch) return true

      const commandMatch = n.command?.match(pattern)
      if (commandMatch) return true
      return false
    })

    // Extract all hashrefs from the matched nodes
    const replaced = relatedNodes
      .flatMap(n => n.title?.match(referencePatterns.hashrefs) || n.command?.match(referencePatterns.hashrefs))
      .map(hashref => `#${hashref}`)
      .join(' ')

    const replacedTitle = title.replace(wildcardRef, replaced)

    return substituteHashrefs(replacedTitle, parentIndentation, store, node, refs, isPrompt)
  }

  const matches = getReferences(title, HASHREF_PREFIX, referencePatterns.postfixes)

  if (matches.length > 0) {
    const firstRef = matches[0]
    const refName = firstRef.replace(HASHREF_PREFIX, '')

    const {nodeOrNodes} = findRefNode(firstRef, refName)

    if ((nodeOrNodes || Array.isArray(nodeOrNodes)) && !refs.includes(refName)) {
      refs.push(refName)

      const isSingleNode = !Array.isArray(nodeOrNodes) || nodeOrNodes.length === 1
      const isMultipleNodes = Array.isArray(nodeOrNodes) && nodeOrNodes.length > 1

      if (isSingleNode) {
        const refNode = Array.isArray(nodeOrNodes) ? nodeOrNodes[0] : nodeOrNodes
        return processNode(refNode, firstRef)
      }
      if (isMultipleNodes) {
        return clearReferences(processMultipleNodes(nodeOrNodes, firstRef), HASHREF_DEF_PREFIX)
      }
    }
    if (refs.includes(refName)) {
      const newTitle = title.replace(firstRef, '')
      return referencePatterns.withAssignmentPrefix(HASHREF_DEF_PREFIX).test(newTitle)
        ? substituteHashrefs(newTitle, parentIndentation, store, node, refs, isPrompt)
        : newTitle
    }
  }
  return clearReferences(title, HASHREF_DEF_PREFIX)
}

export const substituteAllHashrefs = (node, store, indentedTextParams) => {
  const initialNodeStartsWithForeach = nodeStartsWithForeach(node)
  return indentedText(node, store, indentedTextParams)
    .map(t => {
      if (
        referencePatterns.withAssignmentPrefix(HASHREF_DEF_PREFIX).test(t.text) &&
        (initialNodeStartsWithForeach || !t.text.startsWith(FOREACH_QUERY))
      ) {
        return substituteHashrefs(
          t.text,
          t.node.depth - node.depth,
          store,
          t.node,
          [],
          indentedTextParams?.nonPromptNode || false,
        )
      }
      return t.text
    })
    .join('\n')
}

export function substituteHashrefsChildrenAndSelf(node, store, indentedTextParams) {
  const {
    nonPromptNode = true,
    saveFirst = true,
    useCommand = true,
    ignorePostProccessCommand = true,
  } = indentedTextParams || {}
  const params = {...indentedTextParams, nonPromptNode, saveFirst, useCommand, ignorePostProccessCommand}

  const nodesTitle = substituteAllHashrefs(node, store, params)

  if (nodesTitle.startsWith(FOREACH_QUERY)) {
    return clearCommandsWithParams(
      clearReferences(clearStepsPrefix(nodesTitle.replace(FOREACH_QUERY, '')), HASHREF_DEF_PREFIX),
    ).trim()
  }

  return clearCommandsWithParams(
    clearReferences(
      clearStepsPrefix(nodesTitle.startsWith(FOREACH_QUERY) ? nodesTitle.replace(FOREACH_QUERY, '') : nodesTitle),
      HASHREF_DEF_PREFIX,
    ),
  ).trim()
}

export function substituteReferencesAndHashrefsChildrenAndSelf(node, store, indentedTextParams) {
  const atRefContent = substituteReferencesChildrenAndSelf(node, store, indentedTextParams)

  const proxyNode = {
    ...node,
    title: atRefContent,
    command: atRefContent,
    depth: node.depth,
    children: [],
    id: node.id,
  }

  return substituteHashrefsChildrenAndSelf(proxyNode, store, indentedTextParams)
}

export function substituteReferencesAndHashrefsSelf(node, store) {
  if (!node.title) return ''
  return substituteReferences(substituteHashrefs(node.title, 0, store, node), 0, store).trim()
}
