import {USER_DEFAULT_MODEL} from '../../../../../shared/config/constants'
import {canUseMockExternalServices} from './MockExternalServices'

// Both env-fill and credential-presence checks derive from this map — add a provider here only.
const PROVIDER_CREDENTIAL_ENV_MAP = {
  openai: {apiKey: 'OPENAI_API_KEY'},
  claude: {apiKey: 'CLAUDE_API_KEY'},
  perplexity: {apiKey: 'PERPLEXITY_API_KEY'},
  deepseek: {apiKey: 'DEEPSEEK_API_KEY'},
  qwen: {apiKey: 'QWEN_API_KEY'},
  yandex: {apiKey: 'YANDEX_API_KEY', folder_id: 'YANDEX_FOLDER_ID'},
}

const NO_CREDENTIALS_ERROR =
  'No LLM credentials configured. Save an integration in Settings, or set ' +
  'OPENAI_API_KEY / CLAUDE_API_KEY / DEEPSEEK_API_KEY / QWEN_API_KEY / ' +
  'PERPLEXITY_API_KEY / YANDEX_API_KEY+YANDEX_FOLDER_ID in the backend env.'

const isNonBlankString = value => Boolean(value && (typeof value !== 'string' || value.trim()))

const fillAbsentCredentialsFromEnv = settings => {
  for (const [provider, credentialEnvVars] of Object.entries(PROVIDER_CREDENTIAL_ENV_MAP)) {
    for (const [field, envVar] of Object.entries(credentialEnvVars)) {
      if (isNonBlankString(settings[provider]?.[field])) continue

      const envValue = process.env[envVar]
      if (!isNonBlankString(envValue)) continue

      if (!settings[provider]) settings[provider] = {}
      settings[provider][field] = envValue
    }
  }
}

const hasAnyRegisteredCredential = settings =>
  Object.entries(PROVIDER_CREDENTIAL_ENV_MAP).some(([provider, credentialEnvVars]) =>
    Object.keys(credentialEnvVars).some(field => isNonBlankString(settings[provider]?.[field])),
  )

const buildBaseSettings = (userId, workflowId) => ({
  userId,
  workflowId,
  model: USER_DEFAULT_MODEL,
})

export const resolveSettings = ({merged, workflowDoc, userId, workflowId}) => {
  const settings = merged ?? buildBaseSettings(userId, workflowId)

  fillAbsentCredentialsFromEnv(settings)

  if (canUseMockExternalServices()) {
    return {settings, workflowDoc}
  }

  if (!merged && !hasAnyRegisteredCredential(settings)) {
    throw new Error(NO_CREDENTIALS_ERROR)
  }

  return {settings, workflowDoc}
}
