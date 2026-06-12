import {runRuntimePreflight} from './runtimePreflight'
import {withEnv} from '../test/env'
import {MOCK_RUNTIME_PERMISSION_CASES, toMockRuntimeEnv} from '../test/mockExternalServicesCases'

describe('runRuntimePreflight', () => {
  it.each(MOCK_RUNTIME_PERMISSION_CASES)(
    'applies mock runtime permission matrix: MOCK_EXTERNAL_SERVICES=%s NODE_ENV=%s explicitAllow=%s',
    (mockValue, nodeEnv, explicitAllow, _expectedReturn, expectedError) => {
      const execute = () => withEnv(toMockRuntimeEnv(mockValue, nodeEnv, explicitAllow), runRuntimePreflight)

      if (expectedError) {
        expect(execute).toThrow(expectedError)
        return
      }

      expect(execute).not.toThrow()
    },
  )
})

describe('package mock e2e scripts', () => {
  const {scripts} = require('../../package.json')

  it.each(['test:e2e', 'test:e2e:server'])('%s declares explicit mock runtime intent', scriptName => {
    expect(scripts[scriptName]).toContain('MOCK_EXTERNAL_SERVICES=true')
    expect(scripts[scriptName]).toContain('D5_ALLOW_MOCK_EXTERNAL_SERVICES=true')
    expect(scripts[scriptName]).toContain('NODE_ENV=e2e')
  })
})
