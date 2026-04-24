import { Card, CardContent } from '@shared/ui/card'
import * as React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useButtonKeyboard } from '@shared/lib/hooks'

import {
  ClaudeLogo,
  CustomLLMLogo,
  DeepseekLogo,
  OpenaiLogo,
  PerplexityLogo,
  QwenLogo,
  YandexGPTLogo,
} from '@shared/assets'

import type { ShowDialogFn } from '@entities/dialog'
import type { IntegrationSettings } from '@shared/base-types'

import OpenaiDialog from './dialogs/openai-dialog'
import { YandexDialog } from './dialogs/yandex-dialog'
import { ClaudeDialog } from './dialogs/claude-dialog'
import { PerplexityDialog } from './dialogs/perplexity-dialog'
import { QwenDialog } from './dialogs/qwen-dialog'
import { DeepseekDialog } from './dialogs/deepseek-dialog'
import CustomLLMDialog from './dialogs/custom-llm-dialog'
import MCPDialog from './dialogs/mcp-dialog'
import RPCDialog from './dialogs/rpc-dialog'
import ArrayIntegrationSection from './components/array-integration-section'

interface IntegrationCategoryProps {
  showDialog: ShowDialogFn
  data: IntegrationSettings | undefined
  inheritedData?: IntegrationSettings
  onScopeChange?: (workflowId: string | null) => void
  showAll?: boolean
  refresh: () => Promise<void>
  workflowId?: string | null
}

const IntegrationCard: React.FC<{
  icon: string
  titleId: string
  installedId?: string
  installed?: boolean
  inherited?: boolean
  onClick: () => void
}> = ({ icon, titleId, installedId = 'integration.installed', installed, inherited, onClick }) => {
  const intl = useIntl()
  const { handleKeyDown } = useButtonKeyboard(onClick)
  const label = intl.formatMessage({ id: titleId })

  const cardClassName = inherited
    ? 'w-full sm:w-60 m-1 cursor-pointer transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border-dashed opacity-60'
    : 'w-full sm:w-60 m-1 cursor-pointer hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

  return (
    <Card
      aria-label={label}
      className={cardClassName}
      data-inherited={inherited}
      data-title-id={titleId}
      data-type="integration-card"
      glassEffect={false}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="flex flex-col h-full">
        <img alt="" className="w-full h-40 object-cover rounded-t-lg" src={icon} />
        <CardContent className="flex flex-col items-center justify-center p-4 space-y-1">
          <h3 className="text-base font-medium text-center">
            <FormattedMessage id={titleId} />
          </h3>
          {installed || inherited ? (
            <span className="text-sm text-success text-center">
              <FormattedMessage id={inherited ? 'integration.inherited' : installedId} />
            </span>
          ) : null}
        </CardContent>
      </div>
    </Card>
  )
}

const IntegrationCategory: React.FC<IntegrationCategoryProps> = ({
  showDialog,
  data,
  inheritedData,
  onScopeChange,
  showAll,
  refresh,
  workflowId,
}) => {
  const allAliases = React.useMemo(
    () => [...(data?.mcp || []).map(m => m.alias), ...(data?.rpc || []).map(r => r.alias)],
    [data?.mcp, data?.rpc],
  )

  const hasInheritedData =
    (inheritedData?.mcp && inheritedData.mcp.length > 0) || (inheritedData?.rpc && inheritedData.rpc.length > 0)

  const handleInheritedEdit = () => {
    onScopeChange?.(null)
  }

  return (
    <div className="w-full space-y-6">
      {!showAll ? (
        <>
          {/* MCP Integrations - Editable */}
          <ArrayIntegrationSection
            fieldName="mcp"
            items={data?.mcp || []}
            onAdd={() => showDialog(MCPDialog, { refresh, existingAliases: allAliases, workflowId })}
            onEdit={item =>
              showDialog(MCPDialog, {
                refresh,
                data: item,
                existingAliases: allAliases,
                isEdit: true,
                workflowId,
              })
            }
            refresh={refresh}
            titleId="integration.mcp.title"
            workflowId={workflowId}
          />

          {/* RPC Integrations - Editable */}
          <ArrayIntegrationSection
            fieldName="rpc"
            items={data?.rpc || []}
            onAdd={() => showDialog(RPCDialog, { refresh, existingAliases: allAliases, workflowId })}
            onEdit={item =>
              showDialog(RPCDialog, {
                refresh,
                data: item,
                existingAliases: allAliases,
                isEdit: true,
                workflowId,
              })
            }
            refresh={refresh}
            titleId="integration.rpc.title"
            workflowId={workflowId}
          />

          {/* Inherited Integrations - Read-only */}
          {hasInheritedData ? (
            <>
              {inheritedData?.mcp && inheritedData.mcp.length > 0 ? (
                <ArrayIntegrationSection
                  fieldName="mcp"
                  inherited
                  items={inheritedData.mcp}
                  onAdd={() => {}}
                  onEdit={handleInheritedEdit}
                  refresh={refresh}
                  titleId="integration.mcp.inherited"
                  workflowId={workflowId}
                />
              ) : null}
              {inheritedData?.rpc && inheritedData.rpc.length > 0 ? (
                <ArrayIntegrationSection
                  fieldName="rpc"
                  inherited
                  items={inheritedData.rpc}
                  onAdd={() => {}}
                  onEdit={handleInheritedEdit}
                  refresh={refresh}
                  titleId="integration.rpc.inherited"
                  workflowId={workflowId}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* LLM Integrations - Editable */}
      <div className="flex flex-wrap justify-start w-full">
        {data?.openai || showAll ? (
          <IntegrationCard
            icon={OpenaiLogo}
            installed={!!data?.openai}
            installedId="integration.openai.installed"
            onClick={() => showDialog(OpenaiDialog, { refresh, data: data?.openai, workflowId })}
            titleId="integration.openai.title"
          />
        ) : null}
        {data?.yandex || showAll ? (
          <IntegrationCard
            icon={YandexGPTLogo}
            installed={!!data?.yandex?.apiKey}
            installedId="integration.openai.installed"
            onClick={() => showDialog(YandexDialog, { refresh, data: data?.yandex, workflowId })}
            titleId="integration.yandex.title"
          />
        ) : null}
        {data?.claude || showAll ? (
          <IntegrationCard
            icon={ClaudeLogo}
            installed={!!data?.secretsMeta?.claude?.apiKey}
            installedId="integration.claude.installed"
            onClick={() =>
              showDialog(ClaudeDialog, {
                refresh,
                data: data?.claude,
                secretMeta: data?.secretsMeta?.claude,
                workflowId,
              })
            }
            titleId="integration.claude.title"
          />
        ) : null}
        {data?.perplexity || showAll ? (
          <IntegrationCard
            icon={PerplexityLogo}
            installed={!!data?.perplexity?.apiKey}
            installedId="integration.perplexity.installed"
            onClick={() => showDialog(PerplexityDialog, { refresh, data: data?.perplexity, workflowId })}
            titleId="integration.perplexity.title"
          />
        ) : null}
        {data?.qwen || showAll ? (
          <IntegrationCard
            icon={QwenLogo}
            installed={!!data?.qwen?.apiKey}
            installedId="integration.qwen.installed"
            onClick={() => showDialog(QwenDialog, { refresh, data: data?.qwen, workflowId })}
            titleId="integration.qwen.title"
          />
        ) : null}
        {data?.deepseek || showAll ? (
          <IntegrationCard
            icon={DeepseekLogo}
            installed={!!data?.deepseek?.apiKey}
            installedId="integration.deepseek.installed"
            onClick={() => showDialog(DeepseekDialog, { refresh, data: data?.deepseek, workflowId })}
            titleId="integration.deepseek.title"
          />
        ) : null}
        {data?.custom_llm || showAll ? (
          <IntegrationCard
            icon={CustomLLMLogo}
            installed={!!data?.custom_llm}
            installedId="integration.installed"
            onClick={() => showDialog(CustomLLMDialog, { refresh, data: data?.custom_llm, workflowId })}
            titleId="integration.custom_llm.title"
          />
        ) : null}
      </div>

      {/* LLM Integrations - Inherited (read-only) */}
      {!showAll && inheritedData ? (
        <div className="flex flex-wrap justify-start w-full">
          {inheritedData.openai ? (
            <IntegrationCard
              icon={OpenaiLogo}
              inherited
              onClick={handleInheritedEdit}
              titleId="integration.openai.title"
            />
          ) : null}
          {inheritedData.yandex ? (
            <IntegrationCard
              icon={YandexGPTLogo}
              inherited
              onClick={handleInheritedEdit}
              titleId="integration.yandex.title"
            />
          ) : null}
          {inheritedData.claude ? (
            <IntegrationCard
              icon={ClaudeLogo}
              inherited
              onClick={handleInheritedEdit}
              titleId="integration.claude.title"
            />
          ) : null}
          {inheritedData.perplexity ? (
            <IntegrationCard
              icon={PerplexityLogo}
              inherited
              onClick={handleInheritedEdit}
              titleId="integration.perplexity.title"
            />
          ) : null}
          {inheritedData.qwen ? (
            <IntegrationCard icon={QwenLogo} inherited onClick={handleInheritedEdit} titleId="integration.qwen.title" />
          ) : null}
          {inheritedData.deepseek ? (
            <IntegrationCard
              icon={DeepseekLogo}
              inherited
              onClick={handleInheritedEdit}
              titleId="integration.deepseek.title"
            />
          ) : null}
          {inheritedData.custom_llm ? (
            <IntegrationCard
              icon={CustomLLMLogo}
              inherited
              onClick={handleInheritedEdit}
              titleId="integration.custom_llm.title"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default IntegrationCategory
