// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { execSync } from 'node:child_process'
import type { Plugin } from 'vite'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

const mockExecSync = vi.mocked(execSync)

import { VERSION_ENDPOINT, VERSION_SENTINEL, computeVersion, versionPlugin } from './version-plugin'

const SCRIPT_PATH = '/project/scripts/version.sh'
const KNOWN_VERSION = 'deadbeef12345678deadbeef12345678deadbeef+cafebabe0102030405060708cafebabe01020304'

const SAMPLE_VERSIONS = [
  ['7-char abbreviated sha', 'a1b2c3d'],
  ['40-char full sha', '4b825dc642cb6eb9a060e54bf8d69288fbee4904'],
  ['commit+tree composite', '4b825dc642cb6eb9a060e54bf8d69288fbee4904+cafebabe1234567890abcdef1234567890abcdef'],
  [
    'commit+tree composite with dirty marker',
    '4b825dc642cb6eb9a060e54bf8d69288fbee4904+cafebabe1234567890abcdef1234567890abcdef[dirty]',
  ],
  ['explicit sentinel passthrough', VERSION_SENTINEL],
  ['semver tag', 'v2.3.1-rc.4'],
  ['branch-qualified ref', 'refs/heads/feature/360-validate'],
] as const

function deleteBuildVersion(): () => void {
  const saved = process.env['BUILD_VERSION']
  delete process.env['BUILD_VERSION']
  return () => {
    if (saved === undefined) delete process.env['BUILD_VERSION']
    else process.env['BUILD_VERSION'] = saved
  }
}

// Vite 7 ObjectHook<T> is T | { handler: T; order?: ... }.
function extractHook<T>(hook: Plugin[keyof Plugin]): T {
  if (typeof hook === 'function') return hook as T
  return (hook as { handler: T }).handler
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('computeVersion — BUILD_VERSION resolution hierarchy', () => {
  describe('absent or empty BUILD_VERSION: script is the authoritative source', () => {
    it('delegates to script and returns its output when BUILD_VERSION is absent', () => {
      const restore = deleteBuildVersion()
      mockExecSync.mockReturnValue('sha-from-script')
      const result = computeVersion(SCRIPT_PATH)
      restore()
      expect(mockExecSync).toHaveBeenCalledOnce()
      expect(result).toBe('sha-from-script')
    })

    it('falls through to the script when BUILD_VERSION is empty string', () => {
      vi.stubEnv('BUILD_VERSION', '')
      mockExecSync.mockReturnValue('sha-from-script')
      const result = computeVersion(SCRIPT_PATH)
      expect(mockExecSync).toHaveBeenCalledOnce()
      expect(result).toBe('sha-from-script')
    })
  })

  describe('non-empty BUILD_VERSION: env value is returned verbatim, script is never called', () => {
    it.each(SAMPLE_VERSIONS)('%s', (_label, envVal) => {
      vi.stubEnv('BUILD_VERSION', envVal)
      const result = computeVersion(SCRIPT_PATH)
      expect(result).toBe(envVal)
      expect(mockExecSync).not.toHaveBeenCalled()
    })

    it('whitespace-only BUILD_VERSION is treated as non-empty and returned verbatim', () => {
      vi.stubEnv('BUILD_VERSION', '   ')
      const result = computeVersion(SCRIPT_PATH)
      expect(result).toBe('   ')
      expect(mockExecSync).not.toHaveBeenCalled()
    })
  })
})

describe('computeVersion — script interaction (BUILD_VERSION absent)', () => {
  let restoreBuildVersion: () => void

  beforeEach(() => {
    restoreBuildVersion = deleteBuildVersion()
  })

  afterEach(() => {
    restoreBuildVersion()
  })

  it('passes the script path to execSync via bash invocation', () => {
    mockExecSync.mockReturnValue('sha')
    computeVersion('/specific/path/version.sh')
    expect(mockExecSync).toHaveBeenCalledWith('bash "/specific/path/version.sh"', { encoding: 'utf8' })
  })

  it('trims trailing newline from script output', () => {
    mockExecSync.mockReturnValue('sha-value\n')
    expect(computeVersion(SCRIPT_PATH)).toBe('sha-value')
  })

  it('trims leading and trailing whitespace from script output', () => {
    mockExecSync.mockReturnValue('  sha-value  ')
    expect(computeVersion(SCRIPT_PATH)).toBe('sha-value')
  })

  it('whitespace-only script output trims to an empty string', () => {
    mockExecSync.mockReturnValue('   \n  ')
    expect(computeVersion(SCRIPT_PATH)).toBe('')
  })

  it('returns the sentinel when the script throws any Error', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('exit status 127')
    })
    expect(computeVersion(SCRIPT_PATH)).toBe(VERSION_SENTINEL)
  })

  it('returns the sentinel when the script throws a non-Error throwable', () => {
    mockExecSync.mockImplementation(() => {
      throw 'SIGKILL'
    })
    expect(computeVersion(SCRIPT_PATH)).toBe(VERSION_SENTINEL)
  })

  it('returns the sentinel when the script path does not exist', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })
    expect(computeVersion(SCRIPT_PATH)).toBe(VERSION_SENTINEL)
  })
})

describe('versionPlugin — plugin identity', () => {
  it('plugin name is "version-endpoint"', () => {
    vi.stubEnv('BUILD_VERSION', 'test-rev')
    expect(versionPlugin().name).toBe('version-endpoint')
  })
})

describe('versionPlugin — generateBundle: asset emission contract', () => {
  beforeEach(() => {
    vi.stubEnv('BUILD_VERSION', KNOWN_VERSION)
  })

  function callGenerateBundle() {
    const context = { emitFile: vi.fn() }
    const plugin = versionPlugin()
    const generateBundle = extractHook<(this: typeof context, ...args: unknown[]) => void>(plugin.generateBundle)
    generateBundle.call(context, {}, {}, false)
    return context
  }

  function emittedArg() {
    const context = callGenerateBundle()
    expect(context.emitFile).toHaveBeenCalledOnce()
    return context.emitFile.mock.calls[0][0] as { type: string; fileName: string; source: string }
  }

  it('emits exactly one file per generateBundle call', () => {
    const context = callGenerateBundle()
    expect(context.emitFile).toHaveBeenCalledOnce()
  })

  it('emitted file type is "asset"', () => {
    expect(emittedArg().type).toBe('asset')
  })

  it('emitted file name is "version" (extension-free, mirrors backend endpoint path)', () => {
    expect(emittedArg().fileName).toBe('version')
  })

  it('emitted source ends with a newline', () => {
    expect(emittedArg().source).toMatch(/\n$/)
  })

  it('emitted source is valid JSON with exactly one string-valued version field', () => {
    const parsed = JSON.parse(emittedArg().source) as Record<string, unknown>
    expect(Object.keys(parsed)).toHaveLength(1)
    expect(typeof parsed['version']).toBe('string')
    expect(parsed['version']).toBe(KNOWN_VERSION)
  })

  it('generateBundle output is independent of the isWrite argument (both true and false)', () => {
    const contextFalse = { emitFile: vi.fn() }
    const contextTrue = { emitFile: vi.fn() }
    const pluginFalse = versionPlugin()
    const pluginTrue = versionPlugin()
    const genFalse = extractHook<(this: typeof contextFalse, ...args: unknown[]) => void>(pluginFalse.generateBundle)
    const genTrue = extractHook<(this: typeof contextTrue, ...args: unknown[]) => void>(pluginTrue.generateBundle)
    genFalse.call(contextFalse, {}, {}, false)
    genTrue.call(contextTrue, {}, {}, true)
    const argFalse = contextFalse.emitFile.mock.calls[0][0] as { type: string; fileName: string; source: string }
    const argTrue = contextTrue.emitFile.mock.calls[0][0] as { type: string; fileName: string; source: string }
    expect(argTrue).toStrictEqual(argFalse)
  })
})

describe('versionPlugin — configureServer: dev-server middleware contract', () => {
  beforeEach(() => {
    vi.stubEnv('BUILD_VERSION', KNOWN_VERSION)
  })

  function registerAndInvoke() {
    const use = vi.fn()
    const next = vi.fn()
    const plugin = versionPlugin()
    const configureServer = extractHook<(server: { middlewares: { use: typeof use } }) => void>(plugin.configureServer)
    configureServer({ middlewares: { use } })

    const [registeredPath, handler] = use.mock.calls[0]
    const res = { setHeader: vi.fn(), end: vi.fn() }
    handler({}, res, next)
    return { registeredPath, res, next, use }
  }

  it('registers middleware at the VERSION_ENDPOINT path', () => {
    expect(registerAndInvoke().registeredPath).toBe(VERSION_ENDPOINT)
  })

  it('middleware sets Content-Type header to application/json', () => {
    const { res } = registerAndInvoke()
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
  })

  it('middleware body is valid JSON with the version field', () => {
    const { res } = registerAndInvoke()
    expect(res.end).toHaveBeenCalledOnce()
    const parsed = JSON.parse(res.end.mock.calls[0][0] as string) as { version: string }
    expect(parsed.version).toBe(KNOWN_VERSION)
  })

  it('middleware does not invoke the next callback (request is fully handled)', () => {
    const { next } = registerAndInvoke()
    expect(next).not.toHaveBeenCalled()
  })

  it('configureServer registers exactly one middleware (not zero, not two)', () => {
    const { use } = registerAndInvoke()
    expect(use).toHaveBeenCalledOnce()
  })

  it('handler is idempotent: calling it a second time returns the identical JSON body', () => {
    const use = vi.fn()
    const plugin = versionPlugin()
    const configureServer = extractHook<(server: { middlewares: { use: typeof use } }) => void>(plugin.configureServer)
    configureServer({ middlewares: { use } })
    const [, handler] = use.mock.calls[0]
    const res1 = { setHeader: vi.fn(), end: vi.fn() }
    const res2 = { setHeader: vi.fn(), end: vi.fn() }
    ;(handler as (req: unknown, res: typeof res1, next: unknown) => void)({}, res1, vi.fn())
    ;(handler as (req: unknown, res: typeof res2, next: unknown) => void)({}, res2, vi.fn())
    expect(res2.end.mock.calls[0][0]).toBe(res1.end.mock.calls[0][0])
  })
})

describe('versionPlugin — cross-hook consistency', () => {
  it('generateBundle and configureServer emit the identical JSON body', () => {
    vi.stubEnv('BUILD_VERSION', 'consistent-sha-for-both-hooks')
    const plugin = versionPlugin()

    const emitContext = { emitFile: vi.fn() }
    const generateBundle = extractHook<(this: typeof emitContext, ...args: unknown[]) => void>(plugin.generateBundle)
    generateBundle.call(emitContext, {}, {}, false)
    const bundleSource = (emitContext.emitFile.mock.calls[0][0] as { source: string }).source

    const use = vi.fn()
    const configureServer = extractHook<(server: { middlewares: { use: typeof use } }) => void>(plugin.configureServer)
    configureServer({ middlewares: { use } })
    const handler = use.mock.calls[0][1] as (
      req: unknown,
      res: { setHeader: () => void; end: ReturnType<typeof vi.fn> },
      next: unknown,
    ) => void
    const res = { setHeader: vi.fn(), end: vi.fn() }
    handler({}, res, vi.fn())
    const middlewareBody = res.end.mock.calls[0][0] as string

    expect(middlewareBody).toBe(bundleSource)
  })

  it('version is computed once at plugin creation, not per hook invocation', () => {
    vi.stubEnv('BUILD_VERSION', 'once-computed')
    const plugin = versionPlugin()

    const emitContext = { emitFile: vi.fn() }
    const generateBundle = extractHook<(this: typeof emitContext, ...args: unknown[]) => void>(plugin.generateBundle)
    generateBundle.call(emitContext, {}, {}, false)
    generateBundle.call(emitContext, {}, {}, false)

    const first = (emitContext.emitFile.mock.calls[0][0] as { source: string }).source
    const second = (emitContext.emitFile.mock.calls[1][0] as { source: string }).source
    expect(first).toBe(second)
  })
})

describe('VERSION_SENTINEL — exported constant contract', () => {
  it('is the string "dev" (signals no SHA was injected at build time)', () => {
    expect(VERSION_SENTINEL).toBe('dev')
  })
})

describe('VERSION_ENDPOINT — exported constant contract', () => {
  it('is the path "/version" (matches backend endpoint convention)', () => {
    expect(VERSION_ENDPOINT).toBe('/version')
  })
})

describe('versionPlugin — config hook: define injection contract', () => {
  it('__BUILD_VERSION__ encodes the full version verbatim, without truncation or transformation', () => {
    vi.stubEnv('BUILD_VERSION', 'full-version-encoding-sha')
    const plugin = versionPlugin()
    const configHook = extractHook<() => { define: Record<string, string> }>(plugin.config)
    const encoded = configHook().define['__BUILD_VERSION__'] ?? '""'
    expect(JSON.parse(encoded)).toBe('full-version-encoding-sha')
  })

  it('version containing characters requiring JSON escaping is encoded without loss', () => {
    const specialVersion = 'sha/with+equals\\and"quotes"'
    vi.stubEnv('BUILD_VERSION', specialVersion)
    const plugin = versionPlugin()
    const configHook = extractHook<() => { define: Record<string, string> }>(plugin.config)
    const encoded = configHook().define['__BUILD_VERSION__'] ?? '""'
    expect(JSON.parse(encoded)).toBe(specialVersion)
  })

  it('config, configureServer, and generateBundle all carry the identical version string', () => {
    vi.stubEnv('BUILD_VERSION', 'three-way-consistency-sha')
    const plugin = versionPlugin()

    const configHook = extractHook<() => { define: Record<string, string> }>(plugin.config)
    const configVersion = JSON.parse(configHook().define['__BUILD_VERSION__'] ?? '""') as string

    const use = vi.fn()
    const configureServer = extractHook<(server: { middlewares: { use: typeof use } }) => void>(plugin.configureServer)
    configureServer({ middlewares: { use } })
    const handler = use.mock.calls[0][1] as (
      req: unknown,
      res: { setHeader: () => void; end: ReturnType<typeof vi.fn> },
      next: unknown,
    ) => void
    const res = { setHeader: vi.fn(), end: vi.fn() }
    handler({}, res, vi.fn())
    const serverVersion = (JSON.parse(res.end.mock.calls[0][0] as string) as { version: string }).version

    const emitCtx = { emitFile: vi.fn() }
    const generateBundle = extractHook<(this: typeof emitCtx, ...args: unknown[]) => void>(plugin.generateBundle)
    generateBundle.call(emitCtx, {}, {}, false)
    const bundleVersion = (
      JSON.parse((emitCtx.emitFile.mock.calls[0][0] as { source: string }).source) as { version: string }
    ).version

    expect(configVersion).toBe(serverVersion)
    expect(serverVersion).toBe(bundleVersion)
  })
})
