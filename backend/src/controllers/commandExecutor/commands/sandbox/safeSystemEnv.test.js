import {SAFE_ENV_KEYS, safeSystemEnv} from './safeSystemEnv'

describe('SAFE_ENV_KEYS', () => {
  it('is a non-empty frozen array', () => {
    expect(Array.isArray(SAFE_ENV_KEYS)).toBe(true)
    expect(SAFE_ENV_KEYS.length).toBeGreaterThan(0)
    expect(Object.isFrozen(SAFE_ENV_KEYS)).toBe(true)
  })

  it('includes PATH and HOME which every subprocess requires', () => {
    expect(SAFE_ENV_KEYS).toContain('PATH')
    expect(SAFE_ENV_KEYS).toContain('HOME')
  })

  it('does not contain any secret-shaped key names', () => {
    const secretPatterns = [/SECRET/i, /API_KEY/i, /TOKEN/i, /PASSWORD/i, /MONGO/i, /ENCRYPTION/i, /JWT/i]
    for (const key of SAFE_ENV_KEYS) {
      for (const pattern of secretPatterns) {
        expect(key).not.toMatch(pattern)
      }
    }
  })
})

describe('safeSystemEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {}
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns an empty object when process.env has no whitelisted keys', () => {
    process.env = {OPENAI_API_KEY: 'secret', JWT_SECRET: 'tok', MONGO_URI: 'mongodb://localhost'}
    expect(safeSystemEnv()).toEqual({})
  })

  it('includes a whitelisted key that is present in process.env', () => {
    process.env = {PATH: '/usr/bin:/bin'}
    expect(safeSystemEnv()).toEqual({PATH: '/usr/bin:/bin'})
  })

  it('includes all whitelisted keys that are present', () => {
    process.env = {PATH: '/usr/bin', HOME: '/home/user', LANG: 'en_US.UTF-8', UNRELATED: 'drop-me'}
    const result = safeSystemEnv()
    expect(result.PATH).toBe('/usr/bin')
    expect(result.HOME).toBe('/home/user')
    expect(result.LANG).toBe('en_US.UTF-8')
  })

  it('excludes keys that are not in the whitelist', () => {
    process.env = {PATH: '/usr/bin', OPENAI_API_KEY: 'secret', JWT_SECRET: 'tok', FIELD_ENCRYPTION_KEY: 'key'}
    const result = safeSystemEnv()
    expect(result).not.toHaveProperty('OPENAI_API_KEY')
    expect(result).not.toHaveProperty('JWT_SECRET')
    expect(result).not.toHaveProperty('FIELD_ENCRYPTION_KEY')
  })

  it('omits whitelisted keys whose value is undefined', () => {
    process.env = {}
    SAFE_ENV_KEYS.forEach(k => {
      delete process.env[k]
    })
    expect(safeSystemEnv()).toEqual({})
  })

  it('returns a new object on each call, not a reference to process.env', () => {
    process.env = {PATH: '/usr/bin'}
    const result = safeSystemEnv()
    expect(result).not.toBe(process.env)
  })

  it('does not include a key with an empty-string value when empty string is present', () => {
    process.env = {PATH: ''}
    const result = safeSystemEnv()
    expect(result).toHaveProperty('PATH', '')
  })
})
