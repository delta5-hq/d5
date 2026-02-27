import crypto from 'crypto'
import {JWT_SECRET} from '../../constants'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const ENCRYPTED_PREFIX = '__encrypted__'

class DeterministicKeyDerivation {
  constructor(secret) {
    this.validateSecret(secret)
    this.derivedKey = this.deriveKeyFromSecret(secret)
  }

  validateSecret(secret) {
    if (!secret) {
      throw new Error('Encryption secret is required')
    }
    if (process.env.NODE_ENV === 'production' && secret === 'test-jwt-secret-change-in-production') {
      throw new Error('Production encryption secret must be unique')
    }
  }

  deriveKeyFromSecret(secret) {
    const fixedSalt = crypto
      .createHash('sha256')
      .update(secret + 'field-encryption-salt')
      .digest()
    return crypto.pbkdf2Sync(secret, fixedSalt, 10000, 32, 'sha256')
  }

  getKey() {
    return this.derivedKey
  }
}

class AESCipher {
  encrypt(plaintext, key) {
    if (!plaintext) return null

    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    return Buffer.concat([iv, authTag, encrypted]).toString('base64')
  }

  decrypt(ciphertext, key) {
    if (!ciphertext) return null

    const buffer = Buffer.from(ciphertext, 'base64')

    const iv = buffer.subarray(0, IV_LENGTH)
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  }
}

class EncryptionMarker {
  static mark(ciphertext) {
    return ENCRYPTED_PREFIX + ciphertext
  }

  static isMarked(value) {
    return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)
  }

  static unmark(markedValue) {
    return markedValue.replace(ENCRYPTED_PREFIX, '')
  }
}

class EncryptionService {
  constructor(keyDerivation, cipher) {
    this.key = keyDerivation.getKey()
    this.cipher = cipher
  }

  encrypt(plaintext) {
    if (!plaintext) return null
    if (EncryptionMarker.isMarked(plaintext)) return plaintext
    const ciphertext = this.cipher.encrypt(plaintext, this.key)
    return EncryptionMarker.mark(ciphertext)
  }

  decrypt(markedCiphertext) {
    if (!markedCiphertext) return null
    if (!EncryptionMarker.isMarked(markedCiphertext)) return markedCiphertext
    const ciphertext = EncryptionMarker.unmark(markedCiphertext)
    return this.cipher.decrypt(ciphertext, this.key)
  }
}

let serviceInstance = null

const getEncryptionService = () => {
  if (!serviceInstance) {
    const keyDerivation = new DeterministicKeyDerivation(JWT_SECRET)
    const cipher = new AESCipher()
    serviceInstance = new EncryptionService(keyDerivation, cipher)
  }
  return serviceInstance
}

class FieldPathNavigator {
  static navigate(obj, path) {
    const parts = path.split('.')
    let current = obj

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) return null
      current = current[parts[i]]
    }

    return {parent: current, fieldName: parts[parts.length - 1]}
  }
}

const transformField = (obj, fieldPath, transformFn) => {
  const navigation = FieldPathNavigator.navigate(obj, fieldPath)
  if (!navigation) return

  const {parent, fieldName} = navigation
  const value = parent[fieldName]

  if (value) {
    parent[fieldName] = transformFn(value)
  }
}

const transformArrayFields = (items, fieldPaths, transformFn) => {
  if (!Array.isArray(items)) return

  items.forEach(item => {
    fieldPaths.forEach(path => {
      transformField(item, path, transformFn)
    })
  })
}

export const encryptFields = (data, config) => {
  if (!data) return data

  const {fields = [], arrayFields = {}} = config
  const service = getEncryptionService()
  const dataCopy = JSON.parse(JSON.stringify(data))

  fields.forEach(fieldPath => {
    transformField(dataCopy, fieldPath, value => service.encrypt(value))
  })

  Object.entries(arrayFields).forEach(([arrayPath, fieldPaths]) => {
    const navigation = FieldPathNavigator.navigate(dataCopy, arrayPath)
    if (navigation?.parent[navigation.fieldName]) {
      transformArrayFields(navigation.parent[navigation.fieldName], fieldPaths, value => service.encrypt(value))
    }
  })

  return dataCopy
}

export const decryptFields = (data, config) => {
  if (!data) return data

  const {fields = [], arrayFields = {}} = config
  const service = getEncryptionService()
  const dataCopy = JSON.parse(JSON.stringify(data))

  fields.forEach(fieldPath => {
    transformField(dataCopy, fieldPath, value => service.decrypt(value))
  })

  Object.entries(arrayFields).forEach(([arrayPath, fieldPaths]) => {
    const navigation = FieldPathNavigator.navigate(dataCopy, arrayPath)
    if (navigation?.parent[navigation.fieldName]) {
      transformArrayFields(navigation.parent[navigation.fieldName], fieldPaths, value => service.decrypt(value))
    }
  })

  return dataCopy
}
