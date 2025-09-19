import { RouterProvider } from 'react-router-dom'
import { router } from './routers'
import Providers from './providers/providers'

const App = () => (
  <Providers>
    <RouterProvider router={router} />
  </Providers>
)

export default App
