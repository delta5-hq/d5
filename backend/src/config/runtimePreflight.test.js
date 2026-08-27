import {runRuntimePreflight} from './runtimePreflight'
import {withEnv} from '../test/env'
import fs from 'fs'
import path from 'path'
import {
  E2E_MOCK_RUNTIME_LAUNCH_TOKENS,
  MOCK_RUNTIME_PERMISSION_CASES,
  toMockRuntimeEnv,
} from '../test/mockExternalServicesCases'

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

const E2E_NODE_BACKEND_LAUNCH = /nohup node (backend\/)?build\/index\.js > backend(\/backend)?-e2e\.log/

const e2eNodeBackendLaunchBlock = source => {
  const lines = source.split('\n')
  const matches = lines.flatMap((line, index) => (E2E_NODE_BACKEND_LAUNCH.test(line) ? [index] : []))

  expect(matches).toHaveLength(1)

  let start = matches[0]
  while (start > 0 && lines[start - 1].trimEnd().endsWith('\\')) start -= 1

  return lines.slice(start, matches[0] + 1).join('\n')
}

const repoFile = name => fs.readFileSync(path.resolve(__dirname, '../../..', name), 'utf-8')

describe('e2eNodeBackendLaunchBlock', () => {
  it('walks back across continuations to capture a multi-line launch block', () => {
    const makefileShaped = [
      'start-backend-e2e:',
      '\t@PORT=$(E2E_NODEJS_BACKEND_PORT) \\',
      '\t\tMOCK_EXTERNAL_SERVICES=true \\',
      '\t\tnohup node backend/build/index.js > backend/backend-e2e.log 2>&1 & \\',
    ].join('\n')

    expect(e2eNodeBackendLaunchBlock(makefileShaped)).toContain('MOCK_EXTERNAL_SERVICES=true')
  })

  it('ignores a non-e2e launch of the same backend', () => {
    const withDevDecoy = [
      'MOCK_EXTERNAL_SERVICES=false nohup node backend/build/index.js > backend/backend.log 2>&1 &',
      'MOCK_EXTERNAL_SERVICES=true nohup node build/index.js > backend-e2e.log 2>&1 &',
    ].join('\n')

    expect(e2eNodeBackendLaunchBlock(withDevDecoy)).toContain('MOCK_EXTERNAL_SERVICES=true')
  })

  it('fails when a surface declares no e2e launch at all', () => {
    expect(() => e2eNodeBackendLaunchBlock('nothing here')).toThrow()
  })
})

describe('e2e Node backend launch surfaces', () => {
  it.each(['Makefile', '.github/workflows/ci.yml', '.gitlab-ci.yml'])(
    '%s declares explicit mock runtime intent and the shared fork settle window',
    surface => {
      const launch = e2eNodeBackendLaunchBlock(repoFile(surface))

      E2E_MOCK_RUNTIME_LAUNCH_TOKENS.forEach(token => expect(launch).toContain(token))
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
