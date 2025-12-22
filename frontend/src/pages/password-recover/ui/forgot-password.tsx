import {
  useAuthContext,
  usePasswordRecovery,
  type RequestRecoveryDto,
  AuthPageLayout,
  EmailSentDialog,
} from '@entities/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import * as z from 'zod'

const recoverySchema = z.object({
  usernameOrEmail: z.string().min(1, 'Required field'),
})

type RecoveryFormValues = z.infer<typeof recoverySchema>

const ForgotPassword = () => {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuthContext()
  const [showEmailSentDialog, setShowEmailSentDialog] = useState(false)

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/')
    }
  }, [isLoggedIn, navigate])

  const { requestRecover } = usePasswordRecovery()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoveryFormValues>({
    resolver: zodResolver(recoverySchema),
  })

  const onSubmit = useCallback(
    async (formData: RequestRecoveryDto) => {
      await requestRecover(formData)
      setShowEmailSentDialog(true)
    },
    [requestRecover],
  )

  const onCloseEmailDialog = () => {
    setShowEmailSentDialog(false)
    navigate('/')
  }

  return (
    <AuthPageLayout maxWidth="md">
      <EmailSentDialog onClose={onCloseEmailDialog} open={showEmailSentDialog} />

      <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
        <h1 className="text-2xl font-semibold text-card-foreground text-center">
          <FormattedMessage id="accountRecovery" />
        </h1>

        <div>
          <Label htmlFor="usernameOrEmail">
            <FormattedMessage id="usernameOrEmail" />
          </Label>
          <Input
            {...register('usernameOrEmail')}
            autoFocus
            error={!!errors.usernameOrEmail?.message}
            errorHelper={errors.usernameOrEmail?.message}
            id="usernameOrEmail"
            required
          />
        </div>

        <div className="flex justify-between gap-4">
          <Button onClick={() => navigate(-1)} type="button" variant="default">
            <FormattedMessage id="buttonCancel" />
          </Button>
          <Button disabled={isSubmitting} type="submit">
            <FormattedMessage id="sendRecoveryLink" />
          </Button>
        </div>
      </form>
    </AuthPageLayout>
  )
}

export default ForgotPassword
