import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'

export const RegisterButton = () => {
  const navigate = useNavigate()
  return (
    <Button onClick={() => navigate('/register')} variant="accent">
      <FormattedMessage id="buttonRegister" />
    </Button>
  )
}

export const CallToRegister = () => (
  <div className="flex justify-center p-4">
    <Card className="w-full max-w-xl">
      <CardContent className="flex flex-col items-center gap-4 text-center">
        <Sparkles className="w-16 h-16 text-primary" />

        <h2 className="text-2xl font-bold text-foreground">
          <FormattedMessage id="callToRegisterTitle" />
        </h2>

        <div className="flex gap-2">
          <RegisterButton />
        </div>
      </CardContent>
    </Card>
  </div>
)
