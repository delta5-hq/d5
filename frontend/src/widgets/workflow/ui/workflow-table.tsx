import { AgoMoment } from '@shared/ui/ago-moment'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table'
import React, { useCallback } from 'react'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import type { WorkflowItem } from '../model'
import { MorePopover } from './workflow-card/more-popover'
import { WorkflowShareBadge } from './workflow-card/workflow-share-badge'

interface WorkflowTableProps {
  data: WorkflowItem[]
  isPublic?: boolean
}

const Title: React.FC<{ workflow: WorkflowItem; isPublic?: boolean }> = ({ workflow, isPublic }) => (
  <div className="flex items-center gap-2">
    <span>{workflow.title}</span>
    {!isPublic ? <WorkflowShareBadge share={workflow.share} /> : null}
  </div>
)

export const WorkflowTable: React.FC<WorkflowTableProps> = ({ data, isPublic }) => {
  const navigate = useNavigate()

  const rowClick = useCallback((workflowId: string) => navigate(`/workflow/${workflowId}`), [navigate])
  const rowMiddleClick = useCallback((workflowId: string) => window.open(`/workflow/${workflowId}`, '_blank'), [])

  return (
    <Table className="w-full">
      <TableHeader>
        <TableRow>
          <TableHead>
            <FormattedMessage id="workflowTitle" />
          </TableHead>
          <TableHead>
            <FormattedMessage id="updated" />
          </TableHead>
          <TableHead>
            <FormattedMessage id="created" />
          </TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.map(workflow => (
          <TableRow
            className="cursor-pointer h-15"
            key={workflow.workflowId}
            onAuxClick={e => {
              if (e.button === 1) rowMiddleClick(workflow.workflowId)
            }}
            onClick={() => rowClick(workflow.workflowId)}
          >
            <TableCell>
              <Title isPublic={isPublic} workflow={workflow} />
            </TableCell>
            <TableCell>
              <AgoMoment value={workflow.updatedAt} />
            </TableCell>
            <TableCell>
              <AgoMoment value={workflow.createdAt} />
            </TableCell>
            {!isPublic ? (
              <TableCell className="w-0 text-right">
                <MorePopover workflow={workflow} />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
