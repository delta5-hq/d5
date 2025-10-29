import { CardContent } from '@shared/ui/card'
import React from 'react'
import type { WorkflowItem } from '@widgets/workflow/model'

interface WorkflowCardTitleProps {
  item: WorkflowItem
  // isPublic: boolean
}

export const WorkflowCardTitle: React.FC<WorkflowCardTitleProps> = ({ item }) => (
  <CardContent className="p-2">
    <div className="h-[85px]">
      <p className="text-left text-xl font-semibold leading-[1.5em] h-[4.5em] overflow-hidden text-ellipsis line-clamp-3">
        {item.title}
      </p>
    </div>
    {/* <div className="flex flex-row-reverse h-5">
      {!isPublic ? <SharedWithAvatars workflowId={item.workflowId} /> : null}
    </div> */}
    <div className="h-[5px]" />
  </CardContent>
)

export default WorkflowCardTitle
