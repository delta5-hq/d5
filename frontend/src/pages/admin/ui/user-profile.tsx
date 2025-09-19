import { useUserProfile } from '@entities/admin'
import { useAuthContext } from '@entities/auth'
import { UserProfileDashboard } from '@widgets/dashboard-admin'
import { useNavigate, useParams } from 'react-router-dom'

const UserProfile = () => {
  const { id } = useParams()
  const { isUserFetched, userData, mapsData } = useUserProfile(id as string)

  const navigate = useNavigate()
  const { isAdmin } = useAuthContext()

  if (!isAdmin) {
    navigate('/')
    return null
  }

  if (!isUserFetched || !id || !userData || !mapsData) return null

  return <UserProfileDashboard mapsData={mapsData} userData={userData} />
}

export default UserProfile
