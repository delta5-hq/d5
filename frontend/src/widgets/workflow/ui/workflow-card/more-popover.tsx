import React, { useState } from 'react'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Button } from '@shared/ui/button'
import { MoreHorizontal, Eye, Download, Trash2, FolderPlus } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { useDialog } from '@entities/dialog'
import WorkflowVisibilityDialog from './workflow-visibility-dialog'
import { API_BASE_PATH } from '@shared/config'
import DeleteWorkflowDialog from './delete-workflow-dialog'
import type { WorkflowItem } from '@widgets/workflow/model'
import { WorkflowCategoryDialog } from './workflow-category'

interface MorePopoverProps {
  workflow: WorkflowItem
}

export const MorePopover: React.FC<MorePopoverProps> = ({ workflow }) => {
  const { showDialog } = useDialog()
  const [open, setOpen] = useState(false)

  const items = [
    {
      icon: <Eye className="h-5 w-5" />,
      labelId: 'menuVisibility',
      onClick: () => showDialog(WorkflowVisibilityDialog, { workflowId: workflow.workflowId }),
    },
    {
      icon: <Download className="h-5 w-5" />,
      labelId: 'menuExportWorkflow',
      href: `${API_BASE_PATH}/workflow/${workflow.workflowId}/export`,
      download: true,
    },
    {
      icon: <Trash2 className="h-5 w-5" />,
      labelId: 'menuDeleteWorkflow',
      onClick: () => {
        showDialog(DeleteWorkflowDialog, { id: workflow.workflowId, title: workflow.title })
      },
    },
    {
      icon: <FolderPlus className="h-5 w-5" />,
      labelId: 'workflowAddCategoryLabel',
      onClick: () => {
        showDialog(WorkflowCategoryDialog, { workflow })
      },
    },
  ]

  return (
    <Popover onOpenChange={o => setOpen(o)} open={open}>
      <PopoverTrigger
        asChild
        className="border-0 !h-4"
        onClick={e => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <Button size="icon" variant="ghost">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col">
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              {item.href ? (
                <a
                  className="flex items-center gap-2 px-4 py-2 hover:bg-muted/20"
                  download={item.download}
                  href={item.href}
                >
                  {item.icon}
                  <span className="text-sm">
                    <FormattedMessage id={item.labelId} />
                  </span>
                </a>
              ) : (
                <div
                  className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-muted/20"
                  onClick={item.onClick}
                >
                  {item.icon}
                  <span className="text-sm">
                    <FormattedMessage id={item.labelId} />
                  </span>
                </div>
              )}
              {idx < items.length - 1 ? <div className="border-t border-muted/40" /> : null}
            </React.Fragment>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
