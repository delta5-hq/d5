import { IntlProvider } from 'react-intl'
import { ThemeProvider } from './theme-provider'
import type React from 'react'
import messages from '@shared/lib/intl'

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <IntlProvider locale="en" messages={messages.en}>
      {children}
    </IntlProvider>
  </ThemeProvider>
)

export default Providers
