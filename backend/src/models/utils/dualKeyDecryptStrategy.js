const AAD_ENFORCEMENT_MESSAGE =
  'Decryption failed — ciphertext lacks AAD binding and AAD migration enforcement is active. ' +
  'Re-save integration to migrate.'

export class DualKeyDecryptStrategy {
  constructor(cipher, primaryKey, legacyKey, enforceAadBinding = false) {
    this.cipher = cipher
    this.primaryKey = primaryKey
    this.legacyKey = legacyKey
    this.enforceAadBinding = enforceAadBinding
  }

  decrypt(ciphertext, _key, additionalData) {
    const attempts = this.buildAttempts(additionalData)
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

    if (this.enforceAadBinding && additionalData != null) {
      throw new Error(`${AAD_ENFORCEMENT_MESSAGE} Original: ${lastError.message}`)
    }

    throw lastError
  }

  buildAttempts(additionalData) {
    const blockNoAadFallback = this.enforceAadBinding && additionalData != null

    const attempts = [
      {
        key: this.primaryKey,
        aad: additionalData,
        keyType: 'primary',
        aadState: 'with-aad',
      },
    ]

    if (!blockNoAadFallback) {
      attempts.push({
        key: this.primaryKey,
        aad: null,
        keyType: 'primary',
        aadState: 'no-aad',
      })
    }

    if (this.legacyKey) {
      attempts.push({
        key: this.legacyKey,
        aad: additionalData,
        keyType: 'legacy',
        aadState: 'with-aad',
      })
      if (!blockNoAadFallback) {
        attempts.push({
          key: this.legacyKey,
          aad: null,
          keyType: 'legacy',
          aadState: 'no-aad',
        })
      }
    }

    return attempts
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
