import crypto from 'crypto'
import {DualKeyDecryptStrategy} from './dualKeyDecryptStrategy'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

class TestCipher {
  encrypt(plaintext, key, aad = null) {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    if (aad) {
      cipher.setAAD(aad)
    }

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    return Buffer.concat([iv, authTag, encrypted]).toString('base64')
  }

  decrypt(ciphertext, key, aad = null) {
    const buffer = Buffer.from(ciphertext, 'base64')
    const iv = buffer.subarray(0, IV_LENGTH)
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    if (aad) {
      decipher.setAAD(aad)
    }
    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  }
}

describe('DualKeyDecryptStrategy', () => {
  const cipher = new TestCipher()
  let primaryKey
  let legacyKey
  let aad

  beforeEach(() => {
    primaryKey = crypto.randomBytes(32)
    legacyKey = crypto.randomBytes(32)
    aad = Buffer.from('user-123:integration:field')
  })

  describe('Single key decryption (no legacy key)', () => {
    it('decrypts with primary key and AAD', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, null)
      const ciphertext = cipher.encrypt('secret-data', primaryKey, aad)

      const result = strategy.decrypt(ciphertext, aad)

      expect(result).toBe('secret-data')
    })

    it('falls back to no-AAD when AAD verification fails', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, null)
      const ciphertext = cipher.encrypt('secret-data', primaryKey, null)

      const result = strategy.decrypt(ciphertext, aad)

      expect(result).toBe('secret-data')
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('AAD fallback triggered'))

      consoleWarn.mockRestore()
    })

    it('throws when primary key fails both AAD and no-AAD attempts', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, null)
      const wrongKey = crypto.randomBytes(32)
      const ciphertext = cipher.encrypt('secret', wrongKey, aad)

      expect(() => strategy.decrypt(ciphertext, aad)).toThrow()
    })

    it('preserves original error when decryption fails', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, null)
      const wrongKey = crypto.randomBytes(32)
      const ciphertext = cipher.encrypt('secret', wrongKey, null)

      expect(() => strategy.decrypt(ciphertext, aad)).toThrow(/Unsupported state or unable to authenticate data/)
    })
  })

  describe('Dual key decryption - Attempt order', () => {
    it('tries primary key with AAD first', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('primary-aad-data', primaryKey, aad)

      const result = strategy.decrypt(ciphertext, aad)

      expect(result).toBe('primary-aad-data')
    })

    it('tries primary key without AAD second', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('primary-no-aad', primaryKey, null)

      const result = strategy.decrypt(ciphertext, aad)

      expect(result).toBe('primary-no-aad')
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('AAD fallback'))
      expect(consoleWarn).not.toHaveBeenCalledWith(expect.stringContaining('Legacy'))

      consoleWarn.mockRestore()
    })

    it('tries legacy key with AAD third', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('legacy-aad-data', legacyKey, aad)

      const result = strategy.decrypt(ciphertext, aad)

      expect(result).toBe('legacy-aad-data')
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Legacy encryption key'))
      expect(consoleWarn).not.toHaveBeenCalledWith(expect.stringContaining('AAD fallback'))

      consoleWarn.mockRestore()
    })

    it('tries legacy key without AAD fourth (last resort)', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('legacy-no-aad', legacyKey, null)

      const result = strategy.decrypt(ciphertext, aad)

      expect(result).toBe('legacy-no-aad')
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Legacy encryption key'))
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('AAD fallback'))

      consoleWarn.mockRestore()
    })

    it('stops at first successful attempt without trying remaining', () => {
      const mockCipher = {
        decrypt: jest.fn().mockReturnValueOnce('success'),
      }
      const strategy = new DualKeyDecryptStrategy(mockCipher, primaryKey, legacyKey)

      strategy.decrypt('any-ciphertext', aad)

      expect(mockCipher.decrypt).toHaveBeenCalledTimes(1)
    })
  })

  describe('Dual key decryption - Error scenarios', () => {
    it('throws when all 4 attempts fail', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const wrongKey = crypto.randomBytes(32)
      const ciphertext = cipher.encrypt('secret', wrongKey, aad)

      expect(() => strategy.decrypt(ciphertext, aad)).toThrow()
    })

    it('returns last error when all attempts exhausted', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const wrongKey = crypto.randomBytes(32)
      const ciphertext = cipher.encrypt('secret', wrongKey, null)

      let caughtError
      try {
        strategy.decrypt(ciphertext, aad)
      } catch (e) {
        caughtError = e
      }

      expect(caughtError).toBeDefined()
      expect(caughtError.message).toMatch(/Unsupported state or unable to authenticate data/)
    })
  })

  describe('Logging behavior', () => {
    it('logs warning when legacy key succeeds', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('old-data', legacyKey, aad)

      strategy.decrypt(ciphertext, aad)

      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Legacy encryption key used'))
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Re-save integration entry'))

      consoleWarn.mockRestore()
    })

    it('logs warning when AAD fallback succeeds', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('no-aad-data', primaryKey, null)

      strategy.decrypt(ciphertext, aad)

      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('AAD fallback triggered'))
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('AAD-protected encryption'))

      consoleWarn.mockRestore()
    })

    it('logs both warnings when legacy key without AAD succeeds', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('old-no-aad', legacyKey, null)

      strategy.decrypt(ciphertext, aad)

      const warnings = consoleWarn.mock.calls.map(c => c[0])
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Legacy encryption key'),
          expect.stringContaining('AAD fallback'),
        ]),
      )

      consoleWarn.mockRestore()
    })

    it('does not log when primary key with AAD succeeds', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('current-data', primaryKey, aad)

      strategy.decrypt(ciphertext, aad)

      expect(consoleWarn).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
    })

    it('includes actionable remediation in warning messages', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('old', legacyKey, null)

      strategy.decrypt(ciphertext, aad)

      const warnings = consoleWarn.mock.calls.map(c => c[0])
      expect(warnings.some(w => w.includes('Re-save'))).toBe(true)

      consoleWarn.mockRestore()
    })
  })

  describe('AAD parameter handling', () => {
    it('handles null AAD in request', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('data', primaryKey, null)

      const result = strategy.decrypt(ciphertext, null)

      expect(result).toBe('data')
    })

    it('handles undefined AAD in request', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('data', primaryKey, null)

      const result = strategy.decrypt(ciphertext, undefined)

      expect(result).toBe('data')
    })

    it('handles Buffer AAD', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const bufferAAD = Buffer.from('context-data')
      const ciphertext = cipher.encrypt('data', primaryKey, bufferAAD)

      const result = strategy.decrypt(ciphertext, bufferAAD)

      expect(result).toBe('data')
    })

    it('distinguishes between null and undefined AAD', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, null)
      const ciphertext = cipher.encrypt('data', primaryKey, null)

      strategy.decrypt(ciphertext, null)
      expect(consoleWarn).not.toHaveBeenCalled()

      strategy.decrypt(ciphertext, undefined)
      expect(consoleWarn).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
    })
  })

  describe('Data integrity', () => {
    it('maintains plaintext integrity through fallback chain', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const plaintext = 'sensitive-data-with-special-chars-!@#$%^&*()'
      const ciphertext = cipher.encrypt(plaintext, legacyKey, null)

      const result = strategy.decrypt(ciphertext, aad)

      expect(result).toBe(plaintext)
    })

    it('maintains UTF-8 multibyte character integrity', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const plaintext = '密钥-秘密-数据'
      const ciphertext = cipher.encrypt(plaintext, primaryKey, aad)

      const result = strategy.decrypt(ciphertext, aad)

      expect(result).toBe(plaintext)
    })

    it('handles empty string plaintext', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('', primaryKey, aad)

      const result = strategy.decrypt(ciphertext, aad)

      expect(result).toBe('')
    })

    it('handles large plaintext payloads', () => {
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const largePlaintext = 'x'.repeat(10000)
      const ciphertext = cipher.encrypt(largePlaintext, primaryKey, aad)

      const result = strategy.decrypt(ciphertext, aad)

      expect(result).toBe(largePlaintext)
    })
  })

  describe('Migration detection patterns', () => {
    it('detects data needing key migration only', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('old-key-data', legacyKey, aad)

      strategy.decrypt(ciphertext, aad)

      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Legacy encryption key'))
      expect(consoleWarn).not.toHaveBeenCalledWith(expect.stringContaining('AAD fallback'))

      consoleWarn.mockRestore()
    })

    it('detects data needing AAD migration only', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('no-aad-data', primaryKey, null)

      strategy.decrypt(ciphertext, aad)

      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('AAD fallback'))
      expect(consoleWarn).not.toHaveBeenCalledWith(expect.stringContaining('Legacy encryption key'))

      consoleWarn.mockRestore()
    })

    it('detects data needing both key and AAD migration', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('old-unprotected', legacyKey, null)

      strategy.decrypt(ciphertext, aad)

      const warnings = consoleWarn.mock.calls.map(c => c[0])
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Legacy encryption key'),
          expect.stringContaining('AAD fallback'),
        ]),
      )

      consoleWarn.mockRestore()
    })

    it('detects fully migrated data (no warnings)', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
      const ciphertext = cipher.encrypt('new-protected-data', primaryKey, aad)

      strategy.decrypt(ciphertext, aad)

      expect(consoleWarn).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
    })
  })
})
