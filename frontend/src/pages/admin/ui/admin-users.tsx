import { useAdminUsers } from '@entities/admin'
import { useAuthContext } from '@entities/auth'
import { HelmetTitle } from '@shared/ui/helmet'
import { StatusPlaceholder } from '@shared/ui/status-placeholder'
import { AdminUsersTable } from '@widgets/dashboard-admin'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const AdminUsers = () => {
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const { users, total, isLoading } = useAdminUsers(page, limit)

  const { isAdmin, isLoggedIn } = useAuthContext()

  if (!isAdmin && isLoggedIn) {
    navigate('/')
    return null
  }

  if (isLoading) return <StatusPlaceholder loading />
  if (!users.length) return <StatusPlaceholder empty />

  return (
    <>
      <HelmetTitle titleId="pageTitle.adminCRM" />
      <AdminUsersTable
        onPageChange={(newPage: number) => setPage(newPage + 1)}
        onRowsPerPageChange={(newLimit: number) => {
          setLimit(newLimit)
          setPage(1)
        }}
        page={page - 1}
        rowsPerPage={limit}
        totalRows={total}
        users={users}
      />
    </>
  )
}

export default AdminUsers
