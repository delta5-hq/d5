import * as React from 'react'

import { cn } from '@shared/lib/utils'
import { Button } from './button'

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} ref={ref} {...props} />
    </div>
  ),
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead className={cn('[&_tr]:border-b', className)} ref={ref} {...props} />,
)
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody className={cn('[&_tr:last-child]:border-0', className)} ref={ref} {...props} />
  ),
)
TableBody.displayName = 'TableBody'

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)} ref={ref} {...props} />
  ),
)
TableFooter.displayName = 'TableFooter'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      className={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)}
      ref={ref}
      {...props}
    />
  ),
)
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      className={cn(
        'h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      className={cn('p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]', className)}
      ref={ref}
      {...props}
    />
  ),
)
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption className={cn('mt-4 text-sm text-muted-foreground', className)} ref={ref} {...props} />
  ),
)
TableCaption.displayName = 'TableCaption'

interface TablePaginationProps {
  page: number
  rowsPerPage: number
  totalRows: number
  onPageChange: (newPage: number) => void
  onRowsPerPageChange: (rows: number) => void
  className?: string
}

const TablePagination = React.forwardRef<HTMLDivElement, TablePaginationProps>(
  ({ page, rowsPerPage, totalRows, onPageChange, onRowsPerPageChange, className }, ref) => {
    const totalPages = Math.ceil(totalRows / rowsPerPage) || 1

    return (
      <div
        className={cn('flex justify-between items-center text-sm mt-4 px-2 py-1 border-t bg-muted/10', className)}
        ref={ref}
      >
        <div className="flex items-center space-x-2">
          <span>Rows per page:</span>
          <select
            className="border rounded p-1 text-sm bg-background text-foreground"
            onChange={e => onRowsPerPageChange(+e.target.value)}
            value={rowsPerPage}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <Button disabled={page === 0} onClick={() => onPageChange(Math.max(0, page - 1))} size="sm" variant="outline">
            Prev
          </Button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <Button
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
            size="sm"
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>
    )
  },
)
TablePagination.displayName = 'TablePagination'

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption, TablePagination }
