import fs from 'fs'
import path from 'path'
import {
  isInternalMcpServer,
  buildInternalServerEnv,
  resolveInternalServerScript,
  INTERNAL_SERVERS_DIR,
} from './internalServerEnv'

jest.mock('../../../../constants', () => ({
  MONGO_URI: 'mongodb://localhost:27017/test',
}))

const internalPath = (...segments) => path.join(INTERNAL_SERVERS_DIR, ...segments)

const logicalInternalServerCases = [
  ['research-rag', 'd5-internal://mcp-server/research-rag', path.join(INTERNAL_SERVERS_DIR, 'research-rag/server.js')],
  ['scraper', 'd5-internal://mcp-server/scraper', path.join(INTERNAL_SERVERS_DIR, 'scraper/server.js')],
  ['outliner', 'd5-internal://mcp-server/outliner', path.join(INTERNAL_SERVERS_DIR, 'outliner/server.js')],
]

const dockerPathCases = [
  ['research-rag', '/app/mcp-servers/research-rag/server.js', 'research-rag/server.js'],
  ['scraper', '/app/mcp-servers/scraper/server.js', 'scraper/server.js'],
  ['outliner', '/app/mcp-servers/outliner/server.js', 'outliner/server.js'],
]

const ABSENT_SERVERS_DIR = '/tmp/d5-test-absent-mcp-servers-dir'

const withAbsentServersDir = callback => {
  const saved = process.env.INTERNAL_SERVERS_DIR
  process.env.INTERNAL_SERVERS_DIR = ABSENT_SERVERS_DIR
  try {
    callback()
  } finally {
    if (saved === undefined) delete process.env.INTERNAL_SERVERS_DIR
    else process.env.INTERNAL_SERVERS_DIR = saved
  }
}

describe('INTERNAL_SERVERS_DIR resolution', () => {
  it('is an absolute path', () => {
    expect(path.isAbsolute(INTERNAL_SERVERS_DIR)).toBe(true)
  })

  it('ends with the mcp-servers directory segment', () => {
    expect(path.basename(INTERNAL_SERVERS_DIR)).toBe('mcp-servers')
  })

  it('resolves inside the build tree', () => {
    expect(INTERNAL_SERVERS_DIR).toContain(path.join('build', 'mcp-servers'))
  })

  it('does not resolve inside the src tree', () => {
    expect(INTERNAL_SERVERS_DIR).not.toContain(path.join('src', 'mcp-servers'))
  })

  it('is overridden by INTERNAL_SERVERS_DIR env var at module load time', () => {
    const customPath = '/custom/servers'
    process.env.INTERNAL_SERVERS_DIR = customPath
    try {
      let overridden
      jest.isolateModules(() => {
        jest.mock('../../../../constants', () => ({MONGO_URI: 'mongodb://localhost:27017/test'}))
        overridden = require('./internalServerEnv').INTERNAL_SERVERS_DIR
      })
      expect(overridden).toBe(customPath)
    } finally {
      delete process.env.INTERNAL_SERVERS_DIR
    }
  })

  it('treats empty string INTERNAL_SERVERS_DIR env var as an explicit override (nullish-coalesce semantics)', () => {
    process.env.INTERNAL_SERVERS_DIR = ''
    try {
      let overridden
      jest.isolateModules(() => {
        jest.mock('../../../../constants', () => ({MONGO_URI: 'mongodb://localhost:27017/test'}))
        overridden = require('./internalServerEnv').INTERNAL_SERVERS_DIR
      })
      expect(overridden).toBe('')
    } finally {
      delete process.env.INTERNAL_SERVERS_DIR
    }
  })
})

describe('resolveInternalServerScript', () => {
  it.each(logicalInternalServerCases)('maps logical %s server URI to INTERNAL_SERVERS_DIR', (_name, uri, expected) => {
    expect(resolveInternalServerScript(uri)).toBe(expected)
  })

  it('rejects unknown logical internal server URI', () => {
    expect(() => resolveInternalServerScript('d5-internal://mcp-server/unknown')).toThrow('Unknown internal MCP server')
  })

  describe('existence guard for internal server URIs', () => {
    it.each(logicalInternalServerCases)(
      'throws an actionable error naming %s and the build command when the built script is absent',
      (serverId, uri) => {
        withAbsentServersDir(() => {
          jest.isolateModules(() => {
            jest.mock('../../../../constants', () => ({MONGO_URI: 'mongodb://localhost:27017/test'}))
            const {resolveInternalServerScript: resolve} = require('./internalServerEnv')
            expect(() => resolve(uri)).toThrow(`Internal MCP server '${serverId}' is not built. Run: npm run build`)
          })
        })
      },
    )

    it.each(logicalInternalServerCases)(
      'throws an actionable error naming %s when the servers directory exists but the script file is absent (partial build)',
      (serverId, uri) => {
        const tmpDir = fs.mkdtempSync(path.join('/tmp', 'd5-test-partial-build-'))
        process.env.INTERNAL_SERVERS_DIR = tmpDir
        try {
          jest.isolateModules(() => {
            jest.mock('../../../../constants', () => ({MONGO_URI: 'mongodb://localhost:27017/test'}))
            const {resolveInternalServerScript: resolve} = require('./internalServerEnv')
            expect(() => resolve(uri)).toThrow(`Internal MCP server '${serverId}' is not built. Run: npm run build`)
          })
        } finally {
          delete process.env.INTERNAL_SERVERS_DIR
          fs.rmdirSync(tmpDir)
        }
      },
    )

    it('does not check existence for Docker preset paths — filesystem is managed externally', () => {
      expect(() => resolveInternalServerScript('/app/mcp-servers/absent-server/server.js')).not.toThrow()
    })

    it('does not check existence for user-supplied arbitrary paths', () => {
      expect(() => resolveInternalServerScript('/tmp/this-path-does-not-exist-d5-test.js')).not.toThrow()
    })
  })

  it.each(dockerPathCases)('maps Docker preset path for %s to INTERNAL_SERVERS_DIR', (_name, dockerPath, relPath) => {
    expect(resolveInternalServerScript(dockerPath)).toBe(path.join(INTERNAL_SERVERS_DIR, relPath))
  })

  it('returns absolute paths unchanged if already under INTERNAL_SERVERS_DIR', () => {
    const localPath = path.join(INTERNAL_SERVERS_DIR, 'scraper/server.js')
    expect(resolveInternalServerScript(localPath)).toBe(localPath)
  })

  it('returns unrelated paths unchanged', () => {
    expect(resolveInternalServerScript('/usr/local/bin/server.js')).toBe('/usr/local/bin/server.js')
  })
})

describe('isInternalMcpServer', () => {
  describe('command gate', () => {
    it('accepts node command', () => {
      expect(isInternalMcpServer('node', [internalPath('server.js')])).toBe(true)
    })

    it('rejects non-node command regardless of path', () => {
      expect(isInternalMcpServer('python', [internalPath('server.py')])).toBe(false)
    })

    it('rejects npx even if path is under internal dir', () => {
      expect(isInternalMcpServer('npx', [internalPath('server.js')])).toBe(false)
    })
  })

  describe('path boundary', () => {
    it('accepts path directly inside internal servers dir', () => {
      expect(isInternalMcpServer('node', [internalPath('server.js')])).toBe(true)
    })

    it('accepts path nested multiple levels inside internal servers dir', () => {
      expect(isInternalMcpServer('node', [internalPath('scraper', 'tools', 'server.js')])).toBe(true)
    })

    it('rejects the internal servers dir path itself', () => {
      expect(isInternalMcpServer('node', [INTERNAL_SERVERS_DIR])).toBe(false)
    })

    it('rejects sibling directory that shares the dir name as a prefix', () => {
      expect(isInternalMcpServer('node', [INTERNAL_SERVERS_DIR + '-extra/server.js'])).toBe(false)
    })

    it('rejects path in an unrelated directory', () => {
      expect(isInternalMcpServer('node', ['/usr/local/bin/server.js'])).toBe(false)
    })

    it('rejects path containing the mcp-servers substring outside internal dir', () => {
      expect(isInternalMcpServer('node', ['/home/user/mcp-servers/server.js'])).toBe(false)
    })

    it.each(dockerPathCases)('accepts Docker preset path for %s', (_name, dockerPath) => {
      expect(isInternalMcpServer('node', [dockerPath])).toBe(true)
    })

    it.each(logicalInternalServerCases)('accepts logical internal server URI for %s', (_name, uri) => {
      expect(isInternalMcpServer('node', [uri])).toBe(true)
    })

    it('rejects logical internal server URI for non-node command', () => {
      expect(isInternalMcpServer('npx', ['d5-internal://mcp-server/scraper'])).toBe(false)
    })

    it('rejects /app/mcp-servers itself (no trailing slash means not a file)', () => {
      expect(isInternalMcpServer('node', ['/app/mcp-servers'])).toBe(false)
    })

    it('rejects path traversal that escapes internal dir', () => {
      const traversal = internalPath('..', 'evil.js')
      expect(isInternalMcpServer('node', [traversal])).toBe(false)
    })
  })

  describe('args guard', () => {
    it('rejects empty args array', () => {
      expect(isInternalMcpServer('node', [])).toBe(false)
    })

    it('rejects undefined args', () => {
      expect(isInternalMcpServer('node', undefined)).toBe(false)
    })

    it('rejects null args', () => {
      expect(isInternalMcpServer('node', null)).toBe(false)
    })

    it('reads only the first element of args', () => {
      expect(isInternalMcpServer('node', [internalPath('server.js'), '--extra-flag'])).toBe(true)
    })
  })

  describe('existence error propagation', () => {
    it.each(logicalInternalServerCases)(
      'propagates the absence error for %s when called with a logical URI and the built script is missing',
      (serverId, uri) => {
        withAbsentServersDir(() => {
          jest.isolateModules(() => {
            jest.mock('../../../../constants', () => ({MONGO_URI: 'mongodb://localhost:27017/test'}))
            const {isInternalMcpServer: check} = require('./internalServerEnv')
            expect(() => check('node', [uri])).toThrow(
              `Internal MCP server '${serverId}' is not built. Run: npm run build`,
            )
          })
        })
      },
    )
  })
})

describe('buildInternalServerEnv', () => {
  const llmEnvKeys = [
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

  const providerEnvCases = [
    ['openai', {openai: {apiKey: 'openai-key'}}, {OPENAI_API_KEY: 'openai-key'}],
    ['claude', {claude: {apiKey: 'claude-key'}}, {CLAUDE_API_KEY: 'claude-key'}],
    ['qwen', {qwen: {apiKey: 'qwen-key'}}, {QWEN_API_KEY: 'qwen-key'}],
    ['deepseek', {deepseek: {apiKey: 'ds-key'}}, {DEEPSEEK_API_KEY: 'ds-key'}],
    ['perplexity', {perplexity: {apiKey: 'pplx-key'}}, {PERPLEXITY_API_KEY: 'pplx-key'}],
    [
      'yandex',
      {yandex: {apiKey: 'yc-key', folder_id: 'yc-folder'}},
      {
        YANDEX_API_KEY: 'yc-key',
        YC_API_KEY: 'yc-key',
        YANDEX_FOLDER_ID: 'yc-folder',
        YC_FOLDER_ID: 'yc-folder',
      },
    ],
  ]

  const allProviderSettings = {
    openai: {apiKey: 'openai-key'},
    claude: {apiKey: 'claude-key'},
    qwen: {apiKey: 'qwen-key'},
    deepseek: {apiKey: 'ds-key'},
    perplexity: {apiKey: 'pplx-key'},
    yandex: {apiKey: 'yc-key', folder_id: 'yc-folder'},
  }

  describe('base fields', () => {
    it('sets D5_USER_ID from argument', () => {
      const env = buildInternalServerEnv('user-abc', null, {})
      expect(env.D5_USER_ID).toBe('user-abc')
    })

    it('sets D5_WORKFLOW_ID from argument when provided', () => {
      const env = buildInternalServerEnv('user-1', 'wf-42', {})
      expect(env.D5_WORKFLOW_ID).toBe('wf-42')
    })

    it('sets D5_WORKFLOW_ID to empty string when workflowId is null', () => {
      const env = buildInternalServerEnv('user-1', null, {})
      expect(env.D5_WORKFLOW_ID).toBe('')
    })

    it('sets D5_WORKFLOW_ID to empty string when workflowId is undefined', () => {
      const env = buildInternalServerEnv('user-1', undefined, {})
      expect(env.D5_WORKFLOW_ID).toBe('')
    })

    it('sets MONGO_URI from module constant', () => {
      const env = buildInternalServerEnv('user-1', null, {})
      expect(env.MONGO_URI).toBe('mongodb://localhost:27017/test')
    })

    it('inherits parent process environment', () => {
      const env = buildInternalServerEnv('user-1', null, {})
      expect(env.PATH).toBeDefined()
    })

    it('D5_USER_ID overwrites any pre-existing process.env value', () => {
      const original = process.env.D5_USER_ID
      process.env.D5_USER_ID = 'process-env-value'
      const env = buildInternalServerEnv('argument-value', null, {})
      expect(env.D5_USER_ID).toBe('argument-value')
      process.env.D5_USER_ID = original
    })
  })

  describe('LLM key injection', () => {
    const expectOnlyEnvKeys = (env, expected) => {
      for (const key of llmEnvKeys) {
        expect(env[key]).toBe(expected[key])
      }
    }

    it.each(providerEnvCases)('injects only %s credential env keys from settings', (_provider, settings, expected) => {
      const env = buildInternalServerEnv('user-1', null, settings)
      expectOnlyEnvKeys(env, expected)
    })

    it('injects all provider keys when all settings are present', () => {
      const env = buildInternalServerEnv('user-1', null, allProviderSettings)
      expect(env.OPENAI_API_KEY).toBe('openai-key')
      expect(env.CLAUDE_API_KEY).toBe('claude-key')
      expect(env.QWEN_API_KEY).toBe('qwen-key')
      expect(env.DEEPSEEK_API_KEY).toBe('ds-key')
      expect(env.PERPLEXITY_API_KEY).toBe('pplx-key')
      expect(env.YANDEX_API_KEY).toBe('yc-key')
      expect(env.YC_API_KEY).toBe('yc-key')
      expect(env.YANDEX_FOLDER_ID).toBe('yc-folder')
      expect(env.YC_FOLDER_ID).toBe('yc-folder')
    })

    it('omits keys for providers not present in settings', () => {
      const env = buildInternalServerEnv('user-1', null, {openai: {apiKey: 'key'}})
      expect(env.CLAUDE_API_KEY).toBeUndefined()
      expect(env.QWEN_API_KEY).toBeUndefined()
      expect(env.DEEPSEEK_API_KEY).toBeUndefined()
      expect(env.PERPLEXITY_API_KEY).toBeUndefined()
    })

    it('omits YANDEX_FOLDER_ID when yandex provider lacks folder_id', () => {
      const env = buildInternalServerEnv('user-1', null, {yandex: {apiKey: 'yc-key'}})
      expect(env.YANDEX_API_KEY).toBe('yc-key')
      expect(env.YC_API_KEY).toBe('yc-key')
      expect(env.YANDEX_FOLDER_ID).toBeUndefined()
      expect(env.YC_FOLDER_ID).toBeUndefined()
    })

    it('injects no LLM keys when settings is empty object', () => {
      const env = buildInternalServerEnv('user-1', null, {})
      expectOnlyEnvKeys(env, {})
    })

    it('removes inherited provider credentials before injecting user-scoped settings', () => {
      const originals = Object.fromEntries(llmEnvKeys.map(key => [key, process.env[key]]))

      try {
        for (const key of llmEnvKeys) process.env[key] = `ambient-${key}`

        const env = buildInternalServerEnv('user-1', null, {qwen: {apiKey: 'user-qwen-key'}})
        expectOnlyEnvKeys(env, {QWEN_API_KEY: 'user-qwen-key'})
      } finally {
        for (const key of llmEnvKeys) {
          if (originals[key] === undefined) {
            delete process.env[key]
          } else {
            process.env[key] = originals[key]
          }
        }
      }
    })

    it('does not throw when settings is null', () => {
      expect(() => buildInternalServerEnv('user-1', null, null)).not.toThrow()
    })

    it('does not throw when settings is undefined', () => {
      expect(() => buildInternalServerEnv('user-1', null, undefined)).not.toThrow()
    })
  })
})
