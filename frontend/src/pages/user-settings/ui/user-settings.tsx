import React, { useEffect, useMemo, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { toast } from 'sonner'

import { useAuthContext } from '@entities/auth'
import { Model, type IntegrationSettings, type Language } from '@shared/base-types'
import { useApiMutation, useApiQuery } from '@shared/composables'
import { queryKeys, USER_DEFAULT_LANGUAGE, USER_DEFAULT_MODEL } from '@shared/config'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Spinner } from '@shared/ui/spinner'
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover'
import { Check, ChevronDown } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@shared/ui/command'
import IntegrationDialog from './integration/integration-dialog'
import { useDialog } from '@entities/dialog'

const modelMapping: Record<string, Model> = {
  openai: Model.OpenAI,
  claude: Model.Claude,
  qwen: Model.Qwen,
  yandex: Model.YandexGPT,
  custom_llm: Model.CustomLLM,
  deepseek: Model.Deepseek,
}

const UserSettingsPage: React.FC = () => {
  const { user } = useAuthContext()
  const { showDialog } = useDialog()

  const {
    data: integration,
    isLoading: isSettingsLoading,
    refetch,
  } = useApiQuery<IntegrationSettings>({
    queryKey: queryKeys.integration,
    url: '/integration',
  })

  const enabledIntegrations = useMemo(
    () =>
      integration
        ? Object.keys(integration)
            .map(name => modelMapping[name])
            .filter(Boolean)
        : [],
    [integration],
  )

  const { data: languages, isLoading: isLangsLoading } = useApiQuery<Language[]>({
    queryKey: queryKeys.languages,
    url: '/integration/languages',
  })

  const { mutateAsync: changeUserModel, isPending: isModelSaving } = useApiMutation({
    url: '/integration/model',
    method: 'POST',
  })
  const { mutateAsync: changeUserLang, isPending: isLangSaving } = useApiMutation({
    url: '/integration/language',
    method: 'POST',
  })

  const [model, setModel] = useState('')
  const [lang, setLang] = useState(USER_DEFAULT_LANGUAGE)
  const [openLangBox, setOpenLangBox] = useState(false)

  useEffect(() => {
    if (integration?.model) {
      setModel(integration.model)
    } else if (enabledIntegrations.length > 0) {
      setModel(USER_DEFAULT_MODEL)
    }
    if (integration?.lang) {
      setLang(integration.lang)
    }
  }, [integration, enabledIntegrations])

  const handleSave = async () => {
    try {
      let refetchFlag = false
      if (integration?.model !== model) {
        refetchFlag = true
        await changeUserModel({ model })
      }
      if (integration?.lang !== lang) {
        refetchFlag = true
        await changeUserLang({ lang })
      }

      if (!refetchFlag) return

      await refetch()
      toast.success('Saved successfully')
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Request failed')
    }
  }

  const onLangChange = (newLang: string) => {
    setLang(newLang)
    setOpenLangBox(false)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">
        <FormattedMessage id="profileSettings.editProfile" />
      </h2>

      {isSettingsLoading || isLangsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4 max-w-xl">
          <div>
            <Label htmlFor="userId">
              <FormattedMessage id="profileSettings.username" />
            </Label>
            <Input id="userId" readOnly value={user?.id ?? ''} />
          </div>

          <div>
            <Label htmlFor="userEmail">
              <FormattedMessage id="profileSettings.emailAddress" />
            </Label>
            <Input id="userEmail" readOnly value={user?.mail ?? ''} />
          </div>

          {languages?.length ? (
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="lang">
                <FormattedMessage id="lang" />
              </Label>

              <Popover onOpenChange={setOpenLangBox} open={openLangBox}>
                <PopoverTrigger id="lang">
                  {languages.find(l => l.code === lang)?.name || <FormattedMessage id="defaultLang" />}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent>
                  <Command>
                    <CommandInput placeholder="Search language..." />
                    <CommandList>
                      <CommandEmpty>
                        <FormattedMessage id="noLanguage" />.
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={onLangChange} value={USER_DEFAULT_LANGUAGE}>
                          <FormattedMessage id="defaultLang" />
                        </CommandItem>
                        {languages.map(l => (
                          <CommandItem key={l.code} onSelect={onLangChange} value={l.code}>
                            {lang === l.code ? <Check /> : null}
                            {l.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          ) : null}

          <div className="flex flex-col gap-y-1">
            <Label htmlFor="model">
              <FormattedMessage id="profileSettings.model" />
            </Label>

            <div>
              <Select onValueChange={setModel} value={model}>
                <SelectTrigger aria-label="Model select" className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {enabledIntegrations.length > 0 ? (
                    <>
                      <SelectItem value={USER_DEFAULT_MODEL}>
                        <FormattedMessage id="default" />
                      </SelectItem>
                      {enabledIntegrations.map(name => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </>
                  ) : (
                    <div className="p-3 flex flex-col items-start gap-2">
                      <p className="text-sm text-muted-foreground">
                        <FormattedMessage id="integrationSettings.none" />
                      </p>
                      <Button onClick={() => showDialog(IntegrationDialog)} size="sm">
                        <FormattedMessage id="integrationSettings.addApps" />
                      </Button>
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button className="px-4 py-2" disabled={isModelSaving || isLangSaving} onClick={handleSave}>
              <FormattedMessage id="save" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserSettingsPage
