const requiredEnv = [
  'E2E_ADMIN_USER',
  'E2E_ADMIN_PASS',
] as const

const optionalEnv = [
  'E2E_DEEPSEEK_API_KEY',
  'E2E_QWEN_API_KEY',
  'E2E_PERPLEXITY_API_KEY',
  'E2E_CLAUDE_API_KEY',
  'E2E_YANDEX_API_KEY',
  'E2E_YANDEX_FOLDER_ID',
  'E2E_CUSTOM_LLM_URL',
  'E2E_OPEN_API_KEY',
] as const

type RequiredEnvKey = (typeof requiredEnv)[number]
type OptionalEnvKey = (typeof optionalEnv)[number]
type EnvKey = RequiredEnvKey | OptionalEnvKey

const missing: RequiredEnvKey[] = requiredEnv.filter(key => !process.env[key])

if (missing.length > 0) {
  throw new Error(`Missing required E2E environment variables: ${missing.join(', ')}`)
}

const allEnv = [...requiredEnv, ...optionalEnv]
export const e2eEnv = Object.fromEntries(
  allEnv.map(key => [key, process.env[key] || ''])
) as Record<EnvKey, string>
