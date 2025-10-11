import type React from 'react'

function timeAgo(date: string | number | Date): string {
  const now = new Date().getTime()
  const past = new Date(date).getTime()
  const diff = Math.floor((now - past) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} d ago`
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} mo ago`
  return `${Math.floor(diff / 31536000)} y ago`
}

interface AgoMomentProps {
  value: string | number | Date
}

export const AgoMoment: React.FC<AgoMomentProps> = ({ value }) => <span>{timeAgo(value)}</span>
