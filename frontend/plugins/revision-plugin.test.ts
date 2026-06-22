// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { execSync } from 'node:child_process'
import type { Plugin } from 'vite'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

const mockExecSync = vi.mocked(execSync)

import { REVISION_ENDPOINT, REVISION_SENTINEL, computeRevision, revisionPlugin } from './revision-plugin'

const SCRIPT_PATH = '/project/scripts/revision.sh'

const SAMPLE_REVISIONS = [
  ['7-char abbreviated sha', 'a1b2c3d'],
  ['40-char full sha', '4b825dc642cb6eb9a060e54bf8d69288fbee4904'],
  ['commit+tree composite', '4b825dc642cb6eb9a060e54bf8d69288fbee4904+cafebabe1234567890abcdef1234567890abcdef'],
  [
    'commit+tree composite with dirty marker',
    '4b825dc642cb6eb9a060e54bf8d69288fbee4904+cafebabe1234567890abcdef1234567890abcdef[dirty]',
  ],
  ['explicit sentinel passthrough', REVISION_SENTINEL],
  ['semver tag', 'v2.3.1-rc.4'],
  ['branch-qualified ref', 'refs/heads/feature/360-validate'],
] as const

function deleteBuildRevision(): () => void {
  const saved = process.env['BUILD_REVISION']
  delete process.env['BUILD_REVISION']
  return () => {
    if (saved === undefined) delete process.env['BUILD_REVISION']
    else process.env['BUILD_REVISION'] = saved
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

describe('computeRevision — BUILD_REVISION resolution hierarchy', () => {
  describe('absent or empty BUILD_REVISION: script is the authoritative source', () => {
    it('delegates to script and returns its output when BUILD_REVISION is absent', () => {
      const restore = deleteBuildRevision()
      mockExecSync.mockReturnValue('sha-from-script')
      const result = computeRevision(SCRIPT_PATH)
      restore()
      expect(mockExecSync).toHaveBeenCalledOnce()
      expect(result).toBe('sha-from-script')
    })

    it('falls through to the script when BUILD_REVISION is empty string', () => {
      vi.stubEnv('BUILD_REVISION', '')
      mockExecSync.mockReturnValue('sha-from-script')
      const result = computeRevision(SCRIPT_PATH)
      expect(mockExecSync).toHaveBeenCalledOnce()
      expect(result).toBe('sha-from-script')
    })
  })

  describe('non-empty BUILD_REVISION: env value is returned verbatim, script is never called', () => {
    it.each(SAMPLE_REVISIONS)('%s', (_label, envVal) => {
      vi.stubEnv('BUILD_REVISION', envVal)
      const result = computeRevision(SCRIPT_PATH)
      expect(result).toBe(envVal)
      expect(mockExecSync).not.toHaveBeenCalled()
    })

    it('whitespace-only BUILD_REVISION is treated as non-empty and returned verbatim', () => {
      vi.stubEnv('BUILD_REVISION', '   ')
      const result = computeRevision(SCRIPT_PATH)
      expect(result).toBe('   ')
      expect(mockExecSync).not.toHaveBeenCalled()
    })
  })
})

describe('computeRevision — script interaction (BUILD_REVISION absent)', () => {
  let restoreBuildRevision: () => void

  beforeEach(() => {
    restoreBuildRevision = deleteBuildRevision()
  })

  afterEach(() => {
    restoreBuildRevision()
  })

  it('passes the script path to execSync via bash invocation', () => {
    mockExecSync.mockReturnValue('sha')
    computeRevision('/specific/path/revision.sh')
    expect(mockExecSync).toHaveBeenCalledWith('bash "/specific/path/revision.sh"', { encoding: 'utf8' })
  })

  it('trims trailing newline from script output', () => {
    mockExecSync.mockReturnValue('sha-value\n')
    expect(computeRevision(SCRIPT_PATH)).toBe('sha-value')
  })

  it('trims leading and trailing whitespace from script output', () => {
    mockExecSync.mockReturnValue('  sha-value  ')
    expect(computeRevision(SCRIPT_PATH)).toBe('sha-value')
  })

  it('whitespace-only script output trims to an empty string', () => {
    mockExecSync.mockReturnValue('   \n  ')
    expect(computeRevision(SCRIPT_PATH)).toBe('')
  })

  it('returns the sentinel when the script throws any Error', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('exit status 127')
    })
    expect(computeRevision(SCRIPT_PATH)).toBe(REVISION_SENTINEL)
  })

  it('returns the sentinel when the script throws a non-Error throwable', () => {
    mockExecSync.mockImplementation(() => {
      throw 'SIGKILL'
    })
    expect(computeRevision(SCRIPT_PATH)).toBe(REVISION_SENTINEL)
  })

  it('returns the sentinel when the script path does not exist', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })
    expect(computeRevision(SCRIPT_PATH)).toBe(REVISION_SENTINEL)
  })
})

describe('revisionPlugin — plugin identity', () => {
  it('plugin name is "revision-endpoint"', () => {
    vi.stubEnv('BUILD_REVISION', 'test-rev')
    expect(revisionPlugin().name).toBe('revision-endpoint')
  })
})

describe('revisionPlugin — generateBundle: asset emission contract', () => {
  const KNOWN_REVISION = 'deadbeef12345678deadbeef12345678deadbeef+cafebabe0102030405060708cafebabe01020304'

  beforeEach(() => {
    vi.stubEnv('BUILD_REVISION', KNOWN_REVISION)
  })

  function callGenerateBundle() {
    const context = { emitFile: vi.fn() }
    const plugin = revisionPlugin()
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

  it('emitted file name is "revision" (extension-free, mirrors backend endpoint path)', () => {
    expect(emittedArg().fileName).toBe('revision')
  })

  it('emitted source ends with a newline', () => {
    expect(emittedArg().source).toMatch(/\n$/)
  })

  it('emitted source is valid JSON with exactly one string-valued revision field', () => {
    const parsed = JSON.parse(emittedArg().source) as Record<string, unknown>
    expect(Object.keys(parsed)).toHaveLength(1)
    expect(typeof parsed['revision']).toBe('string')
    expect(parsed['revision']).toBe(KNOWN_REVISION)
  })
})

describe('revisionPlugin — configureServer: dev-server middleware contract', () => {
  const KNOWN_REVISION = 'deadbeef12345678deadbeef12345678deadbeef+cafebabe0102030405060708cafebabe01020304'

  beforeEach(() => {
    vi.stubEnv('BUILD_REVISION', KNOWN_REVISION)
  })

  function registerAndInvoke() {
    const use = vi.fn()
    const next = vi.fn()
    const plugin = revisionPlugin()
    const configureServer = extractHook<(server: { middlewares: { use: typeof use } }) => void>(plugin.configureServer)
    configureServer({ middlewares: { use } })

    const [registeredPath, handler] = use.mock.calls[0]
    const res = { setHeader: vi.fn(), end: vi.fn() }
    handler({}, res, next)
    return { registeredPath, res, next, use }
  }

  it('registers middleware at the REVISION_ENDPOINT path', () => {
    expect(registerAndInvoke().registeredPath).toBe(REVISION_ENDPOINT)
  })

  it('middleware sets Content-Type header to application/json', () => {
    const { res } = registerAndInvoke()
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
  })

  it('middleware body is valid JSON with the revision field', () => {
    const { res } = registerAndInvoke()
    expect(res.end).toHaveBeenCalledOnce()
    const parsed = JSON.parse(res.end.mock.calls[0][0] as string) as { revision: string }
    expect(parsed.revision).toBe(KNOWN_REVISION)
  })

  it('middleware does not invoke the next callback (request is fully handled)', () => {
    const { next } = registerAndInvoke()
    expect(next).not.toHaveBeenCalled()
  })
})

describe('revisionPlugin — cross-hook consistency', () => {
  it('generateBundle and configureServer emit the identical JSON body', () => {
    vi.stubEnv('BUILD_REVISION', 'consistent-sha-for-both-hooks')
    const plugin = revisionPlugin()

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

  it('revision is computed once at plugin creation, not per hook invocation', () => {
    vi.stubEnv('BUILD_REVISION', 'once-computed')
    const plugin = revisionPlugin()

    const emitContext = { emitFile: vi.fn() }
    const generateBundle = extractHook<(this: typeof emitContext, ...args: unknown[]) => void>(plugin.generateBundle)
    generateBundle.call(emitContext, {}, {}, false)
    generateBundle.call(emitContext, {}, {}, false)

    const first = (emitContext.emitFile.mock.calls[0][0] as { source: string }).source
    const second = (emitContext.emitFile.mock.calls[1][0] as { source: string }).source
    expect(first).toBe(second)
  })
})

describe('REVISION_SENTINEL — exported constant contract', () => {
  it('is the string "dev" (signals no SHA was injected at build time)', () => {
    expect(REVISION_SENTINEL).toBe('dev')
  })
})

describe('REVISION_ENDPOINT — exported constant contract', () => {
  it('is the path "/revision" (matches backend endpoint convention)', () => {
    expect(REVISION_ENDPOINT).toBe('/revision')
  })
})

describe('revisionPlugin — config hook: define injection contract', () => {
  it('__BUILD_REVISION__ encodes the full revision verbatim, without truncation or transformation', () => {
    vi.stubEnv('BUILD_REVISION', 'full-revision-encoding-sha')
    const plugin = revisionPlugin()
    const configHook = extractHook<() => { define: Record<string, string> }>(plugin.config)
    const encoded = configHook().define['__BUILD_REVISION__'] ?? '""'
    expect(JSON.parse(encoded)).toBe('full-revision-encoding-sha')
  })

  it('revision containing characters requiring JSON escaping is encoded without loss', () => {
    const specialRevision = 'sha/with+equals\\and"quotes"'
    vi.stubEnv('BUILD_REVISION', specialRevision)
    const plugin = revisionPlugin()
    const configHook = extractHook<() => { define: Record<string, string> }>(plugin.config)
    const encoded = configHook().define['__BUILD_REVISION__'] ?? '""'
    expect(JSON.parse(encoded)).toBe(specialRevision)
  })

  it('config, configureServer, and generateBundle all carry the identical revision string', () => {
    vi.stubEnv('BUILD_REVISION', 'three-way-consistency-sha')
    const plugin = revisionPlugin()

    const configHook = extractHook<() => { define: Record<string, string> }>(plugin.config)
    const configRevision = JSON.parse(configHook().define['__BUILD_REVISION__'] ?? '""') as string

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
    const serverRevision = (JSON.parse(res.end.mock.calls[0][0] as string) as { revision: string }).revision

    const emitCtx = { emitFile: vi.fn() }
    const generateBundle = extractHook<(this: typeof emitCtx, ...args: unknown[]) => void>(plugin.generateBundle)
    generateBundle.call(emitCtx, {}, {}, false)
    const bundleRevision = (
      JSON.parse((emitCtx.emitFile.mock.calls[0][0] as { source: string }).source) as { revision: string }
    ).revision

    expect(configRevision).toBe(serverRevision)
    expect(serverRevision).toBe(bundleRevision)
  })
})
