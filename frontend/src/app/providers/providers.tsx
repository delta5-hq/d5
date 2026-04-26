import { IntlProvider } from 'react-intl'
import { ThemeProvider } from '@shared/lib/theme-provider'
import messages from '@shared/lib/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@shared/ui/sonner'
import { DialogProvider } from '@entities/dialog'
import { Outlet } from 'react-router-dom'
import { AuthProvider } from '@entities/auth'
import { AliasProvider } from '@entities/aliases'
import { SearchProvider } from '@shared/context'
import { ProgressStreamProvider } from './progress-stream-provider'

const queryClient = new QueryClient()

const Providers = () => (
  <ThemeProvider>
    <IntlProvider locale="en" messages={messages.en}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AliasProvider>
            <SearchProvider>
              <ProgressStreamProvider>
                <DialogProvider>
                  <Outlet />
                </DialogProvider>
              </ProgressStreamProvider>
            </SearchProvider>
          </AliasProvider>
        </AuthProvider>
      </QueryClientProvider>
      <Toaster position="bottom-left" />
    </IntlProvider>
  </ThemeProvider>
)

export default Providers
