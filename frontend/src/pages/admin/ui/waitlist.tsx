import { useAuthContext } from '@entities/auth'
import { useWaitlist } from '@entities/waitlist'
import { StatusPlaceholder } from '@shared/ui/status-placeholder'
import { WaitlistTable } from '@widgets/waitlist'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

const Waitlist = () => {
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const { users, total, isLoading } = useWaitlist(page, limit)
  const { formatMessage } = useIntl()

  const { isAdmin } = useAuthContext()

  if (!isAdmin) {
    navigate('/')
    return null
  }

  if (isLoading) return <StatusPlaceholder loading />
  if (!users.length) return <StatusPlaceholder empty message={formatMessage({ id: 'noUsersInWaitlist' })} />

  return (
    <WaitlistTable
      initialWaitlist={users}
      onPageChange={(newPage: number) => setPage(newPage + 1)}
      onRowsPerPageChange={(newLimit: number) => {
        setLimit(newLimit)
        setPage(1)
      }}
      page={page - 1}
      rowsPerPage={limit}
      totalRows={total}
    />
  )
}

export default Waitlist
