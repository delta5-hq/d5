import path from 'path'
import {MONGO_URI} from '../../../../constants'

export const INTERNAL_SERVERS_DIR = path.resolve(__dirname, '../../../../mcp-servers')

const isNodeCommand = command => command === 'node'

const resolveScriptPath = scriptPath => path.resolve(scriptPath)

const isUnderInternalServersDir = resolvedScriptPath => resolvedScriptPath.startsWith(INTERNAL_SERVERS_DIR + path.sep)

export const isInternalMcpServer = (command, args) => {
  if (!isNodeCommand(command)) return false
  const scriptPath = args?.[0] ?? ''
  if (!scriptPath) return false
  return isUnderInternalServersDir(resolveScriptPath(scriptPath))
}

const LLM_KEY_EXTRACTORS = [
  (settings, env) => {
    if (settings?.openai?.apiKey) env.OPENAI_API_KEY = settings.openai.apiKey
  },
  (settings, env) => {
    if (settings?.claude?.apiKey) env.CLAUDE_API_KEY = settings.claude.apiKey
  },
  (settings, env) => {
    if (settings?.qwen?.apiKey) env.QWEN_API_KEY = settings.qwen.apiKey
  },
  (settings, env) => {
    if (settings?.deepseek?.apiKey) env.DEEPSEEK_API_KEY = settings.deepseek.apiKey
  },
  (settings, env) => {
    if (settings?.perplexity?.apiKey) env.PERPLEXITY_API_KEY = settings.perplexity.apiKey
  },
  (settings, env) => {
    if (settings?.yandex?.apiKey) {
      env.YANDEX_API_KEY = settings.yandex.apiKey
      env.YC_API_KEY = settings.yandex.apiKey
    }
  },
  (settings, env) => {
    if (settings?.yandex?.folder_id) {
      env.YANDEX_FOLDER_ID = settings.yandex.folder_id
      env.YC_FOLDER_ID = settings.yandex.folder_id
    }
  },
]

const LLM_ENV_KEYS = [
  'OPENAI_API_KEY',
  'CLAUDE_API_KEY',
  'QWEN_API_KEY',
  'DEEPSEEK_API_KEY',
  'PERPLEXITY_API_KEY',
  'YANDEX_API_KEY',
  'YC_API_KEY',
  'YANDEX_FOLDER_ID',
  'YC_FOLDER_ID',
]

export const buildInternalServerEnv = (userId, workflowId, settings) => {
  const env = {
    ...process.env,
    D5_USER_ID: userId,
    D5_WORKFLOW_ID: workflowId ?? '',
    MONGO_URI,
  }

  // Drop ambient LLM keys so the subprocess receives only user-configured
  // provider credentials, never the server's empty or unrelated env values.
  LLM_ENV_KEYS.forEach(key => delete env[key])

  LLM_KEY_EXTRACTORS.forEach(extractor => extractor(settings, env))

  return env
}
