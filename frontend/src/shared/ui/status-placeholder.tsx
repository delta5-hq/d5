import { Loader2, Inbox } from 'lucide-react'
import type React from 'react'

interface StatusPlaceholderProps {
  loading?: boolean
  empty?: boolean
  message?: string
}

const StatusPlaceholder: React.FC<StatusPlaceholderProps> = ({ loading, empty, message }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 w-full h-full">
        <Loader2 className="animate-spin w-8 h-8 text-primary mb-3" />
        <span className="text-primary text-lg font-medium">Loading...</span>
      </div>
    )
  }

  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 w-full h-full">
        <Inbox className="w-10 h-10 text-muted-foreground mb-3" />
        <span className="text-muted-foreground text-lg font-medium">{message ?? 'No data available'}</span>
      </div>
    )
  }

  return null
}

export { StatusPlaceholder }
