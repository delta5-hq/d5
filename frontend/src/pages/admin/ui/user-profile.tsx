import { useUserProfile } from '@entities/admin'
import { useAuthContext } from '@entities/auth'
import { UserProfileDashboard } from '@widgets/dashboard-admin'
import { useNavigate, useParams } from 'react-router-dom'

const UserProfile = () => {
  const { id } = useParams()
  const { isUserFetched, userData, worfklowsData } = useUserProfile(id as string)

  const navigate = useNavigate()
  const { isAdmin, isLoggedIn } = useAuthContext()

  if (!isAdmin && isLoggedIn) {
    navigate('/')
    return null
  }

  if (!isUserFetched || !id || !userData || !worfklowsData) return null

  return <UserProfileDashboard userData={userData} workflowsData={worfklowsData} />
}

export default UserProfile
