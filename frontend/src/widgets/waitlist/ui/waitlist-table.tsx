import React, { useMemo, useRef } from 'react'
import { Button } from '@shared/ui/button'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TablePagination } from '@shared/ui/table'
import { Input } from '@shared/ui/input'
import { Card } from '@shared/ui/card'
import type { User } from '@shared/base-types'
import { toast } from 'sonner'
import { apiFetch } from '@shared/lib/base-api'
import { DateCell, StringCell, type Column } from '@entities/table'
import { FormattedMessage, useIntl } from 'react-intl'
import { Checkbox } from '@shared/ui/checkbox'
import { DEBOUNCE_TIMEOUT } from '@shared/config'

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
  refresh: () => void
  setSearch: (str: string) => void
}

const WaitlistTable: React.FC<WaitlistTableProps> = ({
  initialWaitlist,
  page,
  rowsPerPage,
  totalRows,
  onPageChange,
  onRowsPerPageChange,
  refresh,
  setSearch,
}) => {
  const [localSearch, setLocalSearch] = React.useState<string>('')
  const [orderBy, setOrderBy] = React.useState<keyof Row>('userId')
  const [order, setOrder] = React.useState<'asc' | 'desc'>('desc')

  const [selected, setSelected] = React.useState<string[]>([])

  const { formatMessage } = useIntl()

  const rows: Row[] = useMemo(
    () =>
      initialWaitlist.map(value => ({
        userId: value.id,
        name: value.name,
        mail: value.mail,
        createdAt: value.createdAt,
      })),
    [initialWaitlist],
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChangeSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalSearch(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      setSearch(value)
      onPageChange(0)
    }, DEBOUNCE_TIMEOUT)
  }

  const onActivate = async (id: string) => {
    try {
      await apiFetch(`/statistics/waitlist/confirm/${id}`)
      toast.success(formatMessage({ id: 'accountApproved' }))
      refresh()
    } catch {
      toast.error(formatMessage({ id: 'activationError' }))
    }
  }

  const onActivateSelected = async () => {
    if (!selected.length) return
    try {
      await apiFetch('/statistics/waitlist/confirm/all', {
        method: 'POST',
        body: JSON.stringify({ ids: selected }),
      })
      toast.success(formatMessage({ id: 'allAccountApproved' }))
      setSelected([])
      refresh()
    } catch {
      toast.error(formatMessage({ id: 'activationError' }))
    }
  }

  const onRejectSelected = async () => {
    if (!selected.length) return
    try {
      await apiFetch('/statistics/waitlist/reject/all', {
        method: 'POST',
        body: JSON.stringify({ ids: selected }),
      })
      toast.info(formatMessage({ id: 'allAccountRejected' }))
      setSelected([])
      refresh()
    } catch {
      toast.error(formatMessage({ id: 'rejectError' }))
    }
  }

  const onReject = async (id: string) => {
    try {
      await apiFetch(`/statistics/waitlist/reject/${id}`)
      toast.info(formatMessage({ id: 'accountRejected' }))
      refresh()
    } catch {
      toast.error(formatMessage({ id: 'rejectError' }))
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

  const allCurrentPageIds = stableSort(rows, getComparator(order, orderBy))
    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    .map(r => r.userId)

  const allSelectedOnPage = allCurrentPageIds.every(id => selected.includes(id))

  const toggleSelectAll = () => {
    if (allSelectedOnPage) {
      setSelected(prev => prev.filter(id => !allCurrentPageIds.includes(id)))
    } else {
      setSelected(prev => Array.from(new Set([...prev, ...allCurrentPageIds])))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  return (
    <Card className="p-2">
      <div className="flex justify-between items-center mb-2">
        <Input className="w-[250px]" onChange={handleChangeSearch} placeholder="Search" value={localSearch} />
        <div className="flex gap-x-2">
          <Button disabled={!selected.length} onClick={onActivateSelected} variant="default">
            <FormattedMessage id="approve" />
          </Button>
          <Button disabled={!selected.length} onClick={onRejectSelected} variant="danger">
            <FormattedMessage id="reject" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="bg-card rounded-xl p-2" id="waitlist-table">
          <TableHeader>
            <TableRow>
              <TableHead onClick={toggleSelectAll}>
                <Checkbox checked={allSelectedOnPage} />
              </TableHead>
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
            {stableSort(rows, getComparator(order, orderBy)).map(row => (
              <TableRow key={row.userId} onClick={() => toggleSelectOne(row.userId)}>
                <TableCell>
                  <Checkbox checked={selected.includes(row.userId)} />
                </TableCell>
                {columns.map(({ Cell, id }) => (
                  <TableCell key={id as string}>
                    {Cell ? <Cell row={row} value={row[id]} /> : (row[id] as string)}
                  </TableCell>
                ))}
                <TableCell className="flex gap-x-2">
                  <Button className="cursor-pointer" onClick={() => onActivate(row.userId)} variant="default">
                    <FormattedMessage id="approve" />
                  </Button>
                  <Button className="cursor-pointer" onClick={() => onReject(row.userId)} variant="danger">
                    <FormattedMessage id="reject" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
        page={page}
        rowsPerPage={rowsPerPage}
        totalRows={totalRows}
      />
    </Card>
  )
}

export default WaitlistTable
