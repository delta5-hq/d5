import type { NodeId, NodeData } from '@shared/base-types'

export interface TextBlock {
  content: string
  isEmpty: boolean
}

const PARAGRAPH_DELIMITER = '\n\n'

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(PARAGRAPH_DELIMITER)
    .map(p => p.trim())
    .filter(Boolean)
}

function createPromptNodeData(parentId: NodeId, title: string): Partial<NodeData> {
  return {
    title,
    parent: parentId,
  }
}

export function parseTextIntoBlocks(text: string): TextBlock[] {
  const paragraphs = splitIntoParagraphs(text)
  return paragraphs.map(content => ({
    content,
    isEmpty: content.length === 0,
  }))
}

export function createPromptNodesFromText(parentId: NodeId, text: string): Array<Partial<NodeData>> {
  const blocks = parseTextIntoBlocks(text)
  return blocks.filter(block => !block.isEmpty).map(block => createPromptNodeData(parentId, block.content))
}
