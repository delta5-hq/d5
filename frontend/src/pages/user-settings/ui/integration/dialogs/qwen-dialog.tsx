import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@shared/ui/dialog'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Button } from '@shared/ui/button'
import { FormattedMessage } from 'react-intl'
import { toast } from 'sonner'
import { useApiMutation } from '@shared/composables'
import type { DialogProps, Qwen } from '@shared/base-types'
import { QWEN_DEFAULT_MODEL, QwenModels } from '@shared/config'
import type { HttpError } from '@shared/lib/error'
import { createResponseQwen } from '@shared/lib/llm'
import { X } from 'lucide-react'

const qwenSchema = z.object({
  apiKey: z.string().min(1, 'API Key is required'),
  model: z.nativeEnum(QwenModels, {
    errorMap: () => ({ message: 'Please select a model' }),
  }),
})

type QwenFormValues = z.infer<typeof qwenSchema>

interface QwenDialogProps extends DialogProps {
  data: Qwen | undefined
  refresh: () => Promise<void>
}

export const QwenDialog: React.FC<QwenDialogProps> = ({ data, open, onClose, refresh }) => {
  const { mutateAsync: save } = useApiMutation<Qwen, HttpError, Qwen>({
    url: '/integration/qwen/update',
    method: 'PUT',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: (err: Error) => {
      const { message } = err
      if (message) {
        toast.error(message)
      } else {
        toast.error(<FormattedMessage id="errorServer" />)
      }
    },
  })

  const form = useForm<QwenFormValues>({
    resolver: zodResolver(qwenSchema),
    defaultValues: {
      apiKey: data?.apiKey || '',
      model: (data?.model as QwenModels) || QWEN_DEFAULT_MODEL,
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = form

  const onSubmit = async (values: QwenFormValues) => {
    try {
      const apiKeyChanged = values.apiKey.trim() !== data?.apiKey
      const modelChanged = values.model.trim() !== data?.model

      if (apiKeyChanged || modelChanged) {
        await createResponseQwen('Hello!', values)
        await save(values)
      }

      await refresh()
      onClose?.()
      toast.success('Saved successfully')
    } catch (e: unknown) {
      const error = e as HttpError
      const status = error?.response?.status

      if (status === 401) {
        toast.error(<FormattedMessage id="dialog.integration.authenticationError" />)
      } else if (status === 429) {
        toast.error(<FormattedMessage id="dialog.integration.rateLimitExceeded" />)
      } else if (status === 404) {
        toast.error(<FormattedMessage id="dialog.integration.noAccess" values={{ model: values.model }} />)
      } else if (status === 503) {
        toast.error(<FormattedMessage id="dialog.integration.serverError" />)
      } else {
        toast.error(<FormattedMessage id="dialog.integration.wrongRequest" />)
      }
    }
  }

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent className="sm:max-w-lg" data-dialog-name="qwen">
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage id="integration.qwen.title" />
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogHeader>

        <DialogDescription />

        <div className="flex flex-col space-y-1">
          <Label htmlFor="apiKey">
            <FormattedMessage id="dialog.integration.apiKey" />
          </Label>
          <Input
            {...register('apiKey')}
            disabled={isSubmitting}
            error={!!errors.apiKey}
            errorHelper={errors.apiKey?.message?.toString()}
            id="apiKey"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <Label htmlFor="model">
            <FormattedMessage id="dialog.integration.model" />
          </Label>
          <Select
            disabled={isSubmitting}
            onValueChange={(val: QwenModels) => setValue('model', val)}
            value={watch('model')}
          >
            <SelectTrigger data-select-name="qwen-model">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(QwenModels).map(model => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="mt-4 flex justify-end gap-2">
          <Button disabled={isSubmitting} onClick={handleSubmit(onSubmit)} type="submit" variant="accent">
            <FormattedMessage id="save" />
          </Button>
          <DialogClose asChild>
            <Button variant="default">
              <FormattedMessage id="cancel" />
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
