import {
  MOCK_EXTERNAL_SERVICES_ALLOW_ENV,
  assertMockExternalServicesAllowed,
  canUseMockExternalServices,
  isExplicitlyAllowedMockRuntime,
  isMockExternalServicesEnabled,
  isAllowedMockRuntimeNodeEnv,
} from './MockExternalServices'
import {withEnv} from '../../../../../test/env'
import {
  EXPLICIT_ALLOW_CASES,
  MOCK_FLAG_CASES,
  MOCK_RUNTIME_PERMISSION_CASES,
  QA_NODE_ENV_CASES,
  toMockRuntimeEnv,
} from '../../../../../test/mockExternalServicesCases'

describe('MockExternalServices guard', () => {
  describe('flag parsing', () => {
    it.each(MOCK_FLAG_CASES)('MOCK_EXTERNAL_SERVICES=%s resolves to enabled=%s', (value, expected) => {
      withEnv({MOCK_EXTERNAL_SERVICES: value}, () => {
        expect(isMockExternalServicesEnabled()).toBe(expected)
      })
    })
  })

  describe('allowlist parsing', () => {
    it.each(QA_NODE_ENV_CASES)('NODE_ENV=%s resolves to allowed-mock-runtime-env=%s', (value, expected) => {
      withEnv({NODE_ENV: value}, () => {
        expect(isAllowedMockRuntimeNodeEnv()).toBe(expected)
      })
    })

    it.each(EXPLICIT_ALLOW_CASES)(
      `${MOCK_EXTERNAL_SERVICES_ALLOW_ENV}=%s resolves to explicit-allow=%s`,
      (value, expected) => {
        withEnv({[MOCK_EXTERNAL_SERVICES_ALLOW_ENV]: value}, () => {
          expect(isExplicitlyAllowedMockRuntime()).toBe(expected)
        })
      },
    )
  })

  describe('permission matrix', () => {
    it.each(MOCK_RUNTIME_PERMISSION_CASES)(
      'MOCK_EXTERNAL_SERVICES=%s NODE_ENV=%s explicitAllow=%s returns %s and error=%s',
      (mockValue, nodeEnv, explicitAllow, expectedReturn, expectedError) => {
        withEnv(toMockRuntimeEnv(mockValue, nodeEnv, explicitAllow), () => {
          if (expectedError) {
            expect(() => assertMockExternalServicesAllowed()).toThrow(expectedError)
            expect(() => canUseMockExternalServices()).toThrow(expectedError)
            return
          }

          expect(() => assertMockExternalServicesAllowed()).not.toThrow()
          expect(canUseMockExternalServices()).toBe(expectedReturn)
        })
      },
    )
  })
})
