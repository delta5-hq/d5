class FallbackDecrypt {
  constructor(cipher) {
    this.cipher = cipher
  }

  decrypt(ciphertext, key, additionalData) {
    try {
      return this.cipher.decrypt(ciphertext, key, additionalData)
    } catch (error) {
      if (additionalData !== null && additionalData !== undefined) {
        return this.cipher.decrypt(ciphertext, key, null)
      }
      throw error
    }
  }
}

export {FallbackDecrypt}
