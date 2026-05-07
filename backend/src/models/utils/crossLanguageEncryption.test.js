import crypto from 'crypto'
import {encryptFields, decryptFields} from './fieldEncryption'
import {INTEGRATION_ENCRYPTION_CONFIG} from '../Integration'

/**
 * Cross-language encrypt/decrypt compatibility tests.
 *
 * These tests verify that the Go DocumentEncryptor and Node fieldEncryption
 * produce mutually decryptable ciphertext using the same AES-256-GCM algorithm,
 * PBKDF2 key derivation, and wire format (IV || AuthTag || Ciphertext, base64).
 *
 * Fixture generation: backend-v2/internal/common/encryption/integration_test.go
 * TestEncryptionIntegration_NodeJSInterop proves Go → Node compatibility;
 * this file proves Node → Node (algorithm parity) and Go → Node (static fixture).
 *
 * Shared constants (must stay in sync with Go):
 *   - key derivation: PBKDF2-SHA256, 10000 iterations, 32 bytes, salt=sha256(secret+"field-encryption-salt")
 *   - wire format: base64(IV[16] || AuthTag[16] || Ciphertext)
 *   - encryption marker: "__encrypted__" prefix
 *   - AAD format: length-prefixed concatenation of [collection, userId, workflowId, fieldPath]
 */

const TEST_JWT_SECRET = 'test-jwt-secret-change-in-production'
const KNOWN_DERIVED_KEY_HEX = '22e43334aad10f8ad3055f597c9ddaed0c1f5f150c322e12e0ea2ef9afede5ac'

function deriveKeyMatchingGo(secret) {
  const salt = crypto
    .createHash('sha256')
    .update(secret + 'field-encryption-salt')
    .digest()
  return crypto.pbkdf2Sync(secret, salt, 10000, 32, 'sha256')
}

describe('Cross-language encryption compatibility', () => {
  describe('key derivation parity', () => {
    it('Node PBKDF2 produces the same 32-byte key as Go for the shared test secret', () => {
      const key = deriveKeyMatchingGo(TEST_JWT_SECRET)
      expect(key.toString('hex')).toBe(KNOWN_DERIVED_KEY_HEX)
    })

    it('derived key is exactly 32 bytes (AES-256)', () => {
      const key = deriveKeyMatchingGo(TEST_JWT_SECRET)
      expect(key.length).toBe(32)
    })
  })

  describe('Go-encrypted fixture decryption', () => {
    /**
     * Fixture produced by Go DocumentEncryptor with JWT_SECRET=test-jwt-secret-change-in-production.
     * Regenerate via: go test -run TestGenerateCrossLanguageFixture -v ./internal/common/encryption/
     * (requires Go backend; fixture is deterministic for a given key, but IV is random per generation)
     *
     * When the fixture is regenerated, update the GO_ENCRYPTED_FIXTURE constant below.
     */
    const GO_ENCRYPTED_FIXTURE =
      '__encrypted__ioZRZ6vVZgVIiVWNMAvhkTYdXfv+yksVy1SuNi4bXe+ypqiCLEvnSCwqDDPKvk21mXnegVpEHu9ckPlwVLaeXa8='
    const FIXTURE_USER_ID = 'user-cross-lang-test'
    const FIXTURE_PLAINTEXT = 'sk-openai-cross-lang-test-fixture'

    it('Node decryptFields recovers the plaintext from a Go-encrypted openai.apiKey', () => {
      const doc = {openai: {apiKey: GO_ENCRYPTED_FIXTURE}}
      const decrypted = decryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, {
        userId: FIXTURE_USER_ID,
        workflowId: null,
      })
      expect(decrypted.openai.apiKey).toBe(FIXTURE_PLAINTEXT)
    })

    it('decryption fails for a different userId (AAD mismatch = authentication failure)', () => {
      const doc = {openai: {apiKey: GO_ENCRYPTED_FIXTURE}}
      expect(() =>
        decryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, {
          userId: 'wrong-user',
          workflowId: null,
        }),
      ).toThrow()
    })
  })

  describe('Node round-trip for integration document fields', () => {
    const userId = 'roundtrip-test-user'
    const context = {userId, workflowId: null}

    it('encrypts and decrypts openai.apiKey without corruption', () => {
      const doc = {openai: {apiKey: 'sk-test-key-abc123'}}
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, context)

      expect(encrypted.openai.apiKey).toMatch(/^__encrypted__/)

      const decrypted = decryptFields(encrypted, INTEGRATION_ENCRYPTION_CONFIG, context)
      expect(decrypted.openai.apiKey).toBe('sk-test-key-abc123')
    })

    it('encrypts all LLM provider apiKey fields independently', () => {
      const doc = {
        openai: {apiKey: 'sk-openai'},
        claude: {apiKey: 'sk-ant-claude'},
        deepseek: {apiKey: 'sk-deepseek'},
      }
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, context)

      expect(encrypted.openai.apiKey).toMatch(/^__encrypted__/)
      expect(encrypted.claude.apiKey).toMatch(/^__encrypted__/)
      expect(encrypted.deepseek.apiKey).toMatch(/^__encrypted__/)

      const decrypted = decryptFields(encrypted, INTEGRATION_ENCRYPTION_CONFIG, context)

      expect(decrypted.openai.apiKey).toBe('sk-openai')
      expect(decrypted.claude.apiKey).toBe('sk-ant-claude')
      expect(decrypted.deepseek.apiKey).toBe('sk-deepseek')
    })

    it('non-secret fields survive the round-trip unchanged', () => {
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

    it('workflow-scoped encryption is isolated from global-scoped encryption', () => {
      const globalContext = {userId, workflowId: null}
      const workflowContext = {userId, workflowId: 'wf-123'}
      const doc = {openai: {apiKey: 'sk-test'}}

      const globalEncrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, globalContext)

      expect(() => decryptFields(globalEncrypted, INTEGRATION_ENCRYPTION_CONFIG, workflowContext)).toThrow()
    })

    it('encrypted value has correct wire format: base64(IV[16] || AuthTag[16] || Ciphertext)', () => {
      const doc = {openai: {apiKey: 'sk-format-test'}}
      const encrypted = encryptFields(doc, INTEGRATION_ENCRYPTION_CONFIG, context)

      const ciphertext = encrypted.openai.apiKey.replace('__encrypted__', '')
      const buffer = Buffer.from(ciphertext, 'base64')

      const IV_LENGTH = 16
      const AUTH_TAG_LENGTH = 16
      const MIN_CIPHERTEXT_LENGTH = 1

      expect(buffer.length).toBeGreaterThanOrEqual(IV_LENGTH + AUTH_TAG_LENGTH + MIN_CIPHERTEXT_LENGTH)
    })
  })
})
