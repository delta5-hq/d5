jest.mock('fs', () => ({existsSync: jest.fn()}))
jest.mock('child_process', () => ({execFileSync: jest.fn()}))

const roBindSources = args => args.reduce((acc, arg, i) => (arg === '--ro-bind' ? [...acc, args[i + 1]] : acc), [])

const commandAfterSeparator = args => args.slice(args.indexOf('--') + 1)

const loadDetector = () => require('./bwrapDetector')

describe('bwrapDetector', () => {
  let execFileSync
  let existsSync

  beforeEach(() => {
    jest.resetModules()
    execFileSync = require('child_process').execFileSync
    existsSync = require('fs').existsSync
    existsSync.mockReturnValue(true)
  })

  describe('capability probe arguments', () => {
    it('launches a no-op Node.js process inside the same sandbox shape used for MCP stdio', () => {
      const {buildSandboxCapabilityProbeArgs} = loadDetector()
      const args = buildSandboxCapabilityProbeArgs(() => true)

      expect(args).toEqual(expect.arrayContaining(['--unshare-pid', '--unshare-uts', '--unshare-ipc']))
      expect(args).toEqual(expect.arrayContaining(['--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp']))
      expect(args).not.toContain('--unshare-net')
      expect(commandAfterSeparator(args)).toEqual(['node', '-e', 'process.exit(0)'])
    })

    it('includes each existing system bind exactly through the shared system-dir policy', () => {
      const existing = new Set(['/usr', '/opt', '/etc/resolv.conf'])
      const {buildSandboxCapabilityProbeArgs} = loadDetector()
      const args = buildSandboxCapabilityProbeArgs(path => existing.has(path))

      expect(roBindSources(args)).toEqual(['/usr', '/opt', '/etc/resolv.conf'])
    })

    it('omits system binds that are absent on the current host', () => {
      const {buildSandboxCapabilityProbeArgs} = loadDetector()
      const args = buildSandboxCapabilityProbeArgs(() => false)

      expect(args).not.toContain('--ro-bind')
    })

    it('keeps sandbox setup before the command separator and command execution after it', () => {
      const {buildSandboxCapabilityProbeArgs} = loadDetector()
      const args = buildSandboxCapabilityProbeArgs(() => true)
      const separator = args.indexOf('--')

      expect(separator).toBeGreaterThan(0)
      expect(args.indexOf('--unshare-pid')).toBeLessThan(separator)
      expect(args.lastIndexOf('--ro-bind')).toBeLessThan(separator)
      expect(commandAfterSeparator(args)[0]).toBe('node')
    })
  })

  describe('BWRAP_PATH constant', () => {
    it('points to the standard system bwrap binary location', () => {
      execFileSync.mockImplementation(() => {})
      const {BWRAP_PATH} = loadDetector()
      expect(BWRAP_PATH).toBe('/usr/bin/bwrap')
    })
  })

  describe('bwrapAvailable', () => {
    it('is true only when the capability probe exits successfully', () => {
      execFileSync.mockImplementation(() => {})
      const {bwrapAvailable} = loadDetector()
      expect(bwrapAvailable).toBe(true)
    })

    it.each([
      ['missing binary', new Error('ENOENT')],
      ['non-zero sandbox exit', Object.assign(new Error('Command failed'), {status: 1})],
      ['stalled sandbox timeout', Object.assign(new Error('Timed out'), {code: 'ETIMEDOUT'})],
    ])('is false when the capability probe fails: %s', (_caseName, error) => {
      execFileSync.mockImplementation(() => {
        throw error
      })
      const {bwrapAvailable} = loadDetector()
      expect(bwrapAvailable).toBe(false)
    })

    it('executes BWRAP_PATH with the generated capability probe', () => {
      execFileSync.mockImplementation(() => {})
      const {BWRAP_PATH, buildSandboxCapabilityProbeArgs} = loadDetector()
      const [command, args] = execFileSync.mock.calls[0]

      expect(command).toBe(BWRAP_PATH)
      expect(args).toEqual(buildSandboxCapabilityProbeArgs(existsSync))
      expect(args).not.toContain('--version')
    })

    it('runs silently, with the current environment, under a bounded timeout', () => {
      execFileSync.mockImplementation(() => {})
      const {BWRAP_PROBE_TIMEOUT_MS} = loadDetector()
      const [, , options] = execFileSync.mock.calls[0]

      expect(options).toEqual({
        stdio: 'ignore',
        timeout: BWRAP_PROBE_TIMEOUT_MS,
        env: process.env,
      })
    })
  })
})
