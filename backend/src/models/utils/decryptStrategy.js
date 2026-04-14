class FallbackDecrypt {
  constructor(cipher) {
    this.cipher = cipher
  }

  decrypt(ciphertext, key, additionalData) {
    try {
      return this.cipher.decrypt(ciphertext, key, additionalData)
    } catch (error) {
      if (additionalData !== null && additionalData !== undefined) {
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
