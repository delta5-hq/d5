import {
  MOCK_EXTERNAL_SERVICES_ALLOW_ENV,
  MOCK_EXTERNAL_SERVICES_ERROR,
  MOCK_EXTERNAL_SERVICES_PRODUCTION_ERROR,
} from '../config/mockExternalServices'

export const MOCK_FLAG_CASES = [
  ['true', true],
  [' true ', false],
  ['false', false],
  ['TRUE', false],
  ['1', false],
  ['', false],
  [undefined, false],
]

export const QA_NODE_ENV_CASES = [
  ['test', true],
  ['Test', false],
  ['development', true],
  ['qa', true],
  ['e2e', true],
  ['production', false],
  ['', false],
  [undefined, false],
]

export const EXPLICIT_ALLOW_CASES = [
  ['true', true],
  [' true ', false],
  ['false', false],
  ['TRUE', false],
  ['1', false],
  ['', false],
  [undefined, false],
]

export const MOCK_RUNTIME_PERMISSION_CASES = [
  ['true', 'test', undefined, true, null],
  ['true', 'test', 'false', true, null],
  ['true', 'development', 'true', true, null],
  ['true', 'qa', 'true', true, null],
  ['true', 'e2e', 'true', true, null],
  ['true', 'production', 'true', null, MOCK_EXTERNAL_SERVICES_PRODUCTION_ERROR],
  ['true', 'production', 'false', null, MOCK_EXTERNAL_SERVICES_PRODUCTION_ERROR],
  ['true', 'development', undefined, null, MOCK_EXTERNAL_SERVICES_ERROR],
  ['true', 'qa', undefined, null, MOCK_EXTERNAL_SERVICES_ERROR],
  ['true', 'e2e', undefined, null, MOCK_EXTERNAL_SERVICES_ERROR],
  ['true', 'production', undefined, null, MOCK_EXTERNAL_SERVICES_PRODUCTION_ERROR],
  ['true', undefined, undefined, null, MOCK_EXTERNAL_SERVICES_ERROR],
  ['false', 'production', undefined, false, null],
  ['false', 'production', 'true', false, null],
  ['TRUE', 'production', undefined, false, null],
  ['1', 'production', undefined, false, null],
  [undefined, 'production', undefined, false, null],
]

export const toMockRuntimeEnv = (mockValue, nodeEnv, explicitAllow) => ({
  MOCK_EXTERNAL_SERVICES: mockValue,
  NODE_ENV: nodeEnv,
  [MOCK_EXTERNAL_SERVICES_ALLOW_ENV]: explicitAllow,
})
