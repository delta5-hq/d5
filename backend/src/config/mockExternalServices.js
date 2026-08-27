export const MOCK_EXTERNAL_SERVICES_ALLOW_ENV = 'D5_ALLOW_MOCK_EXTERNAL_SERVICES'
export const MOCK_EXTERNAL_SERVICES_ERROR =
  'MOCK_EXTERNAL_SERVICES=true requires NODE_ENV=test or D5_ALLOW_MOCK_EXTERNAL_SERVICES=true with NODE_ENV=development/qa/e2e.'
export const MOCK_EXTERNAL_SERVICES_PRODUCTION_ERROR =
  'MOCK_EXTERNAL_SERVICES=true is forbidden when NODE_ENV=production.'

const AUTO_ALLOWED_NODE_ENVS = new Set(['test'])
const EXPLICIT_ALLOWED_NODE_ENVS = new Set(['development', 'qa', 'e2e'])

export const isMockExternalServicesEnabled = () => process.env.MOCK_EXTERNAL_SERVICES === 'true'

export const isExplicitlyAllowedMockRuntime = () => process.env[MOCK_EXTERNAL_SERVICES_ALLOW_ENV] === 'true'

export const isAutoAllowedMockRuntime = () => AUTO_ALLOWED_NODE_ENVS.has(process.env.NODE_ENV)

export const isExplicitMockRuntimeNodeEnv = () => EXPLICIT_ALLOWED_NODE_ENVS.has(process.env.NODE_ENV)

export const isAllowedMockRuntimeNodeEnv = () => isAutoAllowedMockRuntime() || isExplicitMockRuntimeNodeEnv()

export const assertMockExternalServicesAllowed = () => {
  if (!isMockExternalServicesEnabled()) return
  if (process.env.NODE_ENV === 'production') throw new Error(MOCK_EXTERNAL_SERVICES_PRODUCTION_ERROR)
  if (isAutoAllowedMockRuntime()) return
  if (isExplicitMockRuntimeNodeEnv() && isExplicitlyAllowedMockRuntime()) return
  throw new Error(MOCK_EXTERNAL_SERVICES_ERROR)
}

export const canUseMockExternalServices = () => {
  assertMockExternalServicesAllowed()
  return isMockExternalServicesEnabled()
}
