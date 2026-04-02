import { describe, it, expect } from 'vitest'

/* Wire path generation tests - functions duplicated from tree-node-default.tsx for testing */

const INDENT_PER_LEVEL = 24
const ROW_HEIGHT = 32
const WIRE_PADDING = 2
const BASE_PADDING = 8

function buildWirePath(
  indentX: number,
  rowHeight: number,
  indentWidth: number,
  rowsFromParent: number,
  hasMoreSiblings: boolean,
  extendDown: number = 0,
): string {
  const startX = indentX + WIRE_PADDING
  const parentCenterY = -(rowsFromParent * rowHeight) + rowHeight / 2
  const cornerY = rowHeight / 2
  const endX = indentX + indentWidth - WIRE_PADDING

  let path = `M ${startX} ${parentCenterY} L ${startX} ${cornerY} L ${endX} ${cornerY}`

  if (hasMoreSiblings || extendDown > 0) {
    const bottomY = rowHeight + extendDown
    path += ` M ${startX} ${cornerY} L ${startX} ${bottomY}`
  }

  return path
}

function buildChildConnectorPath(childIndentX: number, rowHeight: number, extendDown: number = 0): string {
  const x = childIndentX + WIRE_PADDING
  const centerY = rowHeight / 2
  const bottomY = rowHeight + extendDown
  return `M ${x} ${centerY} L ${x} ${bottomY}`
}

function buildSparkPath(indentX: number, rowHeight: number, indentWidth: number, rowsFromParent: number): string {
  const startX = indentX + WIRE_PADDING
  const parentCenterY = -(rowsFromParent * rowHeight) + rowHeight / 2
  const cornerY = rowHeight / 2
  const endX = indentX + indentWidth - WIRE_PADDING

  return `M ${startX} ${parentCenterY} L ${startX} ${cornerY} L ${endX} ${cornerY}`
}

function buildContinuationLines(
  ancestorContinuation: boolean[],
  rowHeight: number,
  extendUp: number = 0,
  extendDown: number = 0,
): Array<{ x: number; path: string }> {
  const lines: Array<{ x: number; path: string }> = []

  ancestorContinuation.forEach((needsContinuation, depthIndex) => {
    if (!needsContinuation || depthIndex < 1) return
    const x = BASE_PADDING + (depthIndex - 1) * INDENT_PER_LEVEL + WIRE_PADDING
    const topY = -extendUp
    const bottomY = rowHeight + extendDown
    lines.push({ x, path: `M ${x} ${topY} L ${x} ${bottomY}` })
  })

  return lines
}

describe('buildWirePath', () => {
  const wireIndentX = BASE_PADDING + (1 - 1) * INDENT_PER_LEVEL

  it('starts from parent center for immediate child (1 row away)', () => {
    const path = buildWirePath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 1, false, 0)
    expect(path).toContain('M 10 -16')
  })

  it('starts from parent center for distant child (3 rows away)', () => {
    const path = buildWirePath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 3, false, 0)
    expect(path).toContain('M 10 -80')
  })

  it('creates L-shape path: vertical down, then horizontal right', () => {
    const path = buildWirePath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 1, false, 0)
    expect(path).toMatch(/M 10 -16 L 10 16 L 30 16/)
  })

  it('extends down when hasMoreSiblings is true', () => {
    const path = buildWirePath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 1, true, 0)
    expect(path).toContain('M 10 16 L 10 32')
  })

  it('does NOT extend down when hasMoreSiblings is false', () => {
    const path = buildWirePath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 1, false, 0)
    expect(path).not.toContain('M 10 16 L 10 32')
  })

  it('extends down when extendDown > 0 (container padding)', () => {
    const path = buildWirePath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 1, false, 8)
    expect(path).toContain('M 10 16 L 10 40')
  })

  it('works at any depth with correct indent calculation', () => {
    const depth5IndentX = BASE_PADDING + (5 - 1) * INDENT_PER_LEVEL
    const path = buildWirePath(depth5IndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 1, false, 0)
    expect(path).toContain('M 106 -16')
  })

  it('handles zero rowsFromParent (edge case)', () => {
    const path = buildWirePath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 0, false, 0)
    expect(path).toContain('M 10 16')
  })

  it('handles large rowsFromParent (scalability)', () => {
    const path = buildWirePath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 100, false, 0)
    expect(path).toContain('M 10 -3184')
  })
})

describe('buildSparkPath', () => {
  const wireIndentX = BASE_PADDING + (1 - 1) * INDENT_PER_LEVEL

  it('produces SAME starting point as buildWirePath', () => {
    const wirePath = buildWirePath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 2, false, 0)
    const sparkPath = buildSparkPath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 2)
    expect(wirePath).toContain('M 10 -48')
    expect(sparkPath).toContain('M 10 -48')
  })

  it('does NOT include extension segment (spark only travels L-shape)', () => {
    const sparkPath = buildSparkPath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 1)
    const segments = sparkPath.split('M ').filter(s => s.length > 0)
    expect(segments).toHaveLength(1)
  })

  it('works for any rowsFromParent value', () => {
    const spark1 = buildSparkPath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 1)
    const spark5 = buildSparkPath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 5)
    const spark10 = buildSparkPath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, 10)
    expect(spark1).toContain('M 10 -16')
    expect(spark5).toContain('M 10 -144')
    expect(spark10).toContain('M 10 -304')
  })
})

describe('buildChildConnectorPath', () => {
  it('creates vertical line at children depth level', () => {
    const childIndentX = BASE_PADDING + 1 * INDENT_PER_LEVEL
    const path = buildChildConnectorPath(childIndentX, ROW_HEIGHT, 0)
    expect(path).toBe('M 34 16 L 34 32')
  })

  it('extends below row when extendDown specified', () => {
    const childIndentX = BASE_PADDING + 1 * INDENT_PER_LEVEL
    const path = buildChildConnectorPath(childIndentX, ROW_HEIGHT, 8)
    expect(path).toBe('M 34 16 L 34 40')
  })

  it('works at any depth level', () => {
    const depth0 = BASE_PADDING + 0 * INDENT_PER_LEVEL
    const depth5 = BASE_PADDING + 5 * INDENT_PER_LEVEL
    const path0 = buildChildConnectorPath(depth0, ROW_HEIGHT, 0)
    const path5 = buildChildConnectorPath(depth5, ROW_HEIGHT, 0)
    expect(path0).toContain('M 10 16')
    expect(path5).toContain('M 130 16')
  })
})

describe('buildContinuationLines', () => {
  it('returns empty array when no ancestors need continuation', () => {
    const lines = buildContinuationLines([false, false], ROW_HEIGHT)
    expect(lines).toEqual([])
  })

  it('skips depthIndex 0 (root has no wire column)', () => {
    const lines = buildContinuationLines([true], ROW_HEIGHT)
    expect(lines).toEqual([])
  })

  it('creates continuation at ancestor wire column (depthIndex - 1)', () => {
    const lines = buildContinuationLines([false, true], ROW_HEIGHT)
    expect(lines).toHaveLength(1)
    expect(lines[0].x).toBe(10)
    expect(lines[0].path).toBe('M 10 0 L 10 32')
    /* must NOT be one column to the right — x maps to (depthIndex - 1), not depthIndex */
    expect(lines[0].x).not.toBe(BASE_PADDING + INDENT_PER_LEVEL + WIRE_PADDING)
  })

  it('creates continuation for each ancestor that needs it', () => {
    const lines = buildContinuationLines([false, true, false, true], ROW_HEIGHT)
    expect(lines).toHaveLength(2)
    expect(lines[0].x).toBe(10)
    expect(lines[1].x).toBe(58)
  })

  it('maps depthIndex to correct wire column across depths', () => {
    const lines = buildContinuationLines([false, true, true, true], ROW_HEIGHT)
    expect(lines).toHaveLength(3)
    expect(lines[0].x).toBe(10)
    expect(lines[1].x).toBe(34)
    expect(lines[2].x).toBe(58)
  })

  it('always extends full row height (no truncation)', () => {
    const lines = buildContinuationLines([false, true, true], ROW_HEIGHT)
    expect(lines[0].path).toBe('M 10 0 L 10 32')
    expect(lines[1].path).toBe('M 34 0 L 34 32')
  })

  it('extends upward when extendUp specified', () => {
    const lines = buildContinuationLines([false, true], ROW_HEIGHT, 4)
    expect(lines[0].path).toBe('M 10 -4 L 10 32')
  })

  it('extends downward when extendDown specified', () => {
    const lines = buildContinuationLines([false, true], ROW_HEIGHT, 0, 8)
    expect(lines[0].path).toBe('M 10 0 L 10 40')
  })

  it('combines extendUp and extendDown', () => {
    const lines = buildContinuationLines([false, true], ROW_HEIGHT, 4, 8)
    expect(lines[0].path).toBe('M 10 -4 L 10 40')
  })
})

describe('Edge Cases', () => {
  it('handles zero row height gracefully', () => {
    const path = buildWirePath(10, 0, INDENT_PER_LEVEL, 1, false, 0)
    expect(path).toContain('M 12 0 L 12 0')
  })

  it('handles negative extendDown (edge case)', () => {
    const path = buildWirePath(10, ROW_HEIGHT, INDENT_PER_LEVEL, 1, true, -10)
    expect(path).toContain('L 12 22')
  })

  it('handles empty ancestorContinuation array', () => {
    const lines = buildContinuationLines([], ROW_HEIGHT)
    expect(lines).toEqual([])
  })

  it('handles all-false ancestorContinuation array', () => {
    const lines = buildContinuationLines([false, false, false], ROW_HEIGHT)
    expect(lines).toEqual([])
  })

  it('handles very large depth (100 levels)', () => {
    const continuation = new Array(100).fill(true)
    const lines = buildContinuationLines(continuation, ROW_HEIGHT)
    expect(lines).toHaveLength(99)
    expect(lines[98].x).toBe(BASE_PADDING + 98 * INDENT_PER_LEVEL + WIRE_PADDING)
  })

  it('depthIndex 0 true is always skipped even if explicitly set', () => {
    const lines = buildContinuationLines([true, false], ROW_HEIGHT)
    expect(lines).toEqual([])
  })
})

describe('Formula Consistency', () => {
  it('wire and spark paths align at start point', () => {
    for (let rowsFromParent = 1; rowsFromParent <= 10; rowsFromParent++) {
      const wirePath = buildWirePath(10, ROW_HEIGHT, INDENT_PER_LEVEL, rowsFromParent, false, 0)
      const sparkPath = buildSparkPath(10, ROW_HEIGHT, INDENT_PER_LEVEL, rowsFromParent)
      const wireStart = wirePath.match(/M ([\d.-]+) ([\d.-]+)/)
      const sparkStart = sparkPath.match(/M ([\d.-]+) ([\d.-]+)/)
      expect(wireStart).toBeTruthy()
      expect(sparkStart).toBeTruthy()
      expect(wireStart![1]).toBe(sparkStart![1])
      expect(wireStart![2]).toBe(sparkStart![2])
    }
  })

  it('parent center formula is consistent: -(rows * height) + (height / 2)', () => {
    const testCases = [
      { rows: 1, height: 32, expected: -16 },
      { rows: 2, height: 32, expected: -48 },
      { rows: 3, height: 32, expected: -80 },
      { rows: 1, height: 40, expected: -20 },
      { rows: 5, height: 40, expected: -180 },
    ]
    testCases.forEach(({ rows, height, expected }) => {
      const path = buildWirePath(10, height, INDENT_PER_LEVEL, rows, false, 0)
      expect(path).toContain(`M 12 ${expected}`)
    })
  })
})
