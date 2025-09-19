import { IntlProvider } from 'react-intl'
import { ThemeProvider } from './theme-provider'
import type React from 'react'
import messages from '@shared/lib/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <IntlProvider locale="en" messages={messages.en}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </IntlProvider>
  </ThemeProvider>
)

export default Providers
