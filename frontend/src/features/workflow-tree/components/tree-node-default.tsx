import React, { type CSSProperties, useRef, useCallback, useEffect } from 'react'
import { ChevronRight, Folder, FolderOpen, FileText } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { Genie } from '@shared/ui/genie'
import type { TreeRecord } from '../core/types'
import { useTreeAnimation } from '../context'
import '../styles/wire-tree.css'

export interface TreeNodeProps extends TreeRecord {
  style: CSSProperties
  onToggle?: (id: string) => void
  isSelected?: boolean
  onSelect?: (id: string) => void
  /** Current row index in the virtualized list */
  rowIndex?: number
  /** Extra space to extend wire DOWN (e.g., for container paddingTop after parent) */
  wireExtendDown?: number
  /** Extra space to extend wire UP (e.g., for first child in container) */
  wireExtendUp?: number
}

/* Wire-tree layout constants */
const INDENT_PER_LEVEL = 32
const ROW_HEIGHT = 48
const WIRE_PADDING = 2
const BASE_PADDING = 12

/* Build wire path starting from parent center (matches spark path) */
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

/* Build child connector at children's depth level */
function buildChildConnectorPath(childIndentX: number, rowHeight: number, extendDown: number = 0): string {
  const x = childIndentX + WIRE_PADDING
  const centerY = rowHeight / 2
  const bottomY = rowHeight + extendDown
  return `M ${x} ${centerY} L ${x} ${bottomY}`
}

/* Build spark animation path from parent center to node */
function buildSparkPath(indentX: number, rowHeight: number, indentWidth: number, rowsFromParent: number): string {
  const startX = indentX + WIRE_PADDING
  const parentCenterY = -(rowsFromParent * rowHeight) + rowHeight / 2
  const cornerY = rowHeight / 2
  const endX = indentX + indentWidth - WIRE_PADDING
  return `M ${startX} ${parentCenterY} L ${startX} ${cornerY} L ${endX} ${cornerY}`
}

/* Build ancestor continuation lines - truncates deepest at center for last child */
function buildContinuationLines(
  ancestorContinuation: boolean[],
  rowHeight: number,
  extendUp: number = 0,
  extendDown: number = 0,
  hasMoreSiblings: boolean = true,
): Array<{ x: number; path: string }> {
  const lines: Array<{ x: number; path: string }> = []
  const lastIndex = ancestorContinuation.length - 1

  ancestorContinuation.forEach((needsContinuation, depthIndex) => {
    if (needsContinuation) {
      const x = BASE_PADDING + depthIndex * INDENT_PER_LEVEL + WIRE_PADDING
      const topY = -extendUp
      const centerY = rowHeight / 2

      const isDeepestContinuation = depthIndex === lastIndex
      const bottomY = isDeepestContinuation && !hasMoreSiblings ? centerY : rowHeight + extendDown

      lines.push({
        x,
        path: `M ${x} ${topY} L ${x} ${bottomY}`,
      })
    }
  })

  return lines
}

function triggerAnimation(wireEl: SVGPathElement | null, sparkEl: HTMLDivElement | null) {
  if (wireEl) {
    wireEl.classList.remove('wire-tree-connector--pulse')
    void wireEl.getBBox()
    wireEl.classList.add('wire-tree-connector--pulse')
  }
  if (sparkEl) {
    sparkEl.classList.remove('wire-tree-spark--active')
    void sparkEl.offsetWidth
    sparkEl.classList.add('wire-tree-spark--active')
  }
}

export const TreeNodeDefault = ({
  id,
  data,
  isOpen,
  style,
  onToggle,
  isSelected,
  onSelect,
  rowIndex,
  wireExtendDown = 0,
  wireExtendUp = 0,
}: TreeNodeProps) => {
  const { node, depth, ancestorContinuation = [], hasMoreSiblings = false, parentRowIndex = -1 } = data
  const hasChildren = node.children && node.children.length > 0
  const paddingLeft = BASE_PADDING + depth * INDENT_PER_LEVEL
  const sparkRef = useRef<HTMLDivElement>(null)
  const wireRef = useRef<SVGPathElement>(null)
  const { shouldAnimate, clearAnimation, animationVersion } = useTreeAnimation()

  const currentRowIndex = rowIndex ?? 0
  const rowsFromParent = parentRowIndex >= 0 ? currentRowIndex - parentRowIndex : 1

  /* Auto-trigger animation for descendants on parent expansion */
  useEffect(() => {
    if (depth > 0 && shouldAnimate(id)) {
      const delay = depth * 50
      const timer = setTimeout(() => {
        triggerAnimation(wireRef.current, sparkRef.current)
        clearAnimation(id)
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [id, depth, shouldAnimate, clearAnimation, animationVersion])

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggle?.(id)
    },
    [id, onToggle],
  )

  const handleClick = useCallback(() => {
    onSelect?.(id)
  }, [id, onSelect])

  const wireIndentX = BASE_PADDING + (depth - 1) * INDENT_PER_LEVEL
  const isExpandedWithChildren = Boolean(isOpen && hasChildren)

  const wirePath =
    depth > 0
      ? buildWirePath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, rowsFromParent, hasMoreSiblings, wireExtendDown)
      : ''

  const childIndentX = BASE_PADDING + depth * INDENT_PER_LEVEL
  const childConnectorPath = isExpandedWithChildren
    ? buildChildConnectorPath(childIndentX, ROW_HEIGHT, wireExtendDown)
    : ''

  const continuationLines =
    depth > 0
      ? buildContinuationLines(ancestorContinuation, ROW_HEIGHT, wireExtendUp, wireExtendDown, hasMoreSiblings)
      : []

  const sparkPath = depth > 0 ? buildSparkPath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, rowsFromParent) : ''

  return (
    <div
      className={cn(
        'group relative flex items-center h-12 cursor-pointer select-none',
        'hover:bg-accent/50 active:bg-accent/70 transition-colors duration-150',
        'text-sm text-foreground/90',
        isSelected && 'bg-accent',
      )}
      onClick={handleClick}
      style={{ ...style, paddingLeft, overflow: 'visible' }}
    >
      {depth > 0 ? (
        <svg
          className="absolute pointer-events-none"
          height={ROW_HEIGHT}
          style={{ left: 0, top: 0, overflow: 'visible' }}
          width={paddingLeft}
        >
          {continuationLines.map((line, i) => (
            <path className="wire-tree-connector" d={line.path} key={`cont-${i}`} />
          ))}
          <path className="wire-tree-connector" d={wirePath} ref={wireRef} />
          {childConnectorPath ? <path className="wire-tree-connector" d={childConnectorPath} /> : null}
        </svg>
      ) : childConnectorPath ? (
        <svg
          className="absolute pointer-events-none"
          height={ROW_HEIGHT}
          style={{ left: 0, top: 0, overflow: 'visible' }}
          width={paddingLeft}
        >
          <path className="wire-tree-connector" d={childConnectorPath} />
        </svg>
      ) : null}

      {depth > 0 ? (
        <div className="wire-tree-spark" ref={sparkRef} style={{ offsetPath: `path('${sparkPath}')` }} />
      ) : null}

      <button
        className={cn(
          'relative z-10 w-6 h-6 flex items-center justify-center rounded-sm',
          'text-muted-foreground hover:text-foreground hover:bg-accent',
          'transition-all duration-150',
          !hasChildren && 'invisible',
        )}
        onClick={handleToggle}
        type="button"
      >
        <ChevronRight className={cn('w-4 h-4 transition-transform duration-200 ease-out', isOpen && 'rotate-90')} />
      </button>

      <span className="relative z-10 flex-shrink-0 ml-1.5 transition-transform duration-150 group-hover:scale-110">
        {depth === 1 ? (
          <Genie size={32} variant="base" />
        ) : depth === 2 ? (
          <Genie size={32} variant="eyes" />
        ) : depth === 3 ? (
          <Genie size={32} variant="eyes-flash" />
        ) : hasChildren ? (
          isOpen ? (
            <FolderOpen className="w-5 h-5 text-amber-500" />
          ) : (
            <Folder className="w-5 h-5 text-amber-500/80" />
          )
        ) : (
          <FileText className="w-5 h-5 text-muted-foreground" />
        )}
      </span>

      <span className="relative z-10 flex-1 truncate ml-2 pr-2">{node.title || node.id}</span>
    </div>
  )
}
