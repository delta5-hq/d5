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

  describe('FallbackDecrypt', () => {
    const fallback = new FallbackDecrypt(cipher)

    it('decrypts with matching AD', () => {
      const ad = Buffer.from('context')
      const encrypted = cipher.encrypt('secret', key, ad)

      const decrypted = fallback.decrypt(encrypted, key, ad)
      expect(decrypted).toBe('secret')
    })

    it('falls back to nil when AD mismatches', () => {
      const encrypted = cipher.encrypt('legacy-secret', key, null)
      const wrongAD = Buffer.from('wrong-context')

      const decrypted = fallback.decrypt(encrypted, key, wrongAD)
      expect(decrypted).toBe('legacy-secret')
    })

    it('throws when both AD and nil fail', () => {
      const ad = Buffer.from('context')
      const encrypted = cipher.encrypt('secret', key, ad)

      const wrongKey = crypto.pbkdf2Sync('different-secret', 'salt', 10000, 32, 'sha256')

      expect(() => fallback.decrypt(encrypted, wrongKey, Buffer.from('any-ad'))).toThrow()
    })

    it('does not fallback when AD is nil', () => {
      const ad = Buffer.from('context')
      const encrypted = cipher.encrypt('secret', key, ad)

      expect(() => fallback.decrypt(encrypted, key, null)).toThrow()
    })
  })
})
