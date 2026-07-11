import {EnvironmentValidator} from '../../bootstrap/EnvironmentValidator'

describe('EnvironmentValidator', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {...originalEnv}
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('validate', () => {
    it('should pass when all required variables are present', () => {
      process.env.D5_USER_ID = 'test-user-123'
      const validator = new EnvironmentValidator(['D5_USER_ID'])

      expect(() => validator.validate()).not.toThrow()
    })

    it('should throw when required variable is missing', () => {
      delete process.env.D5_USER_ID
      const validator = new EnvironmentValidator(['D5_USER_ID'])

      expect(() => validator.validate()).toThrow('Missing required environment variables: D5_USER_ID')
    })

    it('should throw for multiple missing variables', () => {
      delete process.env.D5_USER_ID
      delete process.env.OTHER_VAR
      const validator = new EnvironmentValidator(['D5_USER_ID', 'OTHER_VAR'])

      expect(() => validator.validate()).toThrow('Missing required environment variables: D5_USER_ID, OTHER_VAR')
    })
  })

  describe('getUserId', () => {
    it('should return userId from environment', () => {
      process.env.D5_USER_ID = 'test-user-456'
      const validator = new EnvironmentValidator()

      expect(validator.getUserId()).toBe('test-user-456')
    })
  })
})
