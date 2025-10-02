import { Card, CardContent } from '@shared/ui/card'
import * as React from 'react'
import { FormattedMessage } from 'react-intl'

import {
  ClaudeLogo,
  CustomLLMLogo,
  DeepseekLogo,
  GoogleDriveLogo,
  OpenaiLogo,
  PerplexityLogo,
  QwenLogo,
  YandexGPTLogo,
} from '@shared/assets'

import type { ShowDialogFn } from '@entities/dialog'
import type { IntegrationSettings } from '@shared/base-types'

import OpenaiDialog from './dialogs/openai-dialog'
import GoogleDialog from './dialogs/google-dialog'
import { YandexDialog } from './dialogs/yandex-dialog'
import { ClaudeDialog } from './dialogs/claude-dialog'
import { PerplexityDialog } from './dialogs/perplexity-dialog'
import { QwenDialog } from './dialogs/qwen-dialog'
import { DeepseekDialog } from './dialogs/deepseek-dialog'
import CustomLLMDialog from './dialogs/custom-llm-dialog'

interface IntegrationCategoryProps {
  showDialog: ShowDialogFn
  data: IntegrationSettings | undefined
  showAll?: boolean
  refresh: () => Promise<void>
}

const IntegrationCard: React.FC<{
  icon: string
  titleId: string
  installedId?: string
  installed?: boolean
  onClick: () => void
}> = ({ icon, titleId, installedId = 'integration.installed', installed, onClick }) => (
  <Card className="w-60 m-1 cursor-pointer hover:shadow-md transition-shadow" glassEffect={false} onClick={onClick}>
    <div className="flex flex-col h-full">
      <img alt="" className="w-full h-40 object-cover rounded-t-lg" src={icon} />
      <CardContent className="flex flex-col items-center justify-center p-4 space-y-1">
        <h3 className="text-base font-medium text-center">
          <FormattedMessage id={titleId} />
        </h3>
        {installed ? (
          <span className="text-sm text-primary text-center">
            <FormattedMessage id={installedId} />
          </span>
        ) : null}
      </CardContent>
    </div>
  </Card>
)

const IntegrationCategory: React.FC<IntegrationCategoryProps> = ({ showDialog, data, showAll, refresh }) => (
  <div className="flex flex-wrap justify-start w-full">
    {data?.openai || showAll ? (
      <IntegrationCard
        icon={OpenaiLogo}
        installed={!!data?.openai}
        installedId="integration.openai.installed"
        onClick={() => showDialog(OpenaiDialog, { refresh, data: data?.openai })}
        titleId="integration.openai.title"
      />
    ) : null}
    {data?.google?.drive || showAll ? (
      <IntegrationCard
        icon={GoogleDriveLogo}
        installed={!!data?.google?.drive}
        installedId="integration.google.installed"
        onClick={() => showDialog(GoogleDialog, { refresh, data: data?.google })}
        titleId="integration.google.title"
      />
    ) : null}
    {data?.yandex || showAll ? (
      <IntegrationCard
        icon={YandexGPTLogo}
        installed={!!data?.yandex?.apiKey}
        installedId="integration.openai.installed"
        onClick={() => showDialog(YandexDialog, { refresh, data: data?.yandex })}
        titleId="integration.yandex.title"
      />
    ) : null}
    {data?.claude || showAll ? (
      <IntegrationCard
        icon={ClaudeLogo}
        installed={!!data?.claude?.apiKey}
        installedId="integration.claude.installed"
        onClick={() => showDialog(ClaudeDialog, { refresh, data: data?.claude })}
        titleId="integration.claude.title"
      />
    ) : null}
    {data?.perplexity || showAll ? (
      <IntegrationCard
        icon={PerplexityLogo}
        installed={!!data?.perplexity?.apiKey}
        installedId="integration.perplexity.installed"
        onClick={() => showDialog(PerplexityDialog, { refresh, data: data?.perplexity })}
        titleId="integration.perplexity.title"
      />
    ) : null}
    {data?.qwen || showAll ? (
      <IntegrationCard
        icon={QwenLogo}
        installed={!!data?.qwen?.apiKey}
        installedId="integration.qwen.installed"
        onClick={() => showDialog(QwenDialog, { refresh, data: data?.qwen })}
        titleId="integration.qwen.title"
      />
    ) : null}
    {data?.deepseek || showAll ? (
      <IntegrationCard
        icon={DeepseekLogo}
        installed={!!data?.deepseek?.apiKey}
        installedId="integration.deepseek.installed"
        onClick={() => showDialog(DeepseekDialog, { refresh, data: data?.deepseek })}
        titleId="integration.deepseek.title"
      />
    ) : null}
    {data?.custom_llm || showAll ? (
      <IntegrationCard
        icon={CustomLLMLogo}
        installed={!!data?.custom_llm}
        installedId="integration.installed"
        onClick={() => showDialog(CustomLLMDialog, { refresh, data: data?.custom_llm })}
        titleId="integration.custom_llm.title"
      />
    ) : null}
  </div>
)

export default IntegrationCategory
