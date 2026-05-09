import crypto from 'crypto'
import {encryptFields, decryptFields} from './fieldEncryption'
import {INTEGRATION_ENCRYPTION_CONFIG} from '../Integration'

/**
 * Cross-language encrypt/decrypt compatibility tests.
 *
 * Scope: properties that must hold across the Go↔Node boundary:
 *   - wire format:    base64(IV[16] ‖ AuthTag[16] ‖ Ciphertext)
 *   - marker:         "__encrypted__" prefix
 *   - key derivation: PBKDF2-SHA256, 10000 iter, salt=sha256(secret+"field-encryption-salt")
 *   - AAD format:     length-prefixed [collection ‖ userId ‖ workflowId ‖ fieldPath]
 *   - scope binding:  userId and workflowId are part of the AAD; swapping either fails auth
 *
 * Unit-level fieldEncryption tests (AES-256-GCM, idempotence, tamper resistance) live in
 * fieldEncryption.test.js.  This file focuses exclusively on cross-language contract parity.
 *
 * Shared constants (must stay in sync with cross_language_encryption_test.go):
 *   - key derivation params, wire format layout, fixture values
 *
 * To regenerate the Go fixture after a wire-format change:
 *   go test -run TestCrossLanguageEncryption_RegenerateFixture -v ./internal/modules/integration/
 * Then update GO_ENCRYPTED_FIXTURE below.
 */

const TEST_JWT_SECRET = 'test-jwt-secret-change-in-production'
const KNOWN_DERIVED_KEY_HEX = '22e43334aad10f8ad3055f597c9ddaed0c1f5f150c322e12e0ea2ef9afede5ac'

// Fixture produced by Go DocumentEncryptor with JWT_SECRET = TEST_JWT_SECRET.
// Go decrypts this same value in TestCrossLanguageEncryption_GoDecryptsNodeFixture.
const GO_ENCRYPTED_FIXTURE =
  '__encrypted__ioZRZ6vVZgVIiVWNMAvhkTYdXfv+yksVy1SuNi4bXe+ypqiCLEvnSCwqDDPKvk21mXnegVpEHu9ckPlwVLaeXa8='
const FIXTURE_USER_ID = 'user-cross-lang-test'
const FIXTURE_PLAINTEXT = 'sk-openai-cross-lang-test-fixture'

function deriveKeyMatchingGo(secret) {
  const salt = crypto
    .createHash('sha256')
    .update(secret + 'field-encryption-salt')
    .digest()
  return crypto.pbkdf2Sync(secret, salt, 10000, 32, 'sha256')
}

describe('Cross-language encryption compatibility', () => {
  describe('key derivation parity', () => {
    it('PBKDF2-SHA256 with shared salt produces the known 32-byte key', () => {
      const key = deriveKeyMatchingGo(TEST_JWT_SECRET)
      expect(key.toString('hex')).toBe(KNOWN_DERIVED_KEY_HEX)
    })

    it('derived key is exactly 32 bytes (AES-256 requirement)', () => {
      const key = deriveKeyMatchingGo(TEST_JWT_SECRET)
      expect(key.length).toBe(32)
    })
  })

  describe('Go-encrypted fixture decryption', () => {
    it('Node decryptFields recovers the plaintext from a Go-produced ciphertext', () => {
      const doc = {openai: {apiKey: GO_ENCRYPTED_FIXTURE}}
      const decrypted = decryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, {
        userId: FIXTURE_USER_ID,
        workflowId: null,
      })
      expect(decrypted.openai.apiKey).toBe(FIXTURE_PLAINTEXT)
    })

    it('decryption fails when userId does not match the one used during encryption', () => {
      const doc = {openai: {apiKey: GO_ENCRYPTED_FIXTURE}}
      expect(() =>
        decryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, {
          userId: 'wrong-user',
          workflowId: null,
        }),
      ).toThrow()
    })
  })

  describe('wire format', () => {
    const userId = 'wire-format-user'
    const context = {userId, workflowId: null}

    it('encrypted value carries __encrypted__ prefix', () => {
      const doc = {openai: {apiKey: 'sk-wire-test'}}
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, context)
      expect(encrypted.openai.apiKey).toMatch(/^__encrypted__/)
    })

    it('base64 payload after stripping prefix decodes to at least IV[16]+AuthTag[16]+1 byte', () => {
      const IV_LENGTH = 16
      const AUTH_TAG_LENGTH = 16
      const doc = {openai: {apiKey: 'sk-format-test'}}
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, context)
      const payload = encrypted.openai.apiKey.replace('__encrypted__', '')
      const buffer = Buffer.from(payload, 'base64')
      expect(buffer.length).toBeGreaterThanOrEqual(IV_LENGTH + AUTH_TAG_LENGTH + 1)
    })

    it('successive encryptions of the same value produce different ciphertexts (random IV)', () => {
      const doc1 = {openai: {apiKey: 'sk-same'}}
      const doc2 = {openai: {apiKey: 'sk-same'}}
      const enc1 = encryptFields(doc1, INTEGRATION_ENCRYPTION_CONFIG, context)
      const enc2 = encryptFields(doc2, INTEGRATION_ENCRYPTION_CONFIG, context)
      expect(enc1.openai.apiKey).not.toBe(enc2.openai.apiKey)
    })
  })

  describe('all LLM provider secret fields', () => {
    const userId = 'provider-coverage-user'
    const context = {userId, workflowId: null}

    const allProviders = [
      {provider: 'openai', apiKey: 'sk-openai', extra: {model: 'gpt-4'}},
      {
        provider: 'claude',
        apiKey: 'sk-ant-claude',
        extra: {model: 'claude-3'},
      },
      {provider: 'deepseek', apiKey: 'sk-deepseek'},
      {provider: 'qwen', apiKey: 'sk-qwen'},
      {provider: 'perplexity', apiKey: 'sk-pplx'},
      {
        provider: 'yandex',
        apiKey: 'yandex-key',
        extra: {folder_id: 'folder-1'},
      },
      {provider: 'custom_llm', apiKey: 'custom-key'},
    ]

    it('encrypts apiKey for every configured LLM provider', () => {
      const doc = Object.fromEntries(
        allProviders.map(({provider, apiKey, extra = {}}) => [provider, {apiKey, ...extra}]),
      )
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, context)

      for (const {provider, apiKey} of allProviders) {
        expect(encrypted[provider].apiKey).toMatch(/^__encrypted__/)
        expect(encrypted[provider].apiKey).not.toBe(apiKey)
      }
    })

    it('round-trip restores every LLM provider apiKey to its original plaintext', () => {
      const doc = Object.fromEntries(
        allProviders.map(({provider, apiKey, extra = {}}) => [provider, {apiKey, ...extra}]),
      )
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, context)
      const decrypted = decryptFields(encrypted, INTEGRATION_ENCRYPTION_CONFIG, context)

      for (const {provider, apiKey} of allProviders) {
        expect(decrypted[provider].apiKey).toBe(apiKey)
      }
    })

    it('yandex.folder_id is not encrypted (not a secret field per config)', () => {
      const doc = {yandex: {apiKey: 'yandex-key', folder_id: 'my-folder'}}
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, context)
      expect(encrypted.yandex.folder_id).toBe('my-folder')
    })

    it('non-secret scalar fields survive round-trip unchanged', () => {
      const doc = {
        openai: {apiKey: 'sk-test', model: 'gpt-4.1-mini'},
        lang: 'en',
        model: 'auto',
      }
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, context)
      const decrypted = decryptFields(encrypted, INTEGRATION_ENCRYPTION_CONFIG, context)
      expect(decrypted.openai.model).toBe('gpt-4.1-mini')
      expect(decrypted.lang).toBe('en')
      expect(decrypted.model).toBe('auto')
    })
  })

  describe('scope isolation (AAD binding)', () => {
    const plaintext = 'sk-scope-test'

    it('correct userId+workflowId decrypts successfully', () => {
      const context = {userId: 'user-A', workflowId: null}
      const doc = {openai: {apiKey: plaintext}}
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, context)
      const decrypted = decryptFields(encrypted, INTEGRATION_ENCRYPTION_CONFIG, context)
      expect(decrypted.openai.apiKey).toBe(plaintext)
    })

    it('wrong userId is rejected', () => {
      const encCtx = {userId: 'user-A', workflowId: null}
      const decCtx = {userId: 'user-B', workflowId: null}
      const doc = {openai: {apiKey: plaintext}}
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, encCtx)
      expect(() => decryptFields(encrypted, INTEGRATION_ENCRYPTION_CONFIG, decCtx)).toThrow()
    })

    it('global scope (null workflowId) is rejected when decrypting as workflow scope', () => {
      const encCtx = {userId: 'user-A', workflowId: null}
      const decCtx = {userId: 'user-A', workflowId: 'wf-123'}
      const doc = {openai: {apiKey: plaintext}}
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, encCtx)
      expect(() => decryptFields(encrypted, INTEGRATION_ENCRYPTION_CONFIG, decCtx)).toThrow()
    })

    it('workflow scope is rejected when decrypting as global scope', () => {
      const encCtx = {userId: 'user-A', workflowId: 'wf-123'}
      const decCtx = {userId: 'user-A', workflowId: null}
      const doc = {openai: {apiKey: plaintext}}
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, encCtx)
      expect(() => decryptFields(encrypted, INTEGRATION_ENCRYPTION_CONFIG, decCtx)).toThrow()
    })

    it('different workflowIds are rejected', () => {
      const encCtx = {userId: 'user-A', workflowId: 'wf-AAA'}
      const decCtx = {userId: 'user-A', workflowId: 'wf-BBB'}
      const doc = {openai: {apiKey: plaintext}}
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, encCtx)
      expect(() => decryptFields(encrypted, INTEGRATION_ENCRYPTION_CONFIG, decCtx)).toThrow()
    })
  })
})
