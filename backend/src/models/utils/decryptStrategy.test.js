import crypto from 'crypto'
import {FallbackDecrypt} from './decryptStrategy'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

class TestCipher {
  encrypt(plaintext, key, additionalData = null) {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    if (additionalData) {
      cipher.setAAD(additionalData)
    }

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    return Buffer.concat([iv, authTag, encrypted]).toString('base64')
  }

  decrypt(ciphertext, key, additionalData = null) {
    const buffer = Buffer.from(ciphertext, 'base64')

    const iv = buffer.subarray(0, IV_LENGTH)
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    if (additionalData) {
      decipher.setAAD(additionalData)
    }
    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  }
}

describe('DecryptStrategy', () => {
  const cipher = new TestCipher()
  const key = crypto.pbkdf2Sync('test-secret', 'salt', 10000, 32, 'sha256')

  describe('FallbackDecrypt — AAD fallback mode (enforceAadBinding disabled)', () => {
    const strategy = new FallbackDecrypt(cipher)

    it('decrypts when AAD matches', () => {
      const ad = Buffer.from('context')
      const encrypted = cipher.encrypt('secret', key, ad)

      expect(strategy.decrypt(encrypted, key, ad)).toBe('secret')
    })

    it('falls back to null AAD when ciphertext lacks AAD binding', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const encrypted = cipher.encrypt('legacy-secret', key, null)

      expect(strategy.decrypt(encrypted, key, Buffer.from('any-context'))).toBe('legacy-secret')
      consoleWarn.mockRestore()
    })

    it('emits security warning on AAD binding fallback', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const encrypted = cipher.encrypt('legacy-secret', key, null)

      strategy.decrypt(encrypted, key, Buffer.from('any-context'))

      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('AAD fallback triggered'))
      consoleWarn.mockRestore()
    })

    it('throws when decryption fails on all attempts', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const wrongKey = crypto.pbkdf2Sync('different-secret', 'salt', 10000, 32, 'sha256')
      const encrypted = cipher.encrypt('secret', key, Buffer.from('context'))

      expect(() => strategy.decrypt(encrypted, wrongKey, Buffer.from('any-context'))).toThrow()
      consoleWarn.mockRestore()
    })

    it('throws when caller provides null AAD and ciphertext has AAD binding', () => {
      const encrypted = cipher.encrypt('secret', key, Buffer.from('context'))

      expect(() => strategy.decrypt(encrypted, key, null)).toThrow()
    })
  })

  describe('FallbackDecrypt — AAD binding enforcement (enforceAadBinding enabled)', () => {
    const strategy = new FallbackDecrypt(cipher, true)

    it('decrypts without interference when AAD matches', () => {
      const ad = Buffer.from('context')
      const encrypted = cipher.encrypt('secret', key, ad)

      expect(strategy.decrypt(encrypted, key, ad)).toBe('secret')
    })

    it('throws when ciphertext lacks AAD binding and includes original error', () => {
      const encrypted = cipher.encrypt('secret', key, null)
      const ad = Buffer.from('context')

      expect(() => strategy.decrypt(encrypted, key, ad)).toThrow(/AAD migration enforcement is active/)
      expect(() => strategy.decrypt(encrypted, key, ad)).toThrow(/Original:/)
    })

    it('enforcement is inactive when caller provides null AAD', () => {
      const encrypted = cipher.encrypt('secret', key, null)

      expect(strategy.decrypt(encrypted, key, null)).toBe('secret')
    })

    it('does not fall back when caller provides undefined AAD', () => {
      const encrypted = cipher.encrypt('secret', key, null)

      expect(strategy.decrypt(encrypted, key, undefined)).toBe('secret')
    })

    it('does not emit security warning when blocking fallback', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const encrypted = cipher.encrypt('secret', key, null)

      try {
        strategy.decrypt(encrypted, key, Buffer.from('context'))
      } catch {
        // expected
      }

      expect(consoleWarn).not.toHaveBeenCalled()
      consoleWarn.mockRestore()
    })
  })
})
