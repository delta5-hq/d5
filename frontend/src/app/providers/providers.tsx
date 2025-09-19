import { IntlProvider } from 'react-intl'
import { ThemeProvider } from './theme-provider'
import messages from '@shared/lib/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@shared/ui/sonner'
import { DialogProvider } from '@entities/dialog'
import { Outlet } from 'react-router-dom'

const queryClient = new QueryClient()

const Providers = () => (
  <ThemeProvider>
    <IntlProvider locale="en" messages={messages.en}>
      <QueryClientProvider client={queryClient}>
        <DialogProvider>
          <Outlet />
        </DialogProvider>
      </QueryClientProvider>
      <Toaster position="bottom-left" />
    </IntlProvider>
  </ThemeProvider>
)

export default Providers
