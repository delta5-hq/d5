import { describe, it, expect } from 'vitest'
import { normalizeToRecord } from './normalize-to-record'
import type { NodeData, EdgeData } from '@shared/base-types'

describe('normalizeToRecord', () => {
  it('converts array to Record keyed by id', () => {
    const input: NodeData[] = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ]

    const result = normalizeToRecord(input)

    expect(result).toEqual({
      a: { id: 'a', title: 'A' },
      b: { id: 'b', title: 'B' },
    })
  })

  it('passes through Record unchanged', () => {
    const input: Record<string, NodeData> = {
      a: { id: 'a', title: 'A' },
    }

    const result = normalizeToRecord(input)

    expect(result).toBe(input)
  })

  it('returns undefined for undefined input', () => {
    expect(normalizeToRecord(undefined)).toBeUndefined()
  })

  it('returns empty Record for empty array', () => {
    expect(normalizeToRecord([])).toEqual({})
  })

  it('returns empty Record passthrough for empty Record', () => {
    const input: Record<string, NodeData> = {}
    expect(normalizeToRecord(input)).toBe(input)
  })

  it('handles single-element array', () => {
    const result = normalizeToRecord([{ id: 'only' }])

    expect(result).toEqual({ only: { id: 'only' } })
  })

  it('preserves all node fields during conversion', () => {
    const node: NodeData = {
      id: 'n1',
      title: 'Test',
      parent: 'root',
      children: ['c1', 'c2'],
    }

    const result = normalizeToRecord([node])

    expect(result?.n1).toBe(node)
  })

  it('converts edge array to Record keyed by id', () => {
    const edges: EdgeData[] = [
      { id: 'e1', start: 'a', end: 'b' },
      { id: 'e2', start: 'c', end: 'd', color: '#ff0' },
    ]

    const result = normalizeToRecord(edges)

    expect(result).toEqual({
      e1: { id: 'e1', start: 'a', end: 'b' },
      e2: { id: 'e2', start: 'c', end: 'd', color: '#ff0' },
    })
  })

  it('passes through edge Record unchanged', () => {
    const input: Record<string, EdgeData> = {
      e1: { id: 'e1', start: 'a', end: 'b' },
    }

    expect(normalizeToRecord(input)).toBe(input)
  })

  it('last entry wins when array has duplicate ids', () => {
    const result = normalizeToRecord([
      { id: 'dup', title: 'First' },
      { id: 'dup', title: 'Second' },
    ] as NodeData[])

    expect(result).toEqual({ dup: { id: 'dup', title: 'Second' } })
  })
})
