import type { ApiError, DialogProps, Yandex } from '@shared/base-types'
import { useApiMutation } from '@shared/composables'
import { YANDEX_DEFAULT_MODEL, YandexGPTModel } from '@shared/config'
import { createResponseYandexGPT } from '@shared/lib/llm'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import React from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { z } from 'zod'

import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { toast } from 'sonner'
import type { HttpError } from '@shared/lib/error'

const YandexModelNames: Record<YandexGPTModel, string> = {
  [YandexGPTModel.GPT_PRO_LATEST]: 'YandexGPT 5 Pro',
  [YandexGPTModel.GPT_PRO_RC]: 'YandexGPT 5.1 Pro',
  [YandexGPTModel.GPT_PRO_DEPRECATED]: 'YandexGPT 5 Deprecated',
  [YandexGPTModel.GPT_LITE_LATEST]: 'YandexGPT 5 Lite',
  [YandexGPTModel.GPT_LITE_RC]: 'YandexGPT 5 Lite RC',
  [YandexGPTModel.GPT_LITE_DEPRECATED]: 'YandexGPT 5 Lite Deprecated',
  [YandexGPTModel.GPT_32K_DEPRECATED]: 'YandexGPT Pro 32k Deprecated',
  [YandexGPTModel.GPT_32K_LATEST]: 'YandexGPT Pro 32k',
  [YandexGPTModel.LLAMA_70B_LATEST]: 'Llama 70b',
  [YandexGPTModel.LLAMA_8B_LATEST]: 'Llama 8b',
}

const yandexSchema = z.object({
  apiKey: z.string().min(1, 'API Key is required'),
  folder_id: z.string().min(1, 'Folder ID is required'),
  model: z.nativeEnum(YandexGPTModel, {
    errorMap: () => ({ message: 'Please select a model' }),
  }),
})

type YandexFormValues = z.infer<typeof yandexSchema>

interface Props extends DialogProps {
  data: Yandex | undefined
  refresh: () => Promise<void>
}

export const YandexDialog: React.FC<Props> = ({ data, open, onClose, refresh }) => {
  const { mutateAsync: save } = useApiMutation<Yandex, HttpError, Yandex>({
    url: '/integration/yandex/update',
    method: 'PUT',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: (err: Error) => toast.error(err.message || 'Server error'),
  })

  const form = useForm<YandexFormValues>({
    resolver: zodResolver(yandexSchema),
    defaultValues: {
      apiKey: data?.apiKey || '',
      folder_id: data?.folder_id || '',
      model: (data?.model as YandexGPTModel) || YANDEX_DEFAULT_MODEL,
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = form

  const onSubmit = async (values: YandexFormValues) => {
    try {
      const apiKeyChanged = values.apiKey.trim() !== data?.apiKey
      const folderIdChanged = values.folder_id.trim() !== data?.folder_id
      const modelChanged = values.model.trim() !== data?.model

      if (apiKeyChanged || folderIdChanged || modelChanged) {
        await createResponseYandexGPT('Hello!', values, { maxRetries: 0 })
        await save(values)
      }

      await refresh()
      onClose?.()
      toast.success('Saved successfully')
    } catch (e: unknown) {
      const error = e as ApiError
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
    <Dialog onOpenChange={state => !state && onClose?.()} open={open}>
      <DialogContent className="sm:max-w-lg" data-dialog-name="yandex">
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage id="integration.yandex.title" />
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogHeader>

        <DialogDescription />

        <div>
          <Label htmlFor="apiKey">
            <FormattedMessage id="dialog.integration.apiKey" />
          </Label>
          <Input
            {...register('apiKey')}
            disabled={isSubmitting}
            error={!!errors.apiKey}
            errorHelper={errors.apiKey?.message?.toString()}
            id="apiKey"
            required
          />
        </div>

        <div>
          <Label htmlFor="folder_id">
            <FormattedMessage id="dialog.integration.folderId" />
          </Label>
          <Input
            {...register('folder_id')}
            disabled={isSubmitting}
            error={!!errors.folder_id}
            errorHelper={errors.folder_id?.message?.toString()}
            id="folder_id"
            required
          />
        </div>

        <div>
          <Label htmlFor="model">
            <FormattedMessage id="dialog.integration.model" />
          </Label>
          <Select
            disabled={isSubmitting}
            onValueChange={(val: YandexGPTModel) => setValue('model', val)}
            value={watch('model')}
          >
            <SelectTrigger data-select-name="yandex-model" id="model">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(YandexModelNames).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
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
