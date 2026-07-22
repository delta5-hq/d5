import IntegrationFacade from '../../../../../repositories/IntegrationFacade'
import {resolveSettings} from './IntegrationSettingsResolver'
import {USER_DEFAULT_MODEL} from '../../../../../shared/config/constants'

export const Model = {
  YandexGPT: 'YandexGPT',
  OpenAI: 'OpenAI',
  Claude: 'Claude',
  Qwen: 'Qwen',
  Deepseek: 'Deepseek',
  CustomLLM: 'CustomLLM',
}

const PROVIDER_CREDENTIAL_MAP = [
  [Model.OpenAI, 'openai', 'apiKey'],
  [Model.Claude, 'claude', 'apiKey'],
  [Model.Qwen, 'qwen', 'apiKey'],
  [Model.Deepseek, 'deepseek', 'apiKey'],
  [Model.CustomLLM, 'custom_llm', 'apiRootUrl'],
  [Model.YandexGPT, 'yandex', 'apiKey'],
]

const isNonBlankString = value => Boolean(value && (typeof value !== 'string' || value.trim()))

const hasCredentialConfigured = (settings, providerKey, credentialPath) => {
  if (!settings) return false
  const provider = settings[providerKey]
  if (!provider) return false
  const value = credentialPath.split('.').reduce((obj, key) => obj?.[key], provider)
  return isNonBlankString(value)
}

export const detectConfiguredProvider = settings => {
  for (const [model, providerKey, credentialPath] of PROVIDER_CREDENTIAL_MAP) {
    if (hasCredentialConfigured(settings, providerKey, credentialPath)) return model
  }
  return null
}

const applyWorkflowModelInference = (settings, workflowDoc) => {
  if (workflowDoc && settings.model === USER_DEFAULT_MODEL) {
    const workflowProvider = detectConfiguredProvider(workflowDoc)
    if (workflowProvider) settings.model = workflowProvider
  }
}

export const loadIntegrationSettings = async (userId, workflowId = null) => {
  const fetched = await IntegrationFacade.findMergedDecryptedWithMetadata(userId, workflowId)
  const {settings, workflowDoc} = resolveSettings({...fetched, userId, workflowId})
  applyWorkflowModelInference(settings, workflowDoc)
  return settings
}
