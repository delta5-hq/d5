import crypto from 'crypto'

export class KeyValidator {
  static validate(secret, keyType) {
    if (!secret) {
      throw new Error(`${keyType} encryption key is required`)
    }

    if (process.env.NODE_ENV === 'production' && secret === 'test-jwt-secret-change-in-production') {
      throw new Error(`Production ${keyType} encryption key must be unique`)
    }
  }
}

export class KeyDerivation {
  constructor(secret, saltSuffix) {
    const fixedSalt = crypto
      .createHash('sha256')
      .update(secret + saltSuffix)
      .digest()
    this.derivedKey = crypto.pbkdf2Sync(secret, fixedSalt, 10000, 32, 'sha256')
  }

  getKey() {
    return this.derivedKey
  }
}

export class EncryptionKeyManager {
  constructor(primarySecret, legacySecret) {
    this.primarySecret = primarySecret
    this.legacySecret = legacySecret
    this.hasSeparateKeys = this.determineSeparateKeys()
  }

  determineSeparateKeys() {
    if (!this.primarySecret) return false
    if (!this.legacySecret) return false
    return this.primarySecret !== this.legacySecret
  }

  getActiveSecret() {
    return this.primarySecret || this.legacySecret
  }

  getPrimaryKey() {
    const activeSecret = this.getActiveSecret()
    KeyValidator.validate(activeSecret, 'Primary')
    return new KeyDerivation(activeSecret, 'field-encryption-salt').getKey()
  }

  getLegacyKey() {
    if (!this.hasSeparateKeys) return null
    KeyValidator.validate(this.legacySecret, 'Legacy')
    return new KeyDerivation(this.legacySecret, 'field-encryption-salt').getKey()
  }

  requiresDualKeyDecryption() {
    return this.hasSeparateKeys
  }
}
