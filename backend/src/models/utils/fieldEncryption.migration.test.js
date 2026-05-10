import {encryptFields, decryptFields, __resetForTesting} from './fieldEncryption'
import {EncryptionKeyManager} from './encryptionKeyManager'
import {DualKeyDecryptStrategy} from './dualKeyDecryptStrategy'
import {FallbackDecrypt} from './decryptStrategy'
import crypto from 'crypto'

describe('Field Encryption - Key and AAD Migration Scenarios', () => {
  beforeEach(() => {
    __resetForTesting()
  })

  describe('EncryptionKeyManager - Key selection strategy', () => {
    describe('Single key mode behavior', () => {
      it('uses primary key when both keys are identical', () => {
        const manager = new EncryptionKeyManager('same-key', 'same-key')

        expect(manager.requiresDualKeyDecryption()).toBe(false)
        expect(manager.getLegacyKey()).toBe(null)
      })

      it('uses legacy key as fallback when primary is unset', () => {
        const manager = new EncryptionKeyManager(null, 'jwt-secret')

        expect(manager.getActiveSecret()).toBe('jwt-secret')
        expect(manager.requiresDualKeyDecryption()).toBe(false)
      })

      it('generates same derived key regardless of which slot secret occupies', () => {
        const manager1 = new EncryptionKeyManager('my-key', null)
        const manager2 = new EncryptionKeyManager(null, 'my-key')

        const key1 = manager1.getPrimaryKey()
        const key2 = manager2.getPrimaryKey()

        expect(key1.equals(key2)).toBe(true)
      })
    })

    describe('Dual key mode activation conditions', () => {
      it('enables when primary and legacy keys differ', () => {
        const manager = new EncryptionKeyManager('new-key', 'old-key')

        expect(manager.requiresDualKeyDecryption()).toBe(true)
      })

      it('provides both keys when in dual mode', () => {
        const manager = new EncryptionKeyManager('primary', 'legacy')

        const primaryKey = manager.getPrimaryKey()
        const legacyKey = manager.getLegacyKey()

        expect(primaryKey).not.toBeNull()
        expect(legacyKey).not.toBeNull()
        expect(primaryKey.equals(legacyKey)).toBe(false)
      })

      it('always encrypts with primary key in dual mode', () => {
        const manager = new EncryptionKeyManager('new-encryption-key', 'old-jwt-secret')

        expect(manager.getActiveSecret()).toBe('new-encryption-key')
      })
    })

    describe('Key derivation consistency', () => {
      it('derives primary key using standard salt', () => {
        const manager = new EncryptionKeyManager('field-key', 'jwt-key')
        const derivedKey = manager.getPrimaryKey()

        expect(derivedKey).toBeInstanceOf(Buffer)
        expect(derivedKey.length).toBe(32)
      })

      it('derives different cryptographic keys from different secrets', () => {
        const manager = new EncryptionKeyManager('key-A', 'key-B')

        const primaryKey = manager.getPrimaryKey()
        const legacyKey = manager.getLegacyKey()

        expect(primaryKey.equals(legacyKey)).toBe(false)
      })
    })
  })

  describe('Decrypt strategy polymorphism', () => {
    const createCipher = () => ({
      encrypt(plaintext, key, aad) {
        const iv = crypto.randomBytes(16)
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
        if (aad) cipher.setAAD(aad)
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
        const authTag = cipher.getAuthTag()
        return Buffer.concat([iv, authTag, encrypted]).toString('base64')
      },
      decrypt(ciphertext, key, aad) {
        const buffer = Buffer.from(ciphertext, 'base64')
        const iv = buffer.subarray(0, 16)
        const authTag = buffer.subarray(16, 32)
        const encrypted = buffer.subarray(32)
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
        if (aad) decipher.setAAD(aad)
        decipher.setAuthTag(authTag)
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
      },
    })

    const createMockService = (strategy, key) => ({
      key,
      decryptStrategy: strategy,
      decrypt(markedCiphertext, additionalData) {
        if (!markedCiphertext) return null
        if (!markedCiphertext.startsWith('__encrypted__')) return markedCiphertext
        const ciphertext = markedCiphertext.replace('__encrypted__', '')
        return this.decryptStrategy.decrypt(ciphertext, this.key, additionalData)
      },
    })

    describe('DualKeyDecryptStrategy through service layer', () => {
      it('decrypts with primary key and AAD through 3-arg interface', () => {
        const cipher = createCipher()
        const primaryKey = crypto.randomBytes(32)
        const legacyKey = crypto.randomBytes(32)
        const aad = Buffer.from('user-123:integration:mcp.env')

        const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
        const service = createMockService(strategy, primaryKey)

        const ciphertext = cipher.encrypt('secret-value', primaryKey, aad)
        const markedCiphertext = '__encrypted__' + ciphertext

        expect(service.decrypt(markedCiphertext, aad)).toBe('secret-value')
      })

      it('decrypts with legacy key through 3-arg interface', () => {
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
        const cipher = createCipher()
        const primaryKey = crypto.randomBytes(32)
        const legacyKey = crypto.randomBytes(32)
        const aad = Buffer.from('user-456:integration:rpc.privateKey')

        const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
        const service = createMockService(strategy, primaryKey)

        const ciphertext = cipher.encrypt('old-key-data', legacyKey, aad)
        const markedCiphertext = '__encrypted__' + ciphertext

        expect(service.decrypt(markedCiphertext, aad)).toBe('old-key-data')
        expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Legacy encryption key'))

        consoleWarn.mockRestore()
      })

      it('falls back to nil AAD through 3-arg interface', () => {
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
        const cipher = createCipher()
        const primaryKey = crypto.randomBytes(32)
        const legacyKey = crypto.randomBytes(32)
        const aad = Buffer.from('user-789:integration:mcp.headers')

        const strategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
        const service = createMockService(strategy, primaryKey)

        const ciphertext = cipher.encrypt('no-aad-data', primaryKey, null)
        const markedCiphertext = '__encrypted__' + ciphertext

        expect(service.decrypt(markedCiphertext, aad)).toBe('no-aad-data')
        expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('AAD fallback'))

        consoleWarn.mockRestore()
      })
    })

    describe('FallbackDecrypt through service layer', () => {
      it('decrypts with matching AAD through 3-arg interface', () => {
        const cipher = createCipher()
        const key = crypto.randomBytes(32)
        const aad = Buffer.from('user-100:integration:openai.apiKey')

        const strategy = new FallbackDecrypt(cipher)
        const service = createMockService(strategy, key)

        const ciphertext = cipher.encrypt('api-key-value', key, aad)
        const markedCiphertext = '__encrypted__' + ciphertext

        expect(service.decrypt(markedCiphertext, aad)).toBe('api-key-value')
      })

      it('falls back to nil AAD through 3-arg interface', () => {
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
        const cipher = createCipher()
        const key = crypto.randomBytes(32)
        const requestedAAD = Buffer.from('user-200:integration:yandex.apiKey')

        const strategy = new FallbackDecrypt(cipher)
        const service = createMockService(strategy, key)

        const ciphertext = cipher.encrypt('legacy-data', key, null)
        const markedCiphertext = '__encrypted__' + ciphertext

        expect(service.decrypt(markedCiphertext, requestedAAD)).toBe('legacy-data')
        expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('AAD fallback'))

        consoleWarn.mockRestore()
      })
    })
  })

  describe('fieldEncryption integration - Current environment behavior', () => {
    const testConfig = {
      fields: ['apiKey'],
    }

    const testData = {
      apiKey: 'secret-value-123',
    }

    const encryptionContext = {
      userId: 'user-test',
      workflowId: null,
    }

    it('encrypts and decrypts successfully in current environment', () => {
      const encrypted = encryptFields(testData, testConfig, encryptionContext)

      expect(encrypted.apiKey).toMatch(/^__encrypted__/)
      expect(encrypted.apiKey).not.toBe('secret-value-123')

      const decrypted = decryptFields(encrypted, testConfig, encryptionContext)

      expect(decrypted).toEqual(testData)
    })

    it('produces non-deterministic ciphertext on repeated encryption', () => {
      const encrypted1 = encryptFields(testData, testConfig, encryptionContext)
      const encrypted2 = encryptFields(testData, testConfig, encryptionContext)

      expect(encrypted1.apiKey).not.toBe(encrypted2.apiKey)

      const decrypted1 = decryptFields(encrypted1, testConfig, encryptionContext)
      const decrypted2 = decryptFields(encrypted2, testConfig, encryptionContext)

      expect(decrypted1).toEqual(testData)
      expect(decrypted2).toEqual(testData)
    })

    it('maintains data integrity with null encryption context', () => {
      const encrypted = encryptFields(testData, testConfig, null)
      const decrypted = decryptFields(encrypted, testConfig, null)

      expect(decrypted).toEqual(testData)
    })

    it('maintains data integrity with undefined encryption context', () => {
      const encrypted = encryptFields(testData, testConfig, undefined)
      const decrypted = decryptFields(encrypted, testConfig, undefined)

      expect(decrypted).toEqual(testData)
    })

    it('handles special characters in plaintext', () => {
      const specialData = {apiKey: 'key!@#$%^&*()_+-=[]{}|;:,.<>?'}
      const encrypted = encryptFields(specialData, testConfig, encryptionContext)
      const decrypted = decryptFields(encrypted, testConfig, encryptionContext)

      expect(decrypted).toEqual(specialData)
    })

    it('handles UTF-8 multibyte characters in plaintext', () => {
      const utf8Data = {apiKey: '密钥-秘密-数据'}
      const encrypted = encryptFields(utf8Data, testConfig, encryptionContext)
      const decrypted = decryptFields(encrypted, testConfig, encryptionContext)

      expect(decrypted).toEqual(utf8Data)
    })

    it('handles empty string values', () => {
      const emptyData = {apiKey: ''}
      const encrypted = encryptFields(emptyData, testConfig, encryptionContext)
      const decrypted = decryptFields(encrypted, testConfig, encryptionContext)

      expect(decrypted).toEqual(emptyData)
    })

    it('handles large payloads', () => {
      const largeData = {apiKey: 'x'.repeat(10000)}
      const encrypted = encryptFields(largeData, testConfig, encryptionContext)
      const decrypted = decryptFields(encrypted, testConfig, encryptionContext)

      expect(decrypted).toEqual(largeData)
    })
  })
})

describe('AAD migration deadline enforcement — factory wiring', () => {
  const config = {fields: ['apiKey']}
  const dataWithoutAad = {apiKey: 'plaintext-value'}

  const pastDeadline = new Date(Date.now() - 60_000).toISOString()
  const futureDeadline = new Date(Date.now() + 60_000).toISOString()

  const contextWithAad = {userId: 'user-deadline-test', workflowId: null}

  beforeEach(() => {
    __resetForTesting()
    delete process.env.AAD_MIGRATION_DEADLINE
  })

  afterEach(() => {
    __resetForTesting()
    delete process.env.AAD_MIGRATION_DEADLINE
  })

  it('throws on no-AAD ciphertext when deadline is exceeded and caller provides AAD', () => {
    const encryptedWithoutAad = encryptFields(dataWithoutAad, config, null)

    __resetForTesting()
    process.env.AAD_MIGRATION_DEADLINE = pastDeadline

    expect(() => decryptFields(encryptedWithoutAad, config, contextWithAad)).toThrow(
      /AAD migration enforcement is active/,
    )
  })

  it('succeeds with fallback and warns when deadline is unset and ciphertext lacks AAD', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()

    const encryptedWithoutAad = encryptFields(dataWithoutAad, config, null)

    __resetForTesting()

    const result = decryptFields(encryptedWithoutAad, config, contextWithAad)

    expect(result).toEqual(dataWithoutAad)
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('AAD fallback triggered'))

    consoleWarn.mockRestore()
  })

  it('succeeds when deadline is exceeded but ciphertext carries matching AAD', () => {
    const encryptedWithAad = encryptFields(dataWithoutAad, config, contextWithAad)

    __resetForTesting()
    process.env.AAD_MIGRATION_DEADLINE = pastDeadline

    const result = decryptFields(encryptedWithAad, config, contextWithAad)

    expect(result).toEqual(dataWithoutAad)
  })

  it('allows fallback when deadline is set but has not yet passed', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()

    const encryptedWithoutAad = encryptFields(dataWithoutAad, config, null)

    __resetForTesting()
    process.env.AAD_MIGRATION_DEADLINE = futureDeadline

    const result = decryptFields(encryptedWithoutAad, config, contextWithAad)

    expect(result).toEqual(dataWithoutAad)

    consoleWarn.mockRestore()
  })

  it('allows decryption when deadline is exceeded but caller passes null context', () => {
    const encryptedWithoutAad = encryptFields(dataWithoutAad, config, null)

    __resetForTesting()
    process.env.AAD_MIGRATION_DEADLINE = pastDeadline

    const result = decryptFields(encryptedWithoutAad, config, null)

    expect(result).toEqual(dataWithoutAad)
  })
})
