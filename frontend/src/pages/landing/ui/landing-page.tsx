import { useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import { LoginDialog } from '@entities/auth'
import { Button } from '@shared/ui/button'
import { Card } from '@shared/ui/card'
import { AppLayout } from '@widgets/app-layout'

export const LandingPage = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const navigate = useNavigate()

  const handleSignup = () => {
    navigate('/register')
  }

  const handleLogin = () => {
    setIsLoginOpen(true)
  }

  const handleCloseLogin = () => {
    setIsLoginOpen(false)
  }

  return (
    <AppLayout>
      <Card className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center justify-center px-4 py-12">
          <div className="max-w-2xl w-full text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                <FormattedMessage id="landingWelcomeTitle" />
              </h1>
              <p className="text-lg text-muted-foreground">
                <FormattedMessage id="landingWelcomeDescription" />
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={handleLogin} size="lg" variant="accent">
                <FormattedMessage id="landingLoginButton" />
              </Button>
              <Button onClick={handleSignup} size="lg" variant="default">
                <FormattedMessage id="landingSignUpButton" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <LoginDialog onClose={handleCloseLogin} open={isLoginOpen} />
    </AppLayout>
  )
}
