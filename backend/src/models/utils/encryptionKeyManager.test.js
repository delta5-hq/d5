import {EncryptionKeyManager, KeyValidator, KeyDerivation} from './encryptionKeyManager'

describe('EncryptionKeyManager', () => {
  describe('KeyValidator', () => {
    describe('secret presence validation', () => {
      it('throws when secret is null', () => {
        expect(() => KeyValidator.validate(null, 'Test')).toThrow('Test encryption key is required')
      })

      it('throws when secret is undefined', () => {
        expect(() => KeyValidator.validate(undefined, 'Test')).toThrow('Test encryption key is required')
      })

      it('throws when secret is empty string', () => {
        expect(() => KeyValidator.validate('', 'Test')).toThrow('Test encryption key is required')
      })

      it('accepts non-empty string', () => {
        expect(() => KeyValidator.validate('valid-key', 'Test')).not.toThrow()
      })
    })

    describe('production environment validation', () => {
      const originalEnv = process.env.NODE_ENV

      afterEach(() => {
        process.env.NODE_ENV = originalEnv
      })

      it('rejects default test secret in production', () => {
        process.env.NODE_ENV = 'production'

        expect(() => KeyValidator.validate('test-jwt-secret-change-in-production', 'Test')).toThrow(
          'Production Test encryption key must be unique',
        )
      })

      it('allows default test secret in development', () => {
        process.env.NODE_ENV = 'development'

        expect(() => KeyValidator.validate('test-jwt-secret-change-in-production', 'Test')).not.toThrow()
      })

      it('allows default test secret in test environment', () => {
        process.env.NODE_ENV = 'test'

        expect(() => KeyValidator.validate('test-jwt-secret-change-in-production', 'Test')).not.toThrow()
      })

      it('allows custom secrets in production', () => {
        process.env.NODE_ENV = 'production'

        expect(() => KeyValidator.validate('production-secure-key-123', 'Test')).not.toThrow()
      })
    })
  })

  describe('KeyDerivation', () => {
    describe('deterministic key generation', () => {
      it('derives consistent key from same secret and salt', () => {
        const key1 = new KeyDerivation('my-secret', 'my-salt').getKey()
        const key2 = new KeyDerivation('my-secret', 'my-salt').getKey()

        expect(key1.equals(key2)).toBe(true)
      })

      it('derives different keys from different secrets', () => {
        const key1 = new KeyDerivation('secret-A', 'salt').getKey()
        const key2 = new KeyDerivation('secret-B', 'salt').getKey()

        expect(key1.equals(key2)).toBe(false)
      })

      it('derives different keys from different salts', () => {
        const key1 = new KeyDerivation('secret', 'salt-A').getKey()
        const key2 = new KeyDerivation('secret', 'salt-B').getKey()

        expect(key1.equals(key2)).toBe(false)
      })

      it('derives different keys when both secret and salt differ', () => {
        const key1 = new KeyDerivation('secret-A', 'salt-A').getKey()
        const key2 = new KeyDerivation('secret-B', 'salt-B').getKey()

        expect(key1.equals(key2)).toBe(false)
      })
    })

    describe('key properties', () => {
      it('returns Buffer instance', () => {
        const key = new KeyDerivation('secret', 'salt').getKey()

        expect(key).toBeInstanceOf(Buffer)
      })

      it('derives 256-bit (32-byte) key for AES-256-GCM', () => {
        const key = new KeyDerivation('secret', 'salt').getKey()

        expect(key.length).toBe(32)
      })

      it('produces non-zero key material', () => {
        const key = new KeyDerivation('secret', 'salt').getKey()
        const allZero = key.every(byte => byte === 0)

        expect(allZero).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('handles special characters in secret', () => {
        const key = new KeyDerivation('secret!@#$%^&*()', 'salt').getKey()

        expect(key).toBeInstanceOf(Buffer)
        expect(key.length).toBe(32)
      })

      it('handles UTF-8 multibyte characters in secret', () => {
        const key = new KeyDerivation('密钥-秘密', 'salt').getKey()

        expect(key).toBeInstanceOf(Buffer)
        expect(key.length).toBe(32)
      })

      it('handles very long secrets', () => {
        const longSecret = 'a'.repeat(1000)
        const key = new KeyDerivation(longSecret, 'salt').getKey()

        expect(key).toBeInstanceOf(Buffer)
        expect(key.length).toBe(32)
      })
    })
  })

  describe('EncryptionKeyManager - Key selection logic', () => {
    describe('single key mode - primary unset', () => {
      it('uses legacy key when primary is null', () => {
        const manager = new EncryptionKeyManager(null, 'jwt-secret')

        expect(manager.getActiveSecret()).toBe('jwt-secret')
        expect(manager.requiresDualKeyDecryption()).toBe(false)
        expect(manager.getLegacyKey()).toBe(null)
      })

      it('uses legacy key when primary is undefined', () => {
        const manager = new EncryptionKeyManager(undefined, 'jwt-secret')

        expect(manager.getActiveSecret()).toBe('jwt-secret')
        expect(manager.requiresDualKeyDecryption()).toBe(false)
      })
    })

    describe('single key mode - keys identical', () => {
      it('disables dual-key when both are same', () => {
        const manager = new EncryptionKeyManager('shared-key', 'shared-key')

        expect(manager.getActiveSecret()).toBe('shared-key')
        expect(manager.requiresDualKeyDecryption()).toBe(false)
        expect(manager.getLegacyKey()).toBe(null)
      })

      it('compares keys by value not reference', () => {
        const key1 = String('same-key')
        const key2 = String('same-key')
        const manager = new EncryptionKeyManager(key1, key2)

        expect(manager.requiresDualKeyDecryption()).toBe(false)
      })
    })

    describe('dual key mode - keys different', () => {
      it('enables dual-key decryption when keys differ', () => {
        const manager = new EncryptionKeyManager('new-key', 'old-key')

        expect(manager.requiresDualKeyDecryption()).toBe(true)
      })

      it('provides both primary and legacy keys', () => {
        const manager = new EncryptionKeyManager('new-key', 'old-key')

        const primaryKey = manager.getPrimaryKey()
        const legacyKey = manager.getLegacyKey()

        expect(primaryKey).toBeInstanceOf(Buffer)
        expect(legacyKey).toBeInstanceOf(Buffer)
        expect(primaryKey.length).toBe(32)
        expect(legacyKey.length).toBe(32)
      })

      it('derives cryptographically different keys', () => {
        const manager = new EncryptionKeyManager('new-key', 'old-key')

        const primaryKey = manager.getPrimaryKey()
        const legacyKey = manager.getLegacyKey()

        expect(primaryKey.equals(legacyKey)).toBe(false)
      })

      it('uses primary key for active secret', () => {
        const manager = new EncryptionKeyManager('field-key', 'jwt-key')

        expect(manager.getActiveSecret()).toBe('field-key')
      })
    })

    describe('key derivation correctness', () => {
      it('derives primary key from FIELD_ENCRYPTION_KEY with standard salt', () => {
        const manager = new EncryptionKeyManager('field-key', 'jwt-key')
        const expectedKey = new KeyDerivation('field-key', 'field-encryption-salt').getKey()

        expect(manager.getPrimaryKey().equals(expectedKey)).toBe(true)
      })

      it('derives legacy key from JWT_SECRET with standard salt', () => {
        const manager = new EncryptionKeyManager('field-key', 'jwt-key')
        const expectedKey = new KeyDerivation('jwt-key', 'field-encryption-salt').getKey()

        expect(manager.getLegacyKey().equals(expectedKey)).toBe(true)
      })

      it('uses same salt for both keys to ensure consistent derivation', () => {
        const manager1 = new EncryptionKeyManager('key', null)
        const manager2 = new EncryptionKeyManager(null, 'key')

        expect(manager1.getPrimaryKey().equals(manager2.getPrimaryKey())).toBe(true)
      })
    })
  })

  describe('EncryptionKeyManager - Validation behavior', () => {
    it('throws when both keys are null', () => {
      const manager = new EncryptionKeyManager(null, null)

      expect(() => manager.getPrimaryKey()).toThrow('Primary encryption key is required')
    })

    it('throws when both keys are undefined', () => {
      const manager = new EncryptionKeyManager(undefined, undefined)

      expect(() => manager.getPrimaryKey()).toThrow('Primary encryption key is required')
    })

    it('validates on getPrimaryKey call not construction', () => {
      expect(() => new EncryptionKeyManager(null, null)).not.toThrow()
    })

    it('validates legacy key only in dual mode', () => {
      const manager = new EncryptionKeyManager('new-key', 'old-key')

      expect(() => manager.getLegacyKey()).not.toThrow()
    })
  })

  describe('EncryptionKeyManager - Edge cases', () => {
    it('handles whitespace-only keys correctly', () => {
      const manager = new EncryptionKeyManager('   ', 'valid-key')

      expect(manager.getActiveSecret()).toBe('   ')
    })

    it('treats empty string primary with valid legacy as using legacy', () => {
      const manager = new EncryptionKeyManager('', 'jwt-secret')

      expect(manager.getActiveSecret()).toBe('jwt-secret')
      expect(manager.requiresDualKeyDecryption()).toBe(false)
    })

    it('handles case-sensitive key comparison', () => {
      const manager = new EncryptionKeyManager('Key', 'key')

      expect(manager.requiresDualKeyDecryption()).toBe(true)
    })

    it('handles empty string in both keys', () => {
      const manager = new EncryptionKeyManager('', '')

      expect(() => manager.getPrimaryKey()).toThrow('Primary encryption key is required')
    })
  })
})
