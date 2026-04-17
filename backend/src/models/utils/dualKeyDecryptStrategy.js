export class DualKeyDecryptStrategy {
  constructor(cipher, primaryKey, legacyKey) {
    this.cipher = cipher
    this.primaryKey = primaryKey
    this.legacyKey = legacyKey
  }

  decrypt(ciphertext, _key, additionalData) {
    const attempts = [
      {key: this.primaryKey, aad: additionalData, keyType: 'primary', aadState: 'with-aad'},
      {key: this.primaryKey, aad: null, keyType: 'primary', aadState: 'no-aad'},
    ]

    if (this.legacyKey) {
      attempts.push(
        {key: this.legacyKey, aad: additionalData, keyType: 'legacy', aadState: 'with-aad'},
        {key: this.legacyKey, aad: null, keyType: 'legacy', aadState: 'no-aad'},
      )
    }

    let lastError = null

    for (const {key, aad, keyType, aadState} of attempts) {
      try {
        const plaintext = this.cipher.decrypt(ciphertext, key, aad)
        this.logSuccessfulDecryption(keyType, aadState, additionalData)
        return plaintext
      } catch (error) {
        lastError = error
      }
    }

    throw lastError
  }

  logSuccessfulDecryption(keyType, aadState, requestedAAD) {
    if (keyType === 'legacy') {
      console.warn(
        '[SECURITY] Legacy encryption key used for decryption. ' +
          'Re-save integration entry to migrate to primary key.',
      )
    }

    if (aadState === 'no-aad' && requestedAAD !== null && requestedAAD !== undefined) {
      console.warn(
        '[SECURITY] AAD fallback triggered — data encrypted without AAD binding. ' +
          'Re-save integration entry to migrate to AAD-protected encryption.',
      )
    }
  }
}
