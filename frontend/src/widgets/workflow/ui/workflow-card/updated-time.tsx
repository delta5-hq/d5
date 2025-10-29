import { AgoMoment } from '@shared/ui/ago-moment'
import { RefreshCcw } from 'lucide-react'
import React from 'react'
import { FormattedMessage } from 'react-intl'

interface UpdatedTimeProps {
  updatedAt: string
}

const UpdatedTime: React.FC<UpdatedTimeProps> = ({ updatedAt }) => (
  <div className="flex items-center gap-1 text-sm text-muted-foreground truncate max-w-[40vw]">
    <RefreshCcw className="w-4 h-4 shrink-0" />
    <AgoMoment value={updatedAt} /> <FormattedMessage id="workflowCardTimeAgo" />
  </div>
)

export default UpdatedTime
