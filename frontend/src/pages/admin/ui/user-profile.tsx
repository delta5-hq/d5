import { useUserProfile } from '@entities/admin'
import { UserProfileDashboard } from '@widgets/dashboard-admin'
import { useParams } from 'react-router-dom'

const UserProfile = () => {
  const { id } = useParams()
  const { isUserFetched, userData, mapsData } = useUserProfile(id as string)

  if (!isUserFetched || !id || !userData || !mapsData) return null

  return <UserProfileDashboard mapsData={mapsData} userData={userData} />
}

export default UserProfile
