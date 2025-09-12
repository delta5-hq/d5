import jwt from 'jsonwebtoken'
import {JWT_SECRET, JWT_TTL} from '../../constants'

const generateAuth = user => {
  const token = jwt.sign(
    {
      sub: user.name,
      roles: user.roles || [],
      limitMaps: user.limitMaps || 999999999,
      limitNodes: user.limitNodes || 999999999,
    },
    JWT_SECRET,
    {expiresIn: JWT_TTL},
  )

  return {
    wp_user: {
      ID: user.name,
      roles: user.roles || [],
      data: {
        ID: user.name,
        display_name: user.name,
        user_email: user.mail,
      },
    },
    access_token: token,
    expires_in: JWT_TTL,
    refresh_token: token,
  }
}

export default generateAuth
