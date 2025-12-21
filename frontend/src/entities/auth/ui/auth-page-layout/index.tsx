import { BackgroundPattern } from './background-pattern'
import { CenteredCardContainer } from './centered-card-container'
import { FooterMetadata } from './footer-metadata'
import { LogoHeader } from './logo-header'
import type { AuthPageLayoutProps } from './types'

export const AuthPageLayout = ({ children, maxWidth = 'md', showFooter = true }: AuthPageLayoutProps) => (
  <div className="relative flex flex-col items-center justify-center min-h-screen p-4">
    <BackgroundPattern />
    <LogoHeader />

    <div className="relative z-10 flex flex-col items-center gap-6 w-full">
      <CenteredCardContainer maxWidth={maxWidth}>{children}</CenteredCardContainer>
      {showFooter ? <FooterMetadata /> : null}
    </div>
  </div>
)
