import {substituteHashrefs, substituteReferences} from '../references/substitution'

const normalizeText = text => (typeof text === 'string' ? text : '')
const trailingWhitespace = text => text.match(/\s*$/)?.[0] || ''

const restoreTrailingWhitespace = (text, sourceText) => {
  const suffix = trailingWhitespace(sourceText)
  if (!suffix || text.endsWith(suffix)) return text
  return `${text}${suffix}`
}

const buildPromptNode = (node, text) => ({
  ...node,
  title: text,
  command: text,
  children: [],
})

export const resolveExternalCommandPrompt = (text, node, store) => {
  const rawText = normalizeText(text)

  if (!rawText || !store?._nodes) {
    return rawText
  }

  const promptNode = buildPromptNode(node, rawText)
  const withReferences = substituteReferences(rawText, 0, store)
  const resolvedText = substituteHashrefs(withReferences, 0, store, promptNode)
  return restoreTrailingWhitespace(resolvedText, rawText)
}
