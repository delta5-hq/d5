jest.mock('child_process', () => ({execFileSync: jest.fn()}))

describe('bwrapDetector', () => {
  let execFileSync

  beforeEach(() => {
    jest.resetModules()
    execFileSync = require('child_process').execFileSync
  })

  describe('BWRAP_PATH constant', () => {
    it('points to the standard system bwrap binary location', () => {
      execFileSync.mockImplementation(() => {})
      const {BWRAP_PATH} = require('./bwrapDetector')
      expect(BWRAP_PATH).toBe('/usr/bin/bwrap')
    })
  })

  describe('bwrapAvailable', () => {
    it('is true when bwrap exits without error', () => {
      execFileSync.mockImplementation(() => {})
      const {bwrapAvailable} = require('./bwrapDetector')
      expect(bwrapAvailable).toBe(true)
    })

    it('is false when bwrap binary is not found', () => {
      execFileSync.mockImplementation(() => {
        throw new Error('ENOENT')
      })
      const {bwrapAvailable} = require('./bwrapDetector')
      expect(bwrapAvailable).toBe(false)
    })

    it('is false when bwrap exits with a non-zero status', () => {
      execFileSync.mockImplementation(() => {
        throw Object.assign(new Error('Command failed'), {status: 1})
      })
      const {bwrapAvailable} = require('./bwrapDetector')
      expect(bwrapAvailable).toBe(false)
    })

    it('probes BWRAP_PATH with --version so the check is non-destructive', () => {
      execFileSync.mockImplementation(() => {})
      const {BWRAP_PATH} = require('./bwrapDetector')
      expect(execFileSync).toHaveBeenCalledWith(BWRAP_PATH, ['--version'], expect.any(Object))
    })

    it('suppresses stdout and stderr during the probe', () => {
      execFileSync.mockImplementation(() => {})
      require('./bwrapDetector')
      const [, , opts] = execFileSync.mock.calls[0]
      expect(opts.stdio).toBe('ignore')
    })

    it('applies a 2-second timeout to the probe so a stalled binary does not hang the process', () => {
      execFileSync.mockImplementation(() => {})
      require('./bwrapDetector')
      const [, , opts] = execFileSync.mock.calls[0]
      expect(opts.timeout).toBe(2000)
    })
  })
})
