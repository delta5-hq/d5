const AAD_ENFORCEMENT_MESSAGE =
  'Decryption failed — ciphertext lacks AAD binding and AAD migration enforcement is active. ' +
  'Re-save integration to migrate.'

class FallbackDecrypt {
  constructor(cipher, enforceAadBinding = false) {
    this.cipher = cipher
    this.enforceAadBinding = enforceAadBinding
  }

  decrypt(ciphertext, key, additionalData) {
    try {
      return this.cipher.decrypt(ciphertext, key, additionalData)
    } catch (error) {
      if (additionalData !== null && additionalData !== undefined) {
        if (this.enforceAadBinding) {
          throw new Error(`${AAD_ENFORCEMENT_MESSAGE} Original: ${error.message}`)
        }
        console.warn(
          '[SECURITY] AAD fallback triggered — data encrypted without AAD binding. ' +
            'Re-save integration entry to migrate to AAD-protected encryption.',
        )
        return this.cipher.decrypt(ciphertext, key, null)
      }
      throw error
    }
  }
}

export {FallbackDecrypt}
