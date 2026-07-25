import path from 'path'

jest.mock('child_process', () => ({execFileSync: jest.fn()}))
jest.mock('fs', () => ({existsSync: jest.fn()}))
const BWRAP_PATH = '/usr/bin/bwrap'

describe('ProcessSandbox', () => {
  let execFileSync
  let existsSync

  beforeEach(() => {
    jest.resetModules()
    execFileSync = require('child_process').execFileSync
    existsSync = require('fs').existsSync
    execFileSync.mockImplementation(() => {})
    existsSync.mockReturnValue(false)
  })

  describe('sandboxSpawn — bwrap active', () => {
    it('replaces command with bwrap path', () => {
      const {sandboxSpawn} = require('./ProcessSandbox')
      expect(sandboxSpawn('npx', ['-y', 'server']).command).toBe(BWRAP_PATH)
    })

    it('passes env object through unchanged', () => {
      const {sandboxSpawn} = require('./ProcessSandbox')
      const env = {API_KEY: 'abc'}
      expect(sandboxSpawn('npx', [], env).env).toBe(env)
    })

    it('includes --unshare-pid flag', () => {
      const {sandboxSpawn} = require('./ProcessSandbox')
      expect(sandboxSpawn('npx', []).args).toContain('--unshare-pid')
    })

    it('places original command and args after -- separator', () => {
      const {sandboxSpawn} = require('./ProcessSandbox')
      const {args} = sandboxSpawn('npx', ['-y', 'pkg'])
      const sep = args.indexOf('--')
      expect(sep).toBeGreaterThan(-1)
      expect(args.slice(sep + 1)).toEqual(['npx', '-y', 'pkg'])
    })

    it('defaults undefined args to empty array beyond the -- separator', () => {
      const {sandboxSpawn} = require('./ProcessSandbox')
      const {args} = sandboxSpawn('npx', undefined)
      const sep = args.indexOf('--')
      expect(args.slice(sep + 1)).toEqual(['npx'])
    })

    it('binds existing system directories read-only', () => {
      existsSync.mockImplementation(p => p === '/usr' || p === '/lib')
      const {sandboxSpawn} = require('./ProcessSandbox')
      const {args} = sandboxSpawn('npx', [])
      const roBindTargets = args.reduce((acc, a, i) => (a === '--ro-bind' ? [...acc, args[i + 1]] : acc), [])
      expect(roBindTargets).toContain('/usr')
      expect(roBindTargets).toContain('/lib')
    })

    it('omits system directories that do not exist', () => {
      existsSync.mockReturnValue(false)
      const {sandboxSpawn} = require('./ProcessSandbox')
      const {args} = sandboxSpawn('npx', [])
      expect(args).not.toContain('--ro-bind')
    })

    it('binds script directory read-only when node runs an absolute .js file that exists', () => {
      existsSync.mockImplementation(p => p === '/srv/app/server.js')
      const {sandboxSpawn} = require('./ProcessSandbox')
      const {args} = sandboxSpawn('node', ['/srv/app/server.js'])
      const roBindTargets = args.reduce((acc, a, i) => (a === '--ro-bind' ? [...acc, args[i + 1]] : acc), [])
      expect(roBindTargets).toContain('/srv/app')
    })

    it('binds script directory for node-jiti command', () => {
      existsSync.mockImplementation(p => p === '/srv/app/server.js')
      const {sandboxSpawn} = require('./ProcessSandbox')
      const {args} = sandboxSpawn('node-jiti', ['/srv/app/server.js'])
      const roBindTargets = args.reduce((acc, a, i) => (a === '--ro-bind' ? [...acc, args[i + 1]] : acc), [])
      expect(roBindTargets).toContain('/srv/app')
    })

    it('binds script directory for relative .js arg resolved against cwd', () => {
      const resolvedPath = path.resolve(process.cwd(), 'server.js')
      existsSync.mockImplementation(p => p === resolvedPath)
      const {sandboxSpawn} = require('./ProcessSandbox')
      const {args} = sandboxSpawn('node', ['server.js'])
      const roBindTargets = args.reduce((acc, a, i) => (a === '--ro-bind' ? [...acc, args[i + 1]] : acc), [])
      expect(roBindTargets).toContain(path.dirname(resolvedPath))
    })

    it('does not bind script directory for non-node commands', () => {
      existsSync.mockImplementation(p => p === '/srv/app/server.js')
      const {sandboxSpawn} = require('./ProcessSandbox')
      const {args} = sandboxSpawn('python', ['/srv/app/server.js'])
      const roBindTargets = args.reduce((acc, a, i) => (a === '--ro-bind' ? [...acc, args[i + 1]] : acc), [])
      expect(roBindTargets).not.toContain('/srv/app')
    })

    it('does not bind script directory when node has no .js/.cjs/.mjs arg', () => {
      const {sandboxSpawn} = require('./ProcessSandbox')
      const {args} = sandboxSpawn('node', ['--eval', 'console.log(1)'])
      expect(args).not.toContain('--ro-bind')
    })

    it('does not bind script directory when the .js file does not exist on disk', () => {
      existsSync.mockReturnValue(false)
      const {sandboxSpawn} = require('./ProcessSandbox')
      const {args} = sandboxSpawn('node', ['/nonexistent/server.js'])
      expect(args).not.toContain('--ro-bind')
    })

    it('produces ro-bind entry for the project root when node_modules exists in a script ancestor', () => {
      existsSync.mockImplementation(p => p === '/project/src/server.js' || p === '/project/node_modules')
      const {sandboxSpawn} = require('./ProcessSandbox')
      const {args} = sandboxSpawn('node', ['/project/src/server.js'])
      const roBindTargets = args.reduce((acc, a, i) => (a === '--ro-bind' ? [...acc, args[i + 1]] : acc), [])
      expect(roBindTargets).toContain('/project')
    })
  })

  describe('isSandboxActive — bwrap active', () => {
    it('returns true when bwrap is found', () => {
      const {isSandboxActive} = require('./ProcessSandbox')
      expect(isSandboxActive()).toBe(true)
    })
  })

  describe('sandboxSpawn — bwrap unavailable', () => {
    const savedOverride = process.env.D5_ALLOW_UNSANDBOXED_SPAWN

    beforeEach(() => {
      execFileSync.mockImplementation(() => {
        throw new Error('not found')
      })
      delete process.env.D5_ALLOW_UNSANDBOXED_SPAWN
    })

    afterEach(() => {
      if (savedOverride === undefined) delete process.env.D5_ALLOW_UNSANDBOXED_SPAWN
      else process.env.D5_ALLOW_UNSANDBOXED_SPAWN = savedOverride
    })

    it('throws SandboxUnavailableError', () => {
      const {sandboxSpawn, SandboxUnavailableError} = require('./ProcessSandbox')
      expect(() => sandboxSpawn('node', ['server.js'])).toThrow(SandboxUnavailableError)
    })

    it('throws by default even when the override env var is unset (secure by default)', () => {
      const {sandboxSpawn, SandboxUnavailableError} = require('./ProcessSandbox')
      expect(() => sandboxSpawn('node', [])).toThrow(SandboxUnavailableError)
    })

    describe('with D5_ALLOW_UNSANDBOXED_SPAWN=true (trusted-environment override)', () => {
      let warnSpy
      beforeEach(() => {
        process.env.D5_ALLOW_UNSANDBOXED_SPAWN = 'true'
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      })
      afterEach(() => warnSpy.mockRestore())

      it('returns the original command unsandboxed, without bwrap', () => {
        const {sandboxSpawn} = require('./ProcessSandbox')
        const env = {API_KEY: 'abc'}
        const result = sandboxSpawn('node', ['/srv/app/server.js'], env)
        expect(result.command).toBe('node')
        expect(result.args).toEqual(['/srv/app/server.js'])
        expect(result.env).toBe(env)
      })

      it('defaults undefined args to an empty array in the unsandboxed result', () => {
        const {sandboxSpawn} = require('./ProcessSandbox')
        expect(sandboxSpawn('node', undefined).args).toEqual([])
      })

      it('warns that it is spawning without a sandbox', () => {
        const {sandboxSpawn} = require('./ProcessSandbox')
        sandboxSpawn('node', [])
        expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/without a sandbox/))
      })

      it('does not fall back for any other truthy-looking value (strict "true" only)', () => {
        process.env.D5_ALLOW_UNSANDBOXED_SPAWN = '1'
        const {sandboxSpawn, SandboxUnavailableError} = require('./ProcessSandbox')
        expect(() => sandboxSpawn('node', [])).toThrow(SandboxUnavailableError)
      })
    })

    it.each([
      ['undefined', undefined],
      ['empty array', []],
      ['populated array', ['/srv/app/server.js']],
    ])('throws SandboxUnavailableError regardless of args (%s)', (_label, args) => {
      const {sandboxSpawn, SandboxUnavailableError} = require('./ProcessSandbox')
      expect(() => sandboxSpawn('node', args)).toThrow(SandboxUnavailableError)
    })

    it('returns false from isSandboxActive', () => {
      const {isSandboxActive} = require('./ProcessSandbox')
      expect(isSandboxActive()).toBe(false)
    })
  })

  describe('SandboxUnavailableError', () => {
    it('is a subclass of Error', () => {
      const {SandboxUnavailableError} = require('./ProcessSandbox')
      expect(new SandboxUnavailableError()).toBeInstanceOf(Error)
    })

    it('has name SandboxUnavailableError', () => {
      const {SandboxUnavailableError} = require('./ProcessSandbox')
      expect(new SandboxUnavailableError().name).toBe('SandboxUnavailableError')
    })

    it('carries a descriptive message referencing the missing binary', () => {
      const {SandboxUnavailableError} = require('./ProcessSandbox')
      expect(new SandboxUnavailableError().message).toMatch(/bwrap/)
    })
  })

  describe('sandboxSpawn — network isolation option', () => {
    it.each([
      ['no options argument', []],
      ['empty options object', [{}]],
      ['allowNetwork: undefined', [{allowNetwork: undefined}]],
      ['allowNetwork: false', [{allowNetwork: false}]],
    ])('includes --unshare-net in sandboxed args when %s', (_label, optArgs) => {
      const {sandboxSpawn} = require('./ProcessSandbox')
      expect(sandboxSpawn('npx', [], {}, ...optArgs).args).toContain('--unshare-net')
    })

    it('omits --unshare-net from sandboxed args when allowNetwork is true', () => {
      const {sandboxSpawn} = require('./ProcessSandbox')
      expect(sandboxSpawn('npx', [], {}, {allowNetwork: true}).args).not.toContain('--unshare-net')
    })
  })
})
