import type { FullUserStatistics } from '@entities/admin'
import { DateCell, FieldsOfWorkCell, NumberCell, RoleCell, StringCell, type Column } from '@entities/table'
import { ROLES } from '@shared/base-types'
import { DEBOUNCE_TIMEOUT } from '@shared/config'
import { Button } from '@shared/ui/button'
import { Card } from '@shared/ui/card'
import { Input } from '@shared/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TablePagination, TableRow } from '@shared/ui/table'
import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Row {
  userId: string
  name: string
  mail: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fieldsOfWork?: any
  mapCount?: number
  mapShareCount?: number
  sharedWithCount?: number
  nodeCount?: number
  biggestMapCount?: number
  nodeLimit?: number
  subscriber?: boolean
  createdAt?: string
  lastMapChange?: string
  comment?: string
}

interface AdminTableProps {
  users: FullUserStatistics[]
  page: number
  rowsPerPage: number
  totalRows: number
  onPageChange: (newPage: number) => void
  onRowsPerPageChange: (newLimit: number) => void
  setSearch: (str: string) => void
}

const toCsv = (rows: Row[]) => {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csvContent =
    headers.join(',') +
    '\n' +
    rows
      .map(row =>
        headers
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map(key => `"${(row as any)[key] !== null && (row as any)[key] !== undefined ? (row as any)[key] : ''}"`)
          .join(','),
      )
      .join('\n')
  const element = document.createElement('a')
  element.href = `data:text/csv;charset=utf-8,${encodeURI(csvContent)}`
  element.download = 'export.csv'
  element.click()
}

const AdminTable: React.FC<AdminTableProps> = ({
  users,
  onPageChange,
  onRowsPerPageChange,
  page,
  rowsPerPage,
  totalRows,
  setSearch,
}) => {
  const [localSearch, setLocalSearch] = useState('')
  const [orderBy, setOrderBy] = useState<keyof Row>('userId')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const navigate = useNavigate()

  const filteredRows: Row[] = useMemo(
    () =>
      users.map(user => ({
        userId: user.id,
        name: user.name,
        mail: user.mail,
        fieldsOfWork: user.meta?.store?.fieldsOfWork ?? {},
        mapCount: user.mapCount ?? 0,
        mapShareCount: user.mapShareCount ?? 0,
        sharedWithCount: user.sharedWithCount ?? 0,
        nodeCount: user.nodeCount ?? 0,
        biggestMapCount: user.biggestMapCount ?? 0,
        nodeLimit: user.limitNodes ?? 0,
        subscriber: user.roles?.includes(ROLES.subscriber) || user.roles?.includes(ROLES.org_subscriber) || false,
        createdAt: user.createdAt,
        lastMapChange: user.lastMapChange,
        comment: user.comment ?? '',
      })),
    [users],
  )

  const columns: Column<Row>[] = [
    { id: 'userId', label: 'ID' },
    { id: 'name', label: 'Username', Cell: StringCell },
    { id: 'mail', label: 'Email', Cell: StringCell },
    { id: 'fieldsOfWork', label: 'Fields of Work', Cell: FieldsOfWorkCell },
    { id: 'mapCount', label: 'Own Workflow', Cell: NumberCell },
    { id: 'mapShareCount', label: 'Shared Workflows', Cell: NumberCell },
    { id: 'sharedWithCount', label: 'Shared With', Cell: NumberCell },
    { id: 'nodeCount', label: 'Total Nodes', Cell: NumberCell },
    { id: 'biggestMapCount', label: 'Most Nodes', Cell: NumberCell },
    { id: 'nodeLimit', label: 'Nodes Limit', Cell: NumberCell },
    { id: 'subscriber', label: 'Paid', Cell: RoleCell },
    { id: 'createdAt', label: 'Signed Up', Cell: DateCell },
    { id: 'lastMapChange', label: 'Last Change', Cell: DateCell },
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

  const stableSort = <T,>(array: T[], comparator: (a: T, b: T) => number): T[] => {
    const stabilized = array.map((el, idx) => [el, idx] as [T, number])
    stabilized.sort((a, b) => {
      const comp = comparator(a[0], b[0])
      return comp !== 0 ? comp : a[1] - b[1]
    })
    return stabilized.map(el => el[0])
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

  return (
    <Card className="p-2">
      <div className="mb-2 flex justify-between items-center">
        <Input className="w-[250px]" onChange={handleChangeSearch} placeholder="Search" value={localSearch} />
        <Button onClick={() => toCsv(filteredRows)}>Download CSV</Button>
      </div>

      <div className="overflow-x-auto">
        <Table className="bg-card rounded-xl p-2">
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
            </TableRow>
          </TableHeader>

          <TableBody>
            {stableSort(filteredRows, getComparator(order, orderBy)).map(row => (
              <TableRow
                className="cursor-pointer"
                key={row.userId}
                onClick={() => navigate(`/admin/users/${row.userId}`)}
              >
                {columns.map(({ Cell, id }) => (
                  <TableCell key={id as string}>
                    {Cell ? <Cell row={row} value={row[id]} /> : (row[id] as string)}
                  </TableCell>
                ))}
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

export default AdminTable
