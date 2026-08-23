import { ChevronRight, Plus } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useIntl } from 'react-intl'
import { cn } from '@shared/lib/utils'
import { Genie } from '@shared/ui/genie'
import { useGenieState } from '@shared/lib/use-genie-state'
import { isCommandlessTextNode, normalizeNodeTitle } from '@entities/workflow/lib'
import type { NodeData } from '@shared/base-types'
import { NodeTitleEditor } from './node-title-editor'
import { DirtyIndicator } from './dirty-indicator'

interface WorkflowRootHeaderProps {
  rootId: string
  rootNode: NodeData | undefined
  isOpen: boolean
  isSelected: boolean
  isDirty: boolean
  isSaving: boolean
  autoEdit: boolean
  onToggle: () => void
  onSelect: (event: MouseEvent<HTMLDivElement>) => void
  onAddChild: () => void
  onRename: (newTitle: string) => void
}

export const WorkflowRootHeader = ({
  rootId,
  rootNode,
  isOpen,
  isSelected,
  isDirty,
  isSaving,
  autoEdit,
  onToggle,
  onSelect,
  onAddChild,
  onRename,
}: WorkflowRootHeaderProps) => {
  const { formatMessage } = useIntl()
  const genieState = useGenieState(rootId)
  const canExpand = rootNode ? (rootNode.children?.length ?? 0) > 0 || isCommandlessTextNode(rootNode) : false
  const title = normalizeNodeTitle(rootNode?.title)

  return (
    <div className="flex min-w-0 items-center justify-between gap-2" data-testid="workflow-root-header">
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1 rounded-lg transition-colors',
          isSelected && 'bg-accent/20 ring-1 ring-inset ring-accent/50',
        )}
        data-node-depth="0"
        data-node-id={rootId}
        data-node-selected={isSelected || undefined}
        onClick={onSelect}
      >
        <button
          aria-expanded={isOpen}
          aria-label={formatMessage({ id: 'workflowTree.node.expandCollapse' })}
          className={cn(
            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
            'text-muted-foreground hover:bg-accent/20 hover:text-foreground',
            'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            !canExpand && 'invisible',
          )}
          data-testid="root-toggle"
          onClick={event => {
            event.stopPropagation()
            onToggle()
          }}
          type="button"
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform duration-200 ease-out', isOpen && 'rotate-90')} />
        </button>
        <Genie className="flex-shrink-0" size={24} state={genieState} variant="clipboard-eyes" />
        <NodeTitleEditor
          autoFocus={autoEdit}
          className="min-w-0 flex-1 text-sm font-bold"
          displayValue={title}
          editClassName="box-border h-7 min-h-7 max-h-20 !w-full !min-w-0 !max-w-full resize-none overflow-y-auto whitespace-pre-wrap rounded-md border-primary/40 bg-background px-1 py-1 text-sm font-bold leading-5 shadow-none"
          onChange={onRename}
          readOnlyClassName="block min-w-0 max-w-full truncate whitespace-nowrap border-0 bg-transparent px-1 py-0 leading-5 hover:border-transparent hover:bg-transparent"
          value={title}
        />
      </div>
      <button
        className={cn(
          'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          'text-muted-foreground hover:bg-accent/20 hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
        data-testid="root-add-child"
        onClick={event => {
          event.stopPropagation()
          onAddChild()
        }}
        title={formatMessage({ id: 'workflowTree.node.addChild' })}
        type="button"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <DirtyIndicator className="flex-shrink-0" isDirty={isDirty} isSaving={isSaving} />
    </div>
  )
}
