import React, { useRef, useCallback, useEffect, memo, useState } from 'react'
import { ChevronRight, Folder, FolderOpen, FileText, Plus, Copy, Trash2, PackagePlus } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { useGenieState } from '@shared/lib/use-genie-state'
import { Genie, type GenieRef } from '@shared/ui/genie'
import { EditableTextArea } from '@shared/ui/editable-field'
import { useAliases } from '@entities/aliases'
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '@shared/ui/context-menu'
import { FormattedMessage, useIntl } from 'react-intl'
import { isCommandlessTextNode, normalizeNodeTitle } from '@entities/workflow/lib'
import { useViewportBreakpoint } from '@shared/composables/use-viewport-breakpoint'
import type { TreeNodeProps } from '../core/types'
import { INDENT_PER_LEVEL, ROW_HEIGHT, WIRE_PADDING, BASE_PADDING } from '../core/constants'
import type { TreeDropPosition } from '../core/tree-drag'
import { getTreeIndentLayout } from '../core/tree-layout'
import { areTreeNodePropsEqual } from '../core/tree-node-memo'
import { useTreeAnimation } from '../context'
import { useIsNodeDirty } from '../store/workflow-selectors'
import { getNodeGeniePresentation } from '../lib/node-genie-presenter'
import { CommandChip, ScriptTitleIcon, truncateTitleForChip } from './command-node-chip'
import '../styles/wire-tree.css'

export type { TreeNodeProps }

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

/* Ancestor continuation lines — vertical │ at each ancestor's wire column where that ancestor has more siblings.
 * ancestorContinuation[k] = hasMoreSiblings of ancestor at depth k.
 * Wire column for depth k = BASE_PADDING + (k-1) * INDENT_PER_LEVEL + WIRE_PADDING (depth 0 has no wire). */
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

function triggerAnimation(wireEl: SVGPathElement | null, sparkEl: HTMLDivElement | null, durationMs: number) {
  if (wireEl) {
    wireEl.style.setProperty('--wire-tree-pulse-duration', `${Math.min(600, durationMs)}ms`)
    wireEl.classList.remove('wire-tree-connector--pulse')
    void wireEl.getBBox()
    wireEl.classList.add('wire-tree-connector--pulse')
  }
  if (sparkEl) {
    sparkEl.style.setProperty('--wire-tree-spark-duration', `${durationMs}ms`)
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
  onRename,
  autoEditNodeId,
  wireExtendDown = 0,
  wireExtendUp = 0,
  onAddChild,
  onAddSibling,
  onDelete,
  onDuplicateNode,
  onWrapNodes,
  onToggleChecked,
  onDragHoverNode,
  onDragLeaveNode,
  onPointerDragStartNode,
  onDropFiles,
  activeDropTargetId,
  activeDropPosition,
}: TreeNodeProps) => {
  const {
    node,
    depth,
    isPrompt,
    ancestorContinuation = [],
    hasMoreSiblings = false,
    rowsFromParent = 1,
    sparkDelay = 0,
  } = data
  const hasChildren = node.children && node.children.length > 0
  const canExpand = hasChildren || isCommandlessTextNode(node)
  const isCompactTreeLayout = useViewportBreakpoint(640)
  const { rowIndent, wireIndent, childIndent } = getTreeIndentLayout(depth, isCompactTreeLayout)
  const isRoot = depth === 0

  const { aliases } = useAliases()
  const rowRef = useRef<HTMLDivElement>(null)
  const sparkRef = useRef<HTMLDivElement>(null)
  const genieRef = useRef<GenieRef>(null)
  const genieState = useGenieState(id)
  const isDirty = useIsNodeDirty(id)
  const wireRef = useRef<SVGPathElement>(null)
  const { shouldAnimate, getStartDelay, getRemainingDuration, animationVersion, clearAnimation, consumeNewNodeFlash } =
    useTreeAnimation()
  const { formatMessage } = useIntl()
  const [nativeDropPosition, setNativeDropPosition] = useState<TreeDropPosition | undefined>()
  const dropPosition = activeDropTargetId === id ? activeDropPosition : nativeDropPosition

  useEffect(() => {
    if (depth > 0 && shouldAnimate(id)) {
      const delay = getStartDelay(id)
      const timer = setTimeout(() => {
        const remainingDuration = getRemainingDuration(id)
        if (remainingDuration <= 0) {
          clearAnimation(id)
          return
        }
        triggerAnimation(wireRef.current, sparkRef.current, remainingDuration)
        genieRef.current?.flash()
        clearAnimation(id)
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [id, depth, sparkDelay, animationVersion, shouldAnimate, getStartDelay, getRemainingDuration, clearAnimation])

  useEffect(() => {
    if (consumeNewNodeFlash(id) && rowRef.current) {
      rowRef.current.classList.add('wire-tree-node--created')
      const timer = setTimeout(() => rowRef.current?.classList.remove('wire-tree-node--created'), 500)
      return () => clearTimeout(timer)
    }
  }, [id, consumeNewNodeFlash])

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggle?.(id)
    },
    [id, onToggle],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      genieRef.current?.flash()
      onSelect?.(id, e)
    },
    [id, onSelect],
  )

  const handleAddChild = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onAddChild?.(id)
    },
    [id, onAddChild],
  )

  const handleAddSibling = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onAddSibling?.(id)
    },
    [id, onAddSibling],
  )

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDelete?.(id)
    },
    [id, onDelete],
  )

  const handleRename = useCallback(
    (newTitle: string) => {
      onRename?.(id, newTitle)
    },
    [id, onRename],
  )

  const handleToggleChecked = useCallback(
    (e: React.SyntheticEvent) => {
      e.stopPropagation()
      onToggleChecked?.(id)
    },
    [id, onToggleChecked],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const transferTypes = Array.from(e.dataTransfer.types)
      if (!onDropFiles || !transferTypes.includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setNativeDropPosition('inside')
      onDragHoverNode?.(id)
    },
    [id, onDragHoverNode, onDropFiles],
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const nextTarget = e.relatedTarget
      if (nextTarget instanceof Node && e.currentTarget.contains(nextTarget)) return
      setNativeDropPosition(undefined)
      onDragLeaveNode?.(id)
    },
    [id, onDragLeaveNode],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
      const target = e.target
      if (
        isRoot ||
        e.button !== 0 ||
        (target instanceof HTMLElement &&
          Boolean(target.closest('button,input,textarea,[role="menuitem"],[data-editable-field]')))
      ) {
        return
      }
      onPointerDragStartNode?.(id, e)
    },
    [id, isRoot, onPointerDragStartNode],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (e.dataTransfer.files.length > 0 && onDropFiles) {
        e.preventDefault()
        e.stopPropagation()
        setNativeDropPosition(undefined)
        onDragLeaveNode?.(id)
        onDropFiles(id, e.dataTransfer.files)
      }
    },
    [id, onDragLeaveNode, onDropFiles],
  )

  const wireIndentX = wireIndent
  const isExpandedWithChildren = Boolean(isOpen && hasChildren)

  const wirePath =
    depth > 0
      ? buildWirePath(wireIndentX, ROW_HEIGHT, rowIndent - wireIndentX, rowsFromParent, hasMoreSiblings, wireExtendDown)
      : ''

  const childConnectorPath = isExpandedWithChildren
    ? buildChildConnectorPath(childIndent, ROW_HEIGHT, wireExtendDown)
    : ''

  const continuationLines =
    depth > 0 ? buildContinuationLines(ancestorContinuation, ROW_HEIGHT, wireExtendUp, wireExtendDown) : []

  const sparkPath = depth > 0 ? buildSparkPath(wireIndentX, ROW_HEIGHT, INDENT_PER_LEVEL, rowsFromParent) : ''

  const normalizedTitle = normalizeNodeTitle(node.title)
  const displayedTitle = truncateTitleForChip(normalizedTitle)
  const geniePresentation = getNodeGeniePresentation(node, { aliases, depth })
  const showThoughtTail = depth > 0 && depth <= 4 && geniePresentation.variant === 'full'

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'workflow-tree-node-row group relative flex h-12 cursor-pointer select-none items-center rounded-full border border-transparent',
            'hover:border-accent/30 hover:bg-accent/20 active:bg-accent/30',
            'transition-colors duration-150',
            !isRoot && 'cursor-grab active:cursor-grabbing',
            'text-sm text-foreground/90',
            isSelected && 'border-accent/50 bg-accent/20 ring-1 ring-inset ring-accent/50',
            isPrompt && 'opacity-60',
          )}
          data-genie-state={genieState}
          data-node-depth={depth}
          data-node-drop-position={dropPosition}
          data-node-id={id}
          data-node-selected={isSelected || undefined}
          data-prompt-node={isPrompt || undefined}
          onClick={handleClick}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onMouseDown={handlePointerDown}
          onPointerDown={handlePointerDown}
          ref={rowRef}
          style={{ ...style, paddingLeft: rowIndent, overflow: 'visible' }}
        >
          {depth > 0 ? (
            <svg
              className="absolute pointer-events-none"
              height={ROW_HEIGHT}
              style={{ left: 0, top: 0, overflow: 'visible' }}
              width={rowIndent}
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
              width={rowIndent}
            >
              <path className="wire-tree-connector" d={childConnectorPath} />
            </svg>
          ) : null}

          {depth > 0 ? (
            <div className="wire-tree-spark" ref={sparkRef} style={{ offsetPath: `path('${sparkPath}')` }} />
          ) : null}

          {dropPosition ? (
            <span
              aria-hidden="true"
              className="workflow-tree-drop-marker"
              data-drop-position={dropPosition}
              data-testid="tree-drop-marker"
            />
          ) : null}

          {onToggleChecked ? (
            <input
              aria-label="Toggle node selection"
              checked={!!node.checked}
              className="relative z-10 h-4 w-4 flex-shrink-0 cursor-pointer rounded border border-input accent-primary transition-shadow checked:ring-2 checked:ring-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="node-checkbox"
              onChange={handleToggleChecked}
              onClick={e => e.stopPropagation()}
              type="checkbox"
            />
          ) : null}

          <button
            className={cn(
              'relative z-10 flex h-6 w-6 items-center justify-center rounded-full',
              'text-muted-foreground hover:bg-accent/20 hover:text-foreground',
              'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              !canExpand && 'invisible',
            )}
            data-testid="node-toggle"
            onClick={handleToggle}
            type="button"
          >
            <ChevronRight className={cn('w-4 h-4 transition-transform duration-200 ease-out', isOpen && 'rotate-90')} />
          </button>

          <span className="workflow-tree-node-icon relative z-10 flex-shrink-0 ml-1.5 transition-transform duration-150 group-hover:scale-110">
            {depth > 0 && depth <= 4 ? (
              <Genie
                color={geniePresentation.color}
                nodeId={id}
                ref={genieRef}
                showHandRibs={geniePresentation.showHandRibs}
                size={32}
                state={genieState}
                variant={geniePresentation.variant}
              />
            ) : hasChildren ? (
              isOpen ? (
                <FolderOpen className="h-5 w-5 text-accent" />
              ) : (
                <Folder className="h-5 w-5 text-accent/80" />
              )
            ) : (
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
          </span>

          {showThoughtTail ? (
            <span aria-hidden="true" className="workflow-tree-thought-tail" data-testid="node-thought-tail">
              <svg aria-hidden="true" className="h-3.5 w-4" fill="none" viewBox="0 0 16 14">
                <circle cx="4" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="13" cy="6.5" r="2.6" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </span>
          ) : null}

          <span
            className={cn(
              'workflow-tree-chip-strip relative z-10 flex min-w-0 flex-1 items-center gap-2 overflow-hidden pr-2',
              showThoughtTail ? 'ml-0' : 'ml-2',
            )}
          >
            <CommandChip aliases={aliases} command={node.command} />
            <span
              className="workflow-tree-title-chip relative isolate flex h-7 min-w-0 flex-1 items-center gap-1.5 overflow-hidden rounded-full border border-muted-foreground/25 px-2.5 font-medium text-foreground shadow-none ring-1 ring-inset ring-background/80 transition-shadow duration-150 focus-within:border-ring focus-within:ring-ring"
              data-chip-kind="title"
              data-testid="node-chip-title"
              title={normalizedTitle}
            >
              <ScriptTitleIcon />
              {onRename ? (
                <EditableTextArea
                  autoFocus={autoEditNodeId === id}
                  className="min-w-0 flex-1 text-sm font-medium"
                  displayValue={displayedTitle}
                  editClassName="box-border h-7 min-h-7 max-h-20 !w-full !min-w-0 !max-w-full resize-none overflow-y-auto whitespace-pre-wrap rounded-full border-primary/40 bg-background px-2.5 py-1 leading-5 shadow-none"
                  onChange={handleRename}
                  placeholder={formatMessage({ id: 'workflowTree.node.untitled' })}
                  readOnlyClassName="block min-w-0 max-w-full truncate whitespace-nowrap border-0 bg-transparent px-0 py-0 leading-5 hover:border-transparent hover:bg-transparent"
                  title={formatMessage({ id: 'workflowTree.node.editHint' })}
                  value={normalizedTitle}
                />
              ) : (
                displayedTitle || node.id
              )}
            </span>
            {isDirty ? (
              <span
                aria-label={formatMessage({ id: 'workflowTree.status.unsaved' })}
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"
                data-testid="node-dirty-indicator"
              />
            ) : null}
          </span>

          {onAddChild ? (
            <button
              className={cn(
                'workflow-tree-row-action workflow-tree-row-action--add relative z-10 flex h-6 w-6 items-center justify-center rounded-full',
                'text-muted-foreground hover:bg-accent/20 hover:text-foreground',
                'pointer-events-none group-hover:pointer-events-auto focus-visible:pointer-events-auto opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
              data-testid="node-add-child"
              onClick={handleAddChild}
              title={formatMessage({ id: 'workflowTree.node.addChild' })}
              type="button"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          ) : null}

          {onDelete && !isRoot ? (
            <button
              className={cn(
                'workflow-tree-row-action workflow-tree-row-action--delete relative z-10 mr-1 flex h-6 w-6 items-center justify-center rounded-full',
                'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
                'pointer-events-none group-hover:pointer-events-auto focus-visible:pointer-events-auto opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
              data-testid="node-delete"
              onClick={handleDelete}
              title={formatMessage({ id: 'delete' })}
              type="button"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem disabled={isRoot} onClick={handleAddSibling}>
          <Plus className="mr-2 h-4 w-4" />
          <FormattedMessage id="workflowTree.node.addSibling" />
        </ContextMenuItem>
        <ContextMenuItem disabled={isRoot} onClick={() => onDuplicateNode?.(id)}>
          <Copy className="mr-2 h-4 w-4" />
          <FormattedMessage id="workflowTree.node.duplicate" />
        </ContextMenuItem>
        <ContextMenuItem disabled={isRoot} onClick={() => onWrapNodes?.(id)}>
          <PackagePlus className="mr-2 h-4 w-4" />
          <FormattedMessage id="workflowTree.node.wrapInCard" />
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export const MemoizedTreeNodeDefault = memo(TreeNodeDefault, areTreeNodePropsEqual)
