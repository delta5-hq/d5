import React, { type CSSProperties, useRef, useCallback, useEffect } from 'react'
import { ChevronRight, Folder, FolderOpen, FileText } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import type { TreeRecord } from '../core/types'
import { useTreeAnimation } from '../context'
import '../styles/wire-tree.css'

export interface TreeNodeProps extends TreeRecord {
  style: CSSProperties
  onToggle?: (id: string) => void
  isSelected?: boolean
  onSelect?: (id: string) => void
}

/**
 * Wire-tree layout constants matching the original wire-tree plugin
 * - INDENT: horizontal space per depth level (where wire lives)
 * - ROW_HEIGHT: fixed height per row
 * - WIRE_PADDING: padding inside the wire SVG
 */
const INDENT_PER_LEVEL = 24
const ROW_HEIGHT = 32
const WIRE_PADDING = 2
const BASE_PADDING = 8

/**
 * Build L-shaped wire path matching wire-tree:
 * Starts at top of indent area, goes down to row center, then right to node
 * If hasMoreSiblings, also extend vertical line to bottom of row
 */
function buildLPath(indentX: number, rowHeight: number, indentWidth: number, extendDown: boolean): string {
  const startX = indentX + WIRE_PADDING
  const cornerY = rowHeight / 2
  const endX = indentX + indentWidth - WIRE_PADDING

  /* L-shape: top → center → right */
  let path = `M ${startX} 0 L ${startX} ${cornerY} L ${endX} ${cornerY}`

  /* If more siblings below, extend vertical line to bottom */
  if (extendDown) {
    path += ` M ${startX} ${cornerY} L ${startX} ${rowHeight}`
  }

  return path
}

/**
 * Build vertical continuation line for ancestor levels
 * These are straight vertical lines where an ancestor has more siblings
 */
function buildContinuationLines(
  ancestorContinuation: boolean[],
  rowHeight: number,
): Array<{ x: number; path: string }> {
  const lines: Array<{ x: number; path: string }> = []

  ancestorContinuation.forEach((needsContinuation, depthIndex) => {
    if (needsContinuation) {
      const x = BASE_PADDING + depthIndex * INDENT_PER_LEVEL + WIRE_PADDING
      lines.push({
        x,
        path: `M ${x} 0 L ${x} ${rowHeight}`,
      })
    }
  })

  return lines
}

/** Trigger wire pulse + spark animation */
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

export const TreeNodeDefault = ({ id, data, isOpen, style, onToggle, isSelected, onSelect }: TreeNodeProps) => {
  const { node, depth, ancestorContinuation = [], hasMoreSiblings = false } = data
  const hasChildren = node.children && node.children.length > 0
  const paddingLeft = BASE_PADDING + depth * INDENT_PER_LEVEL
  const sparkRef = useRef<HTMLDivElement>(null)
  const wireRef = useRef<SVGPathElement>(null)
  const { shouldAnimate, clearAnimation } = useTreeAnimation()

  /* Auto-trigger animation if this node was scheduled (parent just expanded) */
  useEffect(() => {
    if (depth > 0 && shouldAnimate(id)) {
      /* Stagger based on depth for cascading effect */
      const delay = depth * 50
      const timer = setTimeout(() => {
        triggerAnimation(wireRef.current, sparkRef.current)
        clearAnimation(id)
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [id, depth, shouldAnimate, clearAnimation])

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()

      /* Pulse wire + spark animation for this node */
      triggerAnimation(wireRef.current, sparkRef.current)

      onToggle?.(id)
    },
    [id, onToggle],
  )

  const handleClick = useCallback(() => {
    onSelect?.(id)
  }, [id, onSelect])

  /* Calculate wire position: lives in the indent space before this node's content */
  const wireIndentX = BASE_PADDING + (depth - 1) * INDENT_PER_LEVEL
  const wirePath = depth > 0 ? buildLPath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, hasMoreSiblings) : ''

  /* Ancestor continuation lines (vertical lines for ancestors that have more siblings) */
  const continuationLines = depth > 0 ? buildContinuationLines(ancestorContinuation, ROW_HEIGHT) : []

  /* Combined path for spark to travel (only the L-shape portion, not continuations) */
  const sparkPath =
    depth > 0 ? buildLPath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, false /* spark doesn't travel down */) : ''

  return (
    <div
      className={cn(
        'group relative flex items-center h-8 cursor-pointer select-none',
        'hover:bg-accent/50 active:bg-accent/70 transition-colors duration-150',
        'text-sm text-foreground/90',
        isSelected && 'bg-accent',
      )}
      onClick={handleClick}
      style={{ ...style, paddingLeft }}
    >
      {/* Wire connectors SVG: L-shape + vertical continuation lines */}
      {depth > 0 ? (
        <svg
          className="absolute pointer-events-none"
          height={ROW_HEIGHT}
          style={{ left: 0, top: 0, overflow: 'visible' }}
          width={paddingLeft}
        >
          {/* Ancestor continuation lines */}
          {continuationLines.map((line, i) => (
            <path className="wire-tree-connector" d={line.path} key={`cont-${i}`} />
          ))}
          {/* Main L-shaped connector for this node */}
          <path className="wire-tree-connector" d={wirePath} ref={wireRef} />
        </svg>
      ) : null}

      {/* Spark element - travels along L-shaped wire path */}
      {depth > 0 ? (
        <div className="wire-tree-spark" ref={sparkRef} style={{ offsetPath: `path('${sparkPath}')` }} />
      ) : null}

      {/* Chevron toggle */}
      <button
        className={cn(
          'relative z-10 w-5 h-5 flex items-center justify-center rounded-sm',
          'text-muted-foreground hover:text-foreground hover:bg-accent',
          'transition-all duration-150',
          !hasChildren && 'invisible',
        )}
        onClick={handleToggle}
        type="button"
      >
        <ChevronRight className={cn('w-3.5 h-3.5 transition-transform duration-200 ease-out', isOpen && 'rotate-90')} />
      </button>

      {/* Folder/File icon */}
      <span className="relative z-10 flex-shrink-0 ml-1 transition-transform duration-150 group-hover:scale-110">
        {hasChildren ? (
          isOpen ? (
            <FolderOpen className="w-4 h-4 text-amber-500" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500/80" />
          )
        ) : (
          <FileText className="w-4 h-4 text-muted-foreground" />
        )}
      </span>

      {/* Label */}
      <span className="relative z-10 flex-1 truncate ml-1.5 pr-2">{node.title || node.id}</span>
    </div>
  )
}
