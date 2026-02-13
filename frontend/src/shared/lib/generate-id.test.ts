import { describe, it, expect } from 'vitest'
import { generateId, generateNodeId, generateEdgeId, generateUniqueNodeId } from './generate-id'

describe('generateId', () => {
  it('returns non-empty string', () => {
    const id = generateId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('generates unique IDs across multiple calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(generateId())
    }
    expect(ids.size).toBe(1000)
  })
})

describe('generateNodeId', () => {
  it('returns string suitable for NodeId', () => {
    const id = generateNodeId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })
})

describe('generateEdgeId', () => {
  it('combines start and end with colon separator', () => {
    const edgeId = generateEdgeId('nodeA', 'nodeB')
    expect(edgeId).toBe('nodeA:nodeB')
  })

  it('handles empty strings', () => {
    const edgeId = generateEdgeId('', '')
    expect(edgeId).toBe(':')
  })
})

describe('generateUniqueNodeId', () => {
  it('returns unique ID not in existing Set', () => {
    const existing = new Set(['id1', 'id2', 'id3'])
    const newId = generateUniqueNodeId(existing)
    expect(existing.has(newId)).toBe(false)
  })

  it('returns unique ID not in existing Record keys', () => {
    const existing = { id1: {}, id2: {}, id3: {} }
    const newId = generateUniqueNodeId(existing)
    expect(newId in existing).toBe(false)
  })

  it('handles empty collections', () => {
    expect(generateUniqueNodeId(new Set())).toBeTruthy()
    expect(generateUniqueNodeId({})).toBeTruthy()
  })

  it('generates unique IDs at scale without collisions', () => {
    const existing = new Set<string>()
    for (let i = 0; i < 10000; i++) {
      const newId = generateUniqueNodeId(existing)
      expect(existing.has(newId)).toBe(false)
      existing.add(newId)
    }
    expect(existing.size).toBe(10000)
  })

  it('handles large existing collections efficiently', () => {
    const existing: Record<string, unknown> = {}
    for (let i = 0; i < 1000; i++) {
      existing[`node-${i}`] = {}
    }
    const newId = generateUniqueNodeId(existing)
    expect(newId in existing).toBe(false)
    expect(typeof newId).toBe('string')
    expect(newId.length).toBeGreaterThan(0)
  })
})

describe('generateEdgeId - Edge Cases', () => {
  it('handles node IDs with special characters', () => {
    expect(generateEdgeId('node:123', 'node:456')).toBe('node:123:node:456')
    expect(generateEdgeId('a-b-c', 'd-e-f')).toBe('a-b-c:d-e-f')
  })

  it('handles very long node IDs', () => {
    const longId = 'x'.repeat(100)
    const edgeId = generateEdgeId(longId, longId)
    expect(edgeId).toBe(`${longId}:${longId}`)
    expect(edgeId.length).toBe(201)
  })
})
