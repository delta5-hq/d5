import path from 'path'
import {isInternalMcpServer, buildInternalServerEnv, INTERNAL_SERVERS_DIR} from './internalServerEnv'

jest.mock('../../../../constants', () => ({
  MONGO_URI: 'mongodb://localhost:27017/test',
}))

const internalPath = (...segments) => path.join(INTERNAL_SERVERS_DIR, ...segments)

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
})

describe('buildInternalServerEnv', () => {
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
      expect(env.OPENAI_API_KEY).toBeUndefined()
      expect(env.CLAUDE_API_KEY).toBeUndefined()
    })

    it('does not throw when settings is null', () => {
      expect(() => buildInternalServerEnv('user-1', null, null)).not.toThrow()
    })

    it('does not throw when settings is undefined', () => {
      expect(() => buildInternalServerEnv('user-1', null, undefined)).not.toThrow()
    })
  })
})
