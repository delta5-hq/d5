import { ThemeProvider } from '@app/providers/ThemeProvider'
import { RouterProvider } from 'react-router-dom'
import { router } from './routers'
import { IntlProvider } from 'react-intl'
import messages from '@shared/lib/intl/index'

const App = () => (
  <ThemeProvider>
    <IntlProvider locale="en" messages={messages.en}>
      <RouterProvider router={router} />
    </IntlProvider>
  </ThemeProvider>
)

export default App
