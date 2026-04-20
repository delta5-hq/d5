import type { NodeStore } from './node-store'
import { REF_DEF_PREFIX, REF_PREFIX } from './reference-constants'
import { referencePatterns } from './reference-patterns'
import { clearReferences, findInNodeMap, getReferences } from './reference-utils'
import { indentedText } from './indented-text'

export function substituteReferences(
  title: string,
  parentIndentation: number,
  store: NodeStore,
  refs: string[] = [],
  isPrompt = false,
): string {
  const matches = getReferences(title, REF_PREFIX)
  if (matches.length === 0) return clearReferences(title)

  const firstRef = matches[0]
  const refName = firstRef.replace(REF_PREFIX, '')
  const refPattern = referencePatterns.specificWholeWord(refName, REF_DEF_PREFIX)
  const refNode = findInNodeMap(store._nodes, isPrompt, text => !!text && refPattern.test(text))

  if (refNode && !refs.includes(refName)) {
    refs.push(refName)

    const textArr = indentedText(refNode, store, { saveFirst: false, parentIndentation, useCommand: isPrompt })
    const head = textArr.shift()!
    const textFromRefNode = textArr
      .map(({ node: n, text }) => {
        if (referencePatterns.withAssignmentPrefix().test(text)) {
          const nodeDepth = (n as { depth?: number }).depth ?? 0
          return substituteReferences(text, nodeDepth - parentIndentation, store, refs, isPrompt)
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

    if (replacement) body += `\n${replacement}`

    const after = title.slice(matchIndex + firstRef.length)
    const afterRes = substituteReferences(after, parentIndentation, store, refs, isPrompt).trim()
    if (afterRes) {
      const depth = before.split('\n').at(-1)?.match(/^\s*/)?.[0].length ?? 0
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

  return clearReferences(title)
}
