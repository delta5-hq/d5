import { Button } from '@shared/ui/button'
import { Pagination, PaginationContent } from '@shared/ui/pagination'
import type React from 'react'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
}

export const WorkflowsPagination: React.FC<PaginationProps> = ({ page, limit, total, onPageChange }) => {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, idx) => idx + 1)

  return (
    <Pagination className="flex items-center justify-center gap-2">
      <PaginationContent>
        <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)} size="sm" variant="outline">
          Previous
        </Button>

        {pages.map(p => (
          <Button key={p} onClick={() => onPageChange(p)} size="sm" variant={p === page ? 'default' : 'outline'}>
            {p}
          </Button>
        ))}

        <Button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} size="sm" variant="outline">
          Next
        </Button>
      </PaginationContent>
    </Pagination>
  )
}
