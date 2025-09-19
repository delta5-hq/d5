import React, { useMemo, type ChangeEvent } from 'react'
import { Button } from '@shared/ui/button'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TablePagination } from '@shared/ui/table'
import { Input } from '@shared/ui/input'
import { Card } from '@shared/ui/card'
import type { User } from '@shared/base-types'
import { toast } from 'sonner'
import { apiFetch } from '@shared/lib/base-api'
import { DateCell, StringCell, type Column } from '@entities/table'

interface Row {
  userId: string
  name: string
  mail: string
  createdAt: string
}

interface WaitlistTableProps {
  initialWaitlist: User[]
  page: number
  rowsPerPage: number
  totalRows: number
  onPageChange: (newPage: number) => void
  onRowsPerPageChange: (newLimit: number) => void
}

const WaitlistTable: React.FC<WaitlistTableProps> = ({
  initialWaitlist,
  page,
  rowsPerPage,
  totalRows,
  onPageChange,
  onRowsPerPageChange,
}) => {
  const [searchField, setSearchField] = React.useState<string>('')
  const [orderBy, setOrderBy] = React.useState<keyof Row>('userId')
  const [order, setOrder] = React.useState<'asc' | 'desc'>('desc')

  const rows: Row[] = useMemo(
    () =>
      initialWaitlist
        .filter(value =>
          searchField
            .toLowerCase()
            .split(' ')
            .every(w => [value.id, value.name, value.mail].toString().toLowerCase().includes(w)),
        )
        .map(value => ({
          userId: value.id,
          name: value.name,
          mail: value.mail,
          createdAt: value.createdAt,
        })),
    [initialWaitlist, searchField],
  )

  const columns: Column<Row>[] = [
    { id: 'userId', label: 'ID' },
    { id: 'name', label: 'Username', Cell: StringCell },
    { id: 'mail', label: 'Email', Cell: StringCell },
    { id: 'createdAt', label: 'Signed up date', Cell: DateCell },
  ]

  const descendingComparator = <T,>(a: T, b: T, orderByComp: keyof T): number => {
    if (b[orderByComp] < a[orderByComp]) return -1
    if (b[orderByComp] > a[orderByComp]) return 1
    return 0
  }

  const getComparator = <T,>(orderComp: 'asc' | 'desc', orderByComp: keyof T) =>
    orderComp === 'desc'
      ? (a: T, b: T) => descendingComparator(a, b, orderByComp)
      : (a: T, b: T) => -descendingComparator(a, b, orderByComp)

  const createSortHandler = (property: keyof Row) => () => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const handleChangeSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchField(e.target.value)
    onPageChange(0)
  }

  const onActivate = async (id: string) => {
    try {
      await apiFetch(`/statistics/waitlist/confirm/${id}`)
      toast.success('Account activated')
    } catch {
      toast.error('Activation error')
    }
  }

  const stableSort = <T,>(array: T[], comparator: (a: T, b: T) => number): T[] => {
    const stabilizedThis: [T, number][] = array.map((el, index) => [el, index])
    stabilizedThis.sort((a, b) => {
      const orderComp = comparator(a[0], b[0])
      if (orderComp !== 0) return orderComp
      return a[1] - b[1]
    })
    return stabilizedThis.slice(0, array.length).map(el => el[0])
  }

  return (
    <div className="w-full">
      <div className="mb-2">
        <Input className="w-[250px]" onChange={handleChangeSearch} placeholder="Search" value={searchField} />
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead
                  className="cursor-pointer select-none"
                  key={col.id as string}
                  onClick={createSortHandler(col.id)}
                >
                  {col.label}
                  {orderBy === col.id ? (
                    <span className="ml-1 text-xs opacity-60">{order === 'asc' ? '▲' : '▼'}</span>
                  ) : null}
                </TableHead>
              ))}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stableSort(rows, getComparator(order, orderBy))
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map(row => (
                <TableRow key={row.userId}>
                  {columns.map(({ Cell, id }) => (
                    <TableCell key={id as string}>
                      {Cell ? <Cell row={row} value={row[id]} /> : (row[id] as string)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button className="cursor-pointer" onClick={() => onActivate(row.userId)} variant="outline">
                      Approve
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>

      <TablePagination
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
        page={page}
        rowsPerPage={rowsPerPage}
        totalRows={totalRows}
      />
    </div>
  )
}

export default WaitlistTable
