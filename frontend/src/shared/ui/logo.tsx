import { Link } from 'react-router-dom'
import { delta5Logo } from '@shared/assets'

const Logo = () => (
  <Link to="/">
    <img alt="Delta5 logo" className="logo h-8 w-8" height={32} src={delta5Logo} width={32} />
  </Link>
)

export { Logo }
