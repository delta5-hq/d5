import { useAuthContext, usePasswordRecovery, type RequestRecoveryDto } from '@entities/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import CustomAlertDialog from '@shared/ui/alert-dialog'
import { Button } from '@shared/ui/button'
import { Copyright } from '@shared/ui/copyright'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { Logo } from '@shared/ui/logo'
import { VersionBase } from '@shared/ui/version'
import { useCallback, useState } from 'react'
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
  const [showAlertDialog, setShowAlertDialog] = useState(false)

  if (isLoggedIn) {
    navigate('/')
  }

  const { requestRecover } = usePasswordRecovery()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoveryFormValues>({
    resolver: zodResolver(recoverySchema),
  })

  const onClose = () => {
    navigate('/')
  }

  const onSubmit = useCallback(
    async (formData: RequestRecoveryDto) => {
      await requestRecover(formData)
      setShowAlertDialog(true)
    },
    [requestRecover],
  )

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted p-4 relative">
      <div className="absolute top-5 left-5">
        <Logo />
      </div>

      <CustomAlertDialog
        onClose={onClose}
        onConfirm={onClose}
        open={showAlertDialog}
        title={<FormattedMessage id="forgotPasswordDialogTitle" />}
        translationKey="forgotPasswordDialogMessage"
      />

      <div className="w-full max-w-md bg-card shadow-md rounded-lg p-6">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <h2>
            <FormattedMessage id="accountRecovery" />
          </h2>

          <div className="flex flex-col gap-4">
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

            <div className="text-center text-foreground/40 text-sm">
              <FormattedMessage id="version" /> <VersionBase /> <Copyright />
            </div>
          </div>

          <div className="flex justify-between">
            <Button onClick={() => navigate(-1)} variant="default">
              <FormattedMessage id="buttonCancel" />
            </Button>
            <Button disabled={isSubmitting} type="submit">
              <FormattedMessage id="sendRecoveryLink" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ForgotPassword
