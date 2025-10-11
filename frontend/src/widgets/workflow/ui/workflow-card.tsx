import { Card, CardContent, CardFooter, CardHeader } from '@shared/ui/card'
import type React from 'react'
import { useNavigate } from 'react-router-dom'
import { concatPathAnchor } from '../lib/concatPathAnchor'
import type { WorkflowItem } from '../model'
import { Avatar, AvatarFallback } from '@shared/ui/avatar'
import UpdatedTime from './workflow-card/updated-time'
import { Badge } from '@shared/ui/badge'
import WorkflowCardTitle from './workflow-card/workflow-card-title'
import { Visibility } from './workflow-card/visibility'
import { MorePopover } from './workflow-card/more-popover'
import { WorkflowCategory } from './workflow-card/workflow-category'
import { Inbox } from 'lucide-react'
import { FormattedMessage } from 'react-intl'

interface WorkflowCardSkeletonProps {
  count?: number
}

const WorkflowCardSkeleton: React.FC<WorkflowCardSkeletonProps> = ({ count = 12 }) => (
  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    {Array.from({ length: count }).map((_, idx) => (
      <Card className="flex flex-col justify-between animate-pulse" glassEffect={false} key={idx}>
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-4">
          <div className="flex items-center gap-2">
            {/* Avatar */}
            <span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full">
              <span className="flex h-full w-full items-center justify-center rounded-full bg-muted" />
            </span>
            <div className="flex flex-col gap-1">
              <div className="w-16 h-3 bg-gray-300 rounded" /> {/* username */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground truncate max-w-[40vw]">
                <span className="w-4 h-4 bg-gray-300 rounded" /> {/* icon */}
                <span className="w-12 h-2 bg-gray-200 rounded" /> {/* time */}
              </div>
            </div>
          </div>
        </CardHeader>

        <hr className="h-1" />

        {/* Content */}
        <CardContent className="cursor-pointer p-2 flex-1 flex flex-col">
          <div className="p-2 w-full">
            <div className="h-[85px]">
              <div className="w-full h-6 bg-gray-300 rounded mb-1" />
              <div className="w-full h-6 bg-gray-300 rounded mb-1" />
              <div className="w-2/3 h-6 bg-gray-300 rounded" />
            </div>
            <div className="h-[5px]" />
          </div>
        </CardContent>

        {/* Footer */}
        <CardFooter className="flex justify-between items-center p-2 h-10">
          <div className="inline-flex items-center w-16 h-5 rounded-md bg-gray-300" />
        </CardFooter>
      </Card>
    ))}
  </div>
)

interface WorkflowCardProps {
  workflows: WorkflowItem[]
  isPublic: boolean
  isLoading?: boolean
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({ workflows, isPublic, isLoading }) => {
  const navigate = useNavigate()

  const openNewTab = (item: WorkflowItem) => {
    window.open(concatPathAnchor(`/workflow/${item.workflowId}`, item.title))
  }

  const openSameTab = (item: WorkflowItem) => {
    navigate(concatPathAnchor(`/workflow/${item.workflowId}`, item.title))
  }

  if (isLoading) {
    return <WorkflowCardSkeleton />
  }

  if (!workflows.length) {
    return (
      <Card
        className="flex flex-col items-center justify-center p-8 text-center border-dashed border-2 border-muted"
        glassEffect={false}
      >
        <CardContent className="flex flex-col items-center gap-4">
          <Inbox className="w-12 h-12 text-card-foreground" />
          <p className="text-card-foreground">
            <FormattedMessage id="noWorkflowsYet" />
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {workflows.map(item => (
        <Card className="flex flex-col justify-between" glassEffect={false} key={item.workflowId}>
          <CardHeader className="flex flex-row items-cemter justify-between space-y-0 p-2 pb-4">
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarFallback>{item.userId.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <p>@{item.userId}</p>
                <UpdatedTime updatedAt={item.updatedAt} />
              </div>
            </div>

            {!isPublic ? (
              <div className="flex flex-col justify-center gap-y-2">
                <MorePopover workflow={item} />
                <Visibility isPublic={isPublic} item={item} />
              </div>
            ) : null}
          </CardHeader>

          <hr className="h-1" />

          <CardContent
            className="cursor-pointer p-2 flex-1 flex items-center"
            onAuxClick={() => openNewTab(item)}
            onClick={() => openSameTab(item)}
          >
            <WorkflowCardTitle item={item} />
          </CardContent>

          <CardFooter className="flex justify-between items-center p-2 h-10">
            {isPublic ? (
              item.category ? (
                <Badge variant="default">{item.category}</Badge>
              ) : null
            ) : (
              <WorkflowCategory workflow={item} />
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
