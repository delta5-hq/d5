const requiredEnv = [
  'E2E_ADMIN_USER',
  'E2E_ADMIN_PASS',
  'E2E_DEEPSEEK_API_KEY',
  'E2E_QWEN_API_KEY',
  'E2E_PERPLEXITY_API_KEY',
  'E2E_CLAUDE_API_KEY',
  'E2E_YANDEX_API_KEY',
  'E2E_YANDEX_FOLDER_ID',
  'E2E_CUSTOM_LLM_URL',
] as const
type EnvKey = (typeof requiredEnv)[number]
const missing: EnvKey[] = requiredEnv.filter(key => !process.env[key])

if (missing.length > 0) {
  throw new Error(`Missing required E2E environment variables: ${missing.join(', ')}`)
}

export const e2eEnv = Object.fromEntries(requiredEnv.map(key => [key, process.env[key]!])) as Record<EnvKey, string>
