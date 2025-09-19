import { Link } from 'react-router-dom'

const Copyright = () => (
  <>
    {'Copyright © '}
    <Link color="inherit" to="#">
      D5
    </Link>{' '}
    {new Date().getFullYear()}.
  </>
)

export { Copyright }
