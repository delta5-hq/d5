import { BASE_PADDING, INDENT_PER_LEVEL } from './constants'

const MOBILE_MAX_INDENT_LEVEL = 1

export interface TreeIndentLayout {
  rowIndent: number
  wireIndent: number
  childIndent: number
}

export function getTreeIndentLayout(depth: number, isCompact: boolean): TreeIndentLayout {
  const normalizedDepth = Math.max(0, Math.floor(depth))
  const effectiveDepth = isCompact ? Math.min(normalizedDepth, MOBILE_MAX_INDENT_LEVEL) : normalizedDepth
  const rowIndent = BASE_PADDING + effectiveDepth * INDENT_PER_LEVEL
  const wireDepth = Math.max(0, effectiveDepth - 1)

  return {
    rowIndent,
    wireIndent: BASE_PADDING + wireDepth * INDENT_PER_LEVEL,
    childIndent: rowIndent,
  }
}
