import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { FormattedMessage } from 'react-intl'
import { toast } from 'sonner'

import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogHeader,
  GlassDialogFooter,
  GlassDialogTitle,
  GlassDialogDescription,
  GlassDialogClose,
} from '@shared/ui/glass-dialog'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select'
import { Button } from '@shared/ui/button'

import { useApiMutation } from '@shared/composables'
import type { CustomLLM, DialogProps } from '@shared/base-types'
import type { HttpError } from '@shared/lib/error'
import { buildIntegrationUrl } from '../utils/build-integration-url'
import { toastIntegrationError } from '../utils/toast-integration-error'
import { CustomLLMApiType, CUSTOM_LLM_CHAT_COMPLETIONS_PATH } from '@shared/config'
import { objectsAreEqual } from '@shared/lib/objectsAreEqual'

import isUrl from '@shared/lib/isUrl'
import { X } from 'lucide-react'

const customLLMSchema = z.object({
  apiType: z.nativeEnum(CustomLLMApiType, { errorMap: () => ({ message: 'API Type is required' }) }),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  apiRootUrl: z.string().min(1, 'API Root URL is required').refine(isUrl, 'Invalid URL'),
  maxTokens: z.number().min(1, 'Max tokens must be positive'),
  embeddingsChunkSize: z.number().min(1, 'Chunk size must be positive'),
})

type CustomLLMFormValues = z.infer<typeof customLLMSchema>

const CUSTOM_LLM_API_TYPE_ALIASES: Record<string, CustomLLMApiType> = {
  openai: CustomLLMApiType.OpenAI_Compatible,
  openai_compatible: CustomLLMApiType.OpenAI_Compatible,
  openaiCompatible: CustomLLMApiType.OpenAI_Compatible,
  openai_compatible_chain_of_thought: CustomLLMApiType.OpenAI_Compatible_Chain_Of_Thought,
}

interface CustomLLMDialogProps extends DialogProps {
  data: CustomLLM | undefined
  refresh: () => Promise<void>
  workflowId?: string | null
}

const formatConnectionError = (error: unknown): string => {
  if (error instanceof DOMException && error.name === 'AbortError')
    return 'Custom LLM validation timed out after 5 seconds.'
  if (error instanceof TypeError) return 'Custom LLM endpoint is unreachable.'
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Custom LLM endpoint validation failed.'
}

const shouldValidateConnection = (values: CustomLLMFormValues, saved: CustomLLM | undefined): boolean =>
  Boolean(values.apiRootUrl) && !objectsAreEqual(values, saved || {})

const normalizeCustomLLMApiType = (apiType: CustomLLM['apiType'] | undefined): CustomLLMApiType => {
  if (!apiType) return CustomLLMApiType.OpenAI_Compatible
  if (Object.values(CustomLLMApiType).includes(apiType as CustomLLMApiType)) return apiType as CustomLLMApiType
  return CUSTOM_LLM_API_TYPE_ALIASES[apiType] || CustomLLMApiType.OpenAI_Compatible
}

export const CustomLLMDialog: React.FC<CustomLLMDialogProps> = ({ data, open, onClose, refresh, workflowId }) => {
  const url = buildIntegrationUrl('/integration/custom_llm/update', workflowId)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const { mutateAsync: save } = useApiMutation<CustomLLM, HttpError, CustomLLM>({
    url,
    method: 'PUT',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: err => toast.error(err?.message || 'Server error'),
  })

  const form = useForm<CustomLLMFormValues>({
    resolver: zodResolver(customLLMSchema),
    defaultValues: {
      apiType: normalizeCustomLLMApiType(data?.apiType),
      apiKey: data?.apiKey || '',
      model: data?.model || '',
      apiRootUrl: data?.apiRootUrl || '',
      maxTokens: data?.maxTokens || 30000,
      embeddingsChunkSize: data?.embeddingsChunkSize || 2048,
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = form

  const onSubmit = async (values: CustomLLMFormValues) => {
    setConnectionError(null)

    try {
      if (shouldValidateConnection(values, data)) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        let response: Response
        try {
          response = await fetch(CUSTOM_LLM_CHAT_COMPLETIONS_PATH, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(values.apiKey && { Authorization: `Bearer ${values.apiKey}` }),
            },
            body: JSON.stringify({
              url: values.apiRootUrl,
              model: values.model || 'gpt-4o-mini',
              messages: [{ role: 'user', content: 'Hello!' }],
              max_tokens: 10,
            }),
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timeoutId)
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText)
          throw new Error(errorText || `Validation failed: ${response.status}`)
        }

        await save(values)
      } else if (!objectsAreEqual(values, data || {})) {
        await save(values)
      }

      await refresh()
      onClose?.()
    } catch (e: unknown) {
      setConnectionError(formatConnectionError(e))
      toastIntegrationError(e)
    }
  }

  return (
    <GlassDialog onOpenChange={onClose} open={open}>
      <GlassDialogContent className="sm:max-w-lg" data-dialog-name="custom_llm" dismissible={false}>
        <GlassDialogHeader>
          <GlassDialogTitle>
            <FormattedMessage id="integration.custom_llm.title" />
          </GlassDialogTitle>
          <GlassDialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
          </GlassDialogClose>
        </GlassDialogHeader>

        <GlassDialogDescription>
          <FormattedMessage id="customLLMHint" />
        </GlassDialogDescription>
        <div className="flex flex-col gap-2">
          <Label htmlFor="apiType">
            <FormattedMessage id="apiType" />
          </Label>
          <Select
            disabled={isSubmitting}
            onValueChange={(val: CustomLLMApiType) => setValue('apiType', val)}
            value={watch('apiType')}
          >
            <SelectTrigger data-select-name="custom_llm-model">
              <SelectValue placeholder="Select API Type" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CustomLLMApiType).map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="apiKey">
            <FormattedMessage id="dialog.integration.apiKey" />
          </Label>
          <Input
            id="apiKey"
            {...register('apiKey')}
            disabled={isSubmitting}
            error={!!errors.apiKey}
            errorHelper={errors.apiKey?.message?.toString()}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="model">
            <FormattedMessage id="dialog.integration.model" />
          </Label>
          <Input
            id="model"
            {...register('model')}
            disabled={isSubmitting}
            error={!!errors.model}
            errorHelper={errors.model?.message?.toString()}
            placeholder="e.g. gpt-4o, llama3.2:8b"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="apiRootUrl">
            <FormattedMessage id="apiRootUrl" />
          </Label>
          <Input
            id="apiRootUrl"
            {...register('apiRootUrl')}
            disabled={isSubmitting}
            error={!!errors.apiRootUrl}
            errorHelper={errors.apiRootUrl?.message?.toString()}
          />
        </div>

        {connectionError ? (
          <div
            aria-live="polite"
            className="rounded-lg border border-destructive/30 border-l-4 border-l-destructive bg-destructive/5 px-4 py-3 text-sm"
            role="alert"
          >
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-destructive">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-destructive ring-4 ring-destructive/10" />
              <FormattedMessage id="dialog.integration.serverError" />
            </p>
            <p className="max-h-24 overflow-auto break-words rounded-md border border-border/70 bg-background/80 px-3 py-2 font-mono text-sm leading-5 text-foreground">
              {connectionError}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="maxTokens">
            <FormattedMessage id="maxTokens" />
          </Label>
          <Input
            id="maxTokens"
            type="number"
            {...register('maxTokens', { valueAsNumber: true })}
            disabled={isSubmitting}
            error={!!errors.maxTokens}
            errorHelper={errors.maxTokens?.message?.toString()}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="embeddingsChunkSize">
            <FormattedMessage id="embeddingsChunkSize" />
          </Label>
          <Input
            id="embeddingsChunkSize"
            type="number"
            {...register('embeddingsChunkSize', { valueAsNumber: true })}
            disabled={isSubmitting}
            error={!!errors.embeddingsChunkSize}
            errorHelper={errors.embeddingsChunkSize?.message?.toString()}
          />
        </div>

        <GlassDialogFooter className="mt-4 flex justify-end gap-2">
          <Button disabled={isSubmitting} onClick={handleSubmit(onSubmit)} type="submit" variant="accent">
            <FormattedMessage id="save" />
          </Button>
          <GlassDialogClose asChild>
            <Button variant="default">
              <FormattedMessage id="cancel" />
            </Button>
          </GlassDialogClose>
        </GlassDialogFooter>
      </GlassDialogContent>
    </GlassDialog>
  )
}

export default CustomLLMDialog
