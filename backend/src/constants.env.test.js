const path = require('path')

jest.mock('dotenv', () => ({config: jest.fn()}))

describe('constants module initialisation', () => {
  describe('env-file path', () => {
    let dotenvConfig

    beforeAll(() => {
      jest.resetModules()
      dotenvConfig = require('dotenv').config
      dotenvConfig.mockReturnValue({})
      require('./constants')
    })

    it('calls dotenv.config() with an absolute path', () => {
      const [{path: p}] = dotenvConfig.mock.calls[0]
      expect(path.isAbsolute(p)).toBe(true)
    })

    it('anchors the path to the module directory, not process.cwd()', () => {
      const [{path: p}] = dotenvConfig.mock.calls[0]
      expect(p).toBe(path.resolve(__dirname, '../.env'))
    })

    it('calls dotenv.config() without override, so pre-set env vars are never overwritten', () => {
      const [{override}] = dotenvConfig.mock.calls[0]
      expect(override).toBeFalsy()
    })
  })

  describe('startup warning guard', () => {
    let dotenvConfig
    let stderrSpy
    let savedEnv

    beforeEach(() => {
      jest.resetModules()
      dotenvConfig = require('dotenv').config
      savedEnv = {
        JWT_SECRET: process.env.JWT_SECRET,
        MONGO_DATABASE: process.env.MONGO_DATABASE,
        MONGO_URI: process.env.MONGO_URI,
      }
      delete process.env.JWT_SECRET
      delete process.env.MONGO_DATABASE
      delete process.env.MONGO_URI
      stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {})
    })

    afterEach(() => {
      stderrSpy.mockRestore()
      for (const [key, val] of Object.entries(savedEnv)) {
        if (val === undefined) delete process.env[key]
        else process.env[key] = val
      }
    })

    it('emits [STARTUP WARNING] when dotenv fails and no infra env var is set', () => {
      dotenvConfig.mockReturnValue({error: new Error('ENOENT')})
      require('./constants')
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[STARTUP WARNING]'))
    })

    it('suppresses the warning when dotenv succeeds, even without infra env vars', () => {
      dotenvConfig.mockReturnValue({})
      require('./constants')
      expect(stderrSpy).not.toHaveBeenCalled()
    })

    it.each([
      ['JWT_SECRET', {JWT_SECRET: 'secret'}],
      ['MONGO_DATABASE', {MONGO_DATABASE: 'testdb'}],
      ['MONGO_URI', {MONGO_URI: 'mongodb://localhost/test'}],
      ['all three infra vars', {JWT_SECRET: 'secret', MONGO_DATABASE: 'testdb', MONGO_URI: 'mongodb://localhost/test'}],
    ])('suppresses the warning when dotenv fails but %s is present', (_label, envOverrides) => {
      Object.assign(process.env, envOverrides)
      dotenvConfig.mockReturnValue({error: new Error('ENOENT')})
      require('./constants')
      expect(stderrSpy).not.toHaveBeenCalled()
    })
  })
})
