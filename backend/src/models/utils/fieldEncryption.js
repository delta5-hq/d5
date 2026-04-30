import crypto from 'crypto'
import {JWT_SECRET, FIELD_ENCRYPTION_KEY} from '../../constants'
import adBuilder from './adBuilder'
import {EncryptionContextValidator, ADContextBuilder} from './encryptionContext'
import {FallbackDecrypt} from './decryptStrategy'
import {EncryptionKeyManager} from './encryptionKeyManager'
import {DualKeyDecryptStrategy} from './dualKeyDecryptStrategy'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const ENCRYPTED_PREFIX = '__encrypted__'

class AESCipher {
  encrypt(plaintext, key, additionalData = null) {
    if (!plaintext) return null

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
    if (!ciphertext) return null

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
  constructor(keyDerivation, cipher, decryptStrategy = null) {
    this.key = keyDerivation.getKey()
    this.cipher = cipher
    this.decryptStrategy = decryptStrategy || new FallbackDecrypt(cipher)
  }

  encrypt(plaintext, additionalData = null) {
    if (!plaintext) return null
    if (EncryptionMarker.isMarked(plaintext)) return plaintext
    const ciphertext = this.cipher.encrypt(plaintext, this.key, additionalData)
    return EncryptionMarker.mark(ciphertext)
  }

  decrypt(markedCiphertext, additionalData = null) {
    if (!markedCiphertext) return null
    if (!EncryptionMarker.isMarked(markedCiphertext)) return markedCiphertext
    const ciphertext = EncryptionMarker.unmark(markedCiphertext)
    return this.decryptStrategy.decrypt(ciphertext, this.key, additionalData)
  }
}

let serviceInstance = null
let encryptorInstance = null

const resetEncryptionSingletons = () => {
  serviceInstance = null
  encryptorInstance = null
}

const getEncryptionService = () => {
  if (!serviceInstance) {
    const keyManager = new EncryptionKeyManager(FIELD_ENCRYPTION_KEY, JWT_SECRET)
    const cipher = new AESCipher()
    const primaryKey = keyManager.getPrimaryKey()
    const legacyKey = keyManager.getLegacyKey()

    let decryptStrategy
    if (keyManager.requiresDualKeyDecryption()) {
      decryptStrategy = new DualKeyDecryptStrategy(cipher, primaryKey, legacyKey)
    } else {
      decryptStrategy = new FallbackDecrypt(cipher)
    }

    serviceInstance = new EncryptionService({getKey: () => primaryKey}, cipher, decryptStrategy)
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

class ObjectSerializer {
  static serialize(value) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return JSON.stringify(value)
    }
    return value
  }

  static deserialize(value) {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed
        }
      } catch {
        return value
      }
    }
    return value
  }
}

class LLMFieldTransformer {
  constructor(service, adContextBuilder) {
    this.service = service
    this.adContextBuilder = adContextBuilder
  }

  encrypt(value, fieldPath, context) {
    if (!value) return value
    const ad = this.adContextBuilder.buildForLLMField(context, fieldPath)
    return this.service.encrypt(value, ad)
  }

  decrypt(value, fieldPath, context) {
    if (!value) return value
    const ad = this.adContextBuilder.buildForLLMField(context, fieldPath)
    return this.service.decrypt(value, ad)
  }
}

class ArrayFieldTransformer {
  constructor(service, serializer, adContextBuilder) {
    this.service = service
    this.serializer = serializer
    this.adContextBuilder = adContextBuilder
  }

  transformItem(item, fieldPath, shouldSerialize, arrayName, context, encrypt) {
    const navigation = FieldPathNavigator.navigate(item, fieldPath)
    if (!navigation) return

    const {parent, fieldName} = navigation
    const value = parent[fieldName]
    if (!value) return

    const alias = item.alias
    const ad = this.adContextBuilder.buildForArrayField(context, arrayName, alias, fieldPath)

    const processedValue = encrypt
      ? this.encryptValue(value, shouldSerialize, ad)
      : this.decryptValue(value, shouldSerialize, ad)

    parent[fieldName] = processedValue
  }

  encryptValue(value, shouldSerialize, ad) {
    const serialized = shouldSerialize ? this.serializer.serialize(value) : value
    return this.service.encrypt(serialized, ad)
  }

  decryptValue(value, shouldSerialize, ad) {
    const decrypted = this.service.decrypt(value, ad)
    return shouldSerialize ? this.serializer.deserialize(decrypted) : decrypted
  }
}

class DocumentEncryptor {
  constructor(llmTransformer, arrayTransformer) {
    this.llmTransformer = llmTransformer
    this.arrayTransformer = arrayTransformer
  }

  encryptLLMFields(doc, fieldPaths, context) {
    fieldPaths.forEach(fieldPath => {
      const navigation = FieldPathNavigator.navigate(doc, fieldPath)
      if (!navigation) return

      const {parent, fieldName} = navigation
      const value = parent[fieldName]

      if (value) {
        parent[fieldName] = this.llmTransformer.encrypt(value, fieldPath, context)
      }
    })
  }

  decryptLLMFields(doc, fieldPaths, context) {
    fieldPaths.forEach(fieldPath => {
      const navigation = FieldPathNavigator.navigate(doc, fieldPath)
      if (!navigation) return

      const {parent, fieldName} = navigation
      const value = parent[fieldName]

      if (value) {
        parent[fieldName] = this.llmTransformer.decrypt(value, fieldPath, context)
      }
    })
  }

  encryptArrayFields(doc, arrayName, fieldConfigs, context) {
    const navigation = FieldPathNavigator.navigate(doc, arrayName)
    if (!navigation) return

    const items = navigation.parent[navigation.fieldName]
    if (!Array.isArray(items)) return

    items.forEach(item => {
      fieldConfigs.forEach(({path, serialize}) => {
        this.arrayTransformer.transformItem(item, path, serialize, arrayName, context, true)
      })
    })
  }

  decryptArrayFields(doc, arrayName, fieldConfigs, context) {
    const navigation = FieldPathNavigator.navigate(doc, arrayName)
    if (!navigation) return

    const items = navigation.parent[navigation.fieldName]
    if (!Array.isArray(items)) return

    items.forEach(item => {
      fieldConfigs.forEach(({path, serialize}) => {
        this.arrayTransformer.transformItem(item, path, serialize, arrayName, context, false)
      })
    })
  }
}

class ArrayFieldConfigBuilder {
  static build(fieldPaths, serializedFields) {
    return fieldPaths.map(path => ({
      path,
      serialize: serializedFields.includes(path),
    }))
  }
}

const getDocumentEncryptor = () => {
  if (!encryptorInstance) {
    const service = getEncryptionService()
    const adContextBuilder = new ADContextBuilder(adBuilder)
    const serializer = ObjectSerializer
    const llmTransformer = new LLMFieldTransformer(service, adContextBuilder)
    const arrayTransformer = new ArrayFieldTransformer(service, serializer, adContextBuilder)
    encryptorInstance = new DocumentEncryptor(llmTransformer, arrayTransformer)
  }
  return encryptorInstance
}

export const encryptFields = (data, config, encryptionContext = null) => {
  if (!data) return data

  const context = EncryptionContextValidator.validate(encryptionContext)
  const {fields = [], arrayFields = {}, serializedFields = {}} = config
  const encryptor = getDocumentEncryptor()
  const dataCopy = JSON.parse(JSON.stringify(data))

  encryptor.encryptLLMFields(dataCopy, fields, context)

  Object.entries(arrayFields).forEach(([arrayName, fieldPaths]) => {
    const fieldConfigs = ArrayFieldConfigBuilder.build(fieldPaths, serializedFields[arrayName] || [])
    encryptor.encryptArrayFields(dataCopy, arrayName, fieldConfigs, context)
  })

  return dataCopy
}

export const decryptFields = (data, config, encryptionContext = null) => {
  if (!data) return data

  const context = EncryptionContextValidator.validate(encryptionContext)
  const {fields = [], arrayFields = {}, serializedFields = {}} = config
  const encryptor = getDocumentEncryptor()
  const dataCopy = JSON.parse(JSON.stringify(data))

  encryptor.decryptLLMFields(dataCopy, fields, context)

  Object.entries(arrayFields).forEach(([arrayName, fieldPaths]) => {
    const fieldConfigs = ArrayFieldConfigBuilder.build(fieldPaths, serializedFields[arrayName] || [])
    encryptor.decryptArrayFields(dataCopy, arrayName, fieldConfigs, context)
  })

  return dataCopy
}
export const __resetForTesting = process.env.NODE_ENV === 'test' ? resetEncryptionSingletons : undefined
