import { User } from 'lucide-react'
import { useApiQuery } from '@shared/composables'
import type { RoleBinding, Share, User as TUser } from '@shared/base-types'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/ui/tooltip'
import { Avatar, AvatarFallback } from '@shared/ui/avatar'
import type React from 'react'

interface SmallUserAccountProps {
  role: RoleBinding
}

const SmallUserAccount: React.FC<SmallUserAccountProps> = ({ role }) => {
  const isUser = !!role.subjectId && role.subjectType === 'user'

  const { data: userData } = useApiQuery<TUser>({
    queryKey: ['user', role.subjectId],
    url: `/users/${role.subjectId}`,
    enabled: isUser,
    staleTime: Infinity,
  })

  const name = isUser && userData?.name ? userData.name : null
  const initials = name ? name.charAt(0).toUpperCase() : null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className="w-8 h-8">
            {initials ? (
              <AvatarFallback>{initials}</AvatarFallback>
            ) : (
              <AvatarFallback>
                <User className="w-4 h-4" />
              </AvatarFallback>
            )}
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>{name ? name : <em>anonymous</em>}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface SharedWithAvatarsProps {
  workflowId: string
}

export const SharedWithAvatars: React.FC<SharedWithAvatarsProps> = ({ workflowId }) => {
  const { data: shareData } = useApiQuery<Share>({
    queryKey: ['workflows', 'share', workflowId],
    url: `/workflow/${workflowId}/share`,
    staleTime: 10000,
  })

  const access = shareData?.access ?? []

  return (
    <div className="flex flex-wrap gap-1">
      {access.slice(0, 10).map((role: RoleBinding) => (
        <SmallUserAccount key={role.subjectId} role={role} />
      ))}
      {access.length > 10 ? <span className="text-xs text-muted-foreground">+{access.length - 10}</span> : null}
    </div>
  )
}
