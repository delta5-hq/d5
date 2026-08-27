import { ThemeProvider } from '@shared/lib/theme-provider'
import { LocaleProvider } from '@shared/lib/intl/locale-context'
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
    <LocaleProvider>
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
    </LocaleProvider>
  </ThemeProvider>
)

export default Providers
