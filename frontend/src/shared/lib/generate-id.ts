import { customAlphabet } from 'nanoid'
import type { NodeId, EdgeId } from '@shared/base-types'

const ALPHABET = '2346789bdfghjmnpqrtBDFGHJLMNPQRT'
const ID_LENGTH = 11

const nanoid = customAlphabet(ALPHABET, ID_LENGTH)

export const generateId = (): string => nanoid()

export const generateNodeId = (): NodeId => generateId()

export const generateEdgeId = (start: NodeId, end: NodeId): EdgeId => `${start}:${end}`

export const generateUniqueNodeId = (existingIds: Set<string> | Record<string, unknown>): NodeId => {
  const idsSet = existingIds instanceof Set ? existingIds : new Set(Object.keys(existingIds))

  let id = generateNodeId()
  while (idsSet.has(id)) {
    id = generateNodeId()
  }
  return id
}
