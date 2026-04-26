import {encryptFields, decryptFields} from './fieldEncryption'
import {INTEGRATION_ENCRYPTION_CONFIG} from '../Integration'

describe('Field Encryption - AEAD Context Binding', () => {
  const createContext = (userId, workflowId = null) => ({userId, workflowId})

  describe('Context separation - User boundary', () => {
    const config = {fields: ['openai.apiKey']}

    it('prevents cross-user ciphertext relocation', () => {
      const data = {openai: {apiKey: 'secret-key-123'}}
      const user1Context = createContext('user-1')
      const user2Context = createContext('user-2')

      const encrypted = encryptFields(data, config, user1Context)

      expect(() => decryptFields(encrypted, config, user2Context)).toThrow()
    })

    it('allows same user to decrypt their own data', () => {
      const data = {openai: {apiKey: 'secret-key-123'}}
      const userContext = createContext('user-1')

      const encrypted = encryptFields(data, config, userContext)
      const decrypted = decryptFields(encrypted, config, userContext)

      expect(decrypted.openai.apiKey).toBe('secret-key-123')
    })

    it('handles special characters in userId', () => {
      const data = {openai: {apiKey: 'secret'}}
      const context = createContext('user-with-special!@#$%^&*()chars')

      const encrypted = encryptFields(data, config, context)
      const decrypted = decryptFields(encrypted, config, context)

      expect(decrypted.openai.apiKey).toBe('secret')
    })

    it('handles UTF-8 multibyte characters in userId', () => {
      const data = {openai: {apiKey: 'secret'}}
      const context = createContext('用户-123')

      const encrypted = encryptFields(data, config, context)
      const decrypted = decryptFields(encrypted, config, context)

      expect(decrypted.openai.apiKey).toBe('secret')
    })
  })

  describe('Context separation - Workflow scope boundary', () => {
    const config = {fields: ['openai.apiKey']}

    it('prevents copying user-level ciphertext to workflow scope', () => {
      const data = {openai: {apiKey: 'secret-key-123'}}
      const userContext = createContext('user-1', null)
      const workflowContext = createContext('user-1', 'wf-123')

      const encrypted = encryptFields(data, config, userContext)

      expect(() => decryptFields(encrypted, config, workflowContext)).toThrow()
    })

    it('prevents copying workflow-scoped ciphertext to user level', () => {
      const data = {openai: {apiKey: 'secret-key-123'}}
      const workflowContext = createContext('user-1', 'wf-123')
      const userContext = createContext('user-1', null)

      const encrypted = encryptFields(data, config, workflowContext)

      expect(() => decryptFields(encrypted, config, userContext)).toThrow()
    })

    it('prevents copying between different workflows', () => {
      const data = {openai: {apiKey: 'secret-key-123'}}
      const workflow1Context = createContext('user-1', 'workflow-A')
      const workflow2Context = createContext('user-1', 'workflow-B')

      const encrypted = encryptFields(data, config, workflow1Context)

      expect(() => decryptFields(encrypted, config, workflow2Context)).toThrow()
    })

    it('treats user-level and workflow-scoped as distinct contexts', () => {
      const userData = {openai: {apiKey: 'user-key'}}
      const workflowData = {openai: {apiKey: 'workflow-key'}}
      const userContext = createContext('user-1', null)
      const workflowContext = createContext('user-1', 'wf-123')

      const encryptedUser = encryptFields(userData, config, userContext)
      const encryptedWorkflow = encryptFields(workflowData, config, workflowContext)

      expect(encryptedUser.openai.apiKey).toMatch(/^__encrypted__/)
      expect(encryptedWorkflow.openai.apiKey).toMatch(/^__encrypted__/)
      expect(encryptedUser.openai.apiKey).not.toBe(encryptedWorkflow.openai.apiKey)

      expect(decryptFields(encryptedUser, config, userContext).openai.apiKey).toBe('user-key')
      expect(decryptFields(encryptedWorkflow, config, workflowContext).openai.apiKey).toBe('workflow-key')
    })
  })

  describe('Context separation - Field path boundary', () => {
    it('prevents copying ciphertext between different fields', () => {
      const data = {openai: {apiKey: 'secret-key-123'}}
      const context = createContext('user-1')
      const encryptedOpenAI = encryptFields(data, {fields: ['openai.apiKey']}, context)

      const swappedData = {claude: {apiKey: encryptedOpenAI.openai.apiKey}}

      expect(() => decryptFields(swappedData, {fields: ['claude.apiKey']}, context)).toThrow()
    })

    it('prevents copying between nested field paths', () => {
      const data = {level1: {level2: {secret: 'sensitive'}, level3: {secret: 'sensitive'}}}
      const context = createContext('user-1')

      const encrypted = encryptFields(data, {fields: ['level1.level2.secret']}, context)
      const swapped = {level1: {level3: {secret: encrypted.level1.level2.secret}}}

      expect(() => decryptFields(swapped, {fields: ['level1.level3.secret']}, context)).toThrow()
    })

    it('binds to exact field path not just field name', () => {
      const data = {service1: {key: 'secret1'}, service2: {key: 'secret2'}}
      const context = createContext('user-1')

      const encrypted = encryptFields(data, {fields: ['service1.key', 'service2.key']}, context)
      const swapped = {service1: {key: encrypted.service2.key}, service2: {key: encrypted.service1.key}}

      expect(() => decryptFields(swapped, {fields: ['service1.key', 'service2.key']}, context)).toThrow()
    })
  })

  describe('Context separation - Array item alias boundary', () => {
    const config = {arrayFields: {mcp: ['headers']}, serializedFields: {mcp: ['headers']}}

    it('prevents copying between different array items by alias', () => {
      const data = {
        mcp: [
          {alias: 'srv1', headers: {key: 'val1'}},
          {alias: 'srv2', headers: {key: 'val2'}},
        ],
      }
      const context = createContext('user-1')

      const encrypted = encryptFields(data, config, context)
      const swapped = {
        mcp: [
          {alias: 'srv2', headers: encrypted.mcp[0].headers},
          {alias: 'srv1', headers: encrypted.mcp[1].headers},
        ],
      }

      expect(() => decryptFields(swapped, config, context)).toThrow()
    })

    it('prevents copying between different arrays', () => {
      const mcpData = {mcp: [{alias: 'srv', headers: {key: 'val'}}]}
      const context = createContext('user-1')
      const mcpEncrypted = encryptFields(mcpData, config, context)

      const rpcData = {rpc: [{alias: 'srv', headers: mcpEncrypted.mcp[0].headers}]}

      expect(() =>
        decryptFields(rpcData, {arrayFields: {rpc: ['headers']}, serializedFields: {rpc: ['headers']}}, context),
      ).toThrow()
    })

    it('prevents copying between different fields within same array item', () => {
      const data = {rpc: [{alias: 'srv', privateKey: 'ssh-key', passphrase: 'pass'}]}
      const context = createContext('user-1')
      const config = {arrayFields: {rpc: ['privateKey', 'passphrase']}}

      const encrypted = encryptFields(data, config, context)
      const swapped = {rpc: [{alias: 'srv', privateKey: encrypted.rpc[0].passphrase, passphrase: 'whatever'}]}

      expect(() => decryptFields(swapped, config, context)).toThrow()
    })

    it('binds each array item independently', () => {
      const data = {
        rpc: [
          {alias: 'vm1', privateKey: 'key1'},
          {alias: 'vm2', privateKey: 'key2'},
          {alias: 'vm3', privateKey: 'key3'},
        ],
      }
      const context = createContext('user-1')
      const config = {arrayFields: {rpc: ['privateKey']}}

      const encrypted = encryptFields(data, config, context)

      expect(encrypted.rpc[0].privateKey).not.toBe(encrypted.rpc[1].privateKey)
      expect(encrypted.rpc[1].privateKey).not.toBe(encrypted.rpc[2].privateKey)

      const decrypted = decryptFields(encrypted, config, context)
      expect(decrypted.rpc[0].privateKey).toBe('key1')
      expect(decrypted.rpc[1].privateKey).toBe('key2')
      expect(decrypted.rpc[2].privateKey).toBe('key3')
    })
  })

  describe('Alias validation', () => {
    const context = createContext('user-1')

    it('throws error when array item missing alias', () => {
      const data = {mcp: [{headers: {Authorization: 'Bearer token'}}]}
      const config = {arrayFields: {mcp: ['headers']}, serializedFields: {mcp: ['headers']}}

      expect(() => encryptFields(data, config, context)).toThrow("Array item in 'mcp' missing required alias field")
    })

    it('throws error when array item has null alias', () => {
      const data = {rpc: [{alias: null, privateKey: 'ssh-key'}]}
      const config = {arrayFields: {rpc: ['privateKey']}}

      expect(() => encryptFields(data, config, context)).toThrow("Array item in 'rpc' missing required alias field")
    })

    it('throws error when array item has empty string alias', () => {
      const data = {mcp: [{alias: '', env: {KEY: 'value'}}]}
      const config = {arrayFields: {mcp: ['env']}, serializedFields: {mcp: ['env']}}

      expect(() => encryptFields(data, config, context)).toThrow("Array item in 'mcp' missing required alias field")
    })

    it('throws error when array item has non-string alias', () => {
      const data = {rpc: [{alias: 123, privateKey: 'key'}]}
      const config = {arrayFields: {rpc: ['privateKey']}}

      expect(() => encryptFields(data, config, context)).toThrow("Array item in 'rpc' missing required alias field")
    })

    it('handles UTF-8 multibyte characters in alias', () => {
      const data = {mcp: [{alias: 'サーバー-1', headers: {key: 'val'}}]}
      const context = createContext('user-1')
      const config = {arrayFields: {mcp: ['headers']}, serializedFields: {mcp: ['headers']}}

      const encrypted = encryptFields(data, config, context)
      const decrypted = decryptFields(encrypted, config, context)

      expect(decrypted.mcp[0].headers).toEqual({key: 'val'})
    })
  })

  describe('Mixed document context binding', () => {
    it('rejects cross-user violations with mixed LLM and array fields', () => {
      const integration = {
        userId: 'user-A',
        openai: {apiKey: 'openai-key'},
        mcp: [{alias: 'srv', headers: {key: 'val'}}],
      }
      const user1Context = createContext('user-A')
      const user2Context = createContext('user-B')

      const encrypted = encryptFields(integration, INTEGRATION_ENCRYPTION_CONFIG, user1Context)

      expect(() => decryptFields(encrypted, INTEGRATION_ENCRYPTION_CONFIG, user2Context)).toThrow()
    })

    it('accepts full integration document with consistent context', () => {
      const integration = {
        userId: 'user-1',
        workflowId: 'wf-1',
        openai: {apiKey: 'openai-secret'},
        claude: {apiKey: 'claude-secret'},
        mcp: [
          {alias: 'srv1', headers: {auth: 'token1'}},
          {alias: 'srv2', env: {KEY: 'val'}},
        ],
        rpc: [{alias: 'vm1', privateKey: 'ssh-key', passphrase: 'pass'}],
      }

      const context = createContext('user-1', 'wf-1')
      const encrypted = encryptFields(integration, INTEGRATION_ENCRYPTION_CONFIG, context)
      const decrypted = decryptFields(encrypted, INTEGRATION_ENCRYPTION_CONFIG, context)

      expect(decrypted.openai.apiKey).toBe('openai-secret')
      expect(decrypted.claude.apiKey).toBe('claude-secret')
      expect(decrypted.mcp[0].headers).toEqual({auth: 'token1'})
      expect(decrypted.mcp[1].env).toEqual({KEY: 'val'})
      expect(decrypted.rpc[0].privateKey).toBe('ssh-key')
      expect(decrypted.rpc[0].passphrase).toBe('pass')
    })
  })

  describe('Backward compatibility', () => {
    it('encrypts without AD when context is null', () => {
      const data = {openai: {apiKey: 'secret'}}
      const config = {fields: ['openai.apiKey']}

      const encrypted = encryptFields(data, config, null)
      const decrypted = decryptFields(encrypted, config, null)

      expect(decrypted.openai.apiKey).toBe('secret')
    })

    it('encrypts without AD when context is undefined', () => {
      const data = {openai: {apiKey: 'secret'}}
      const config = {fields: ['openai.apiKey']}

      const encrypted = encryptFields(data, config, undefined)
      const decrypted = decryptFields(encrypted, config, undefined)

      expect(decrypted.openai.apiKey).toBe('secret')
    })

    it('encrypts without AD when context is omitted', () => {
      const data = {openai: {apiKey: 'secret'}}
      const config = {fields: ['openai.apiKey']}

      const encrypted = encryptFields(data, config)
      const decrypted = decryptFields(encrypted, config)

      expect(decrypted.openai.apiKey).toBe('secret')
    })

    it('allows roundtrip with null context for array fields', () => {
      const data = {mcp: [{alias: 'srv', headers: {key: 'val'}}]}
      const config = {arrayFields: {mcp: ['headers']}, serializedFields: {mcp: ['headers']}}

      const encrypted = encryptFields(data, config, null)
      const decrypted = decryptFields(encrypted, config, null)

      expect(decrypted.mcp[0].headers).toEqual({key: 'val'})
    })

    it('rejects mixing null and non-null contexts', () => {
      const data = {openai: {apiKey: 'secret'}}
      const config = {fields: ['openai.apiKey']}
      const context = createContext('user-1')

      const encryptedWithContext = encryptFields(data, config, context)

      expect(() => decryptFields(encryptedWithContext, config, null)).toThrow()
    })

    it('rejects mixing undefined and non-null contexts', () => {
      const data = {openai: {apiKey: 'secret'}}
      const config = {fields: ['openai.apiKey']}
      const context = createContext('user-1')

      const encryptedWithContext = encryptFields(data, config, context)

      expect(() => decryptFields(encryptedWithContext, config, undefined)).toThrow()
    })
  })

  describe('Determinism', () => {
    it('produces different ciphertext for same context due to random IV', () => {
      const data = {openai: {apiKey: 'secret'}}
      const config = {fields: ['openai.apiKey']}
      const context = createContext('user-1')

      const encrypted1 = encryptFields(data, config, context)
      const encrypted2 = encryptFields(data, config, context)

      expect(encrypted1.openai.apiKey).not.toBe(encrypted2.openai.apiKey)
    })

    it('allows decryption with independently built identical context', () => {
      const data = {openai: {apiKey: 'secret'}}
      const config = {fields: ['openai.apiKey']}
      const context1 = createContext('user-1', 'wf-123')
      const context2 = createContext('user-1', 'wf-123')

      const encrypted = encryptFields(data, config, context1)
      const decrypted = decryptFields(encrypted, config, context2)

      expect(decrypted.openai.apiKey).toBe('secret')
    })
  })

  describe('Edge cases', () => {
    it('handles very long userId', () => {
      const data = {openai: {apiKey: 'secret'}}
      const config = {fields: ['openai.apiKey']}
      const context = createContext('u'.repeat(500))

      const encrypted = encryptFields(data, config, context)
      const decrypted = decryptFields(encrypted, config, context)

      expect(decrypted.openai.apiKey).toBe('secret')
    })

    it('handles very long workflowId', () => {
      const data = {openai: {apiKey: 'secret'}}
      const config = {fields: ['openai.apiKey']}
      const context = createContext('user-1', 'w'.repeat(500))

      const encrypted = encryptFields(data, config, context)
      const decrypted = decryptFields(encrypted, config, context)

      expect(decrypted.openai.apiKey).toBe('secret')
    })

    it('handles empty array', () => {
      const data = {mcp: []}
      const config = {arrayFields: {mcp: ['headers']}}
      const context = createContext('user-1')

      const encrypted = encryptFields(data, config, context)
      const decrypted = decryptFields(encrypted, config, context)

      expect(decrypted.mcp).toEqual([])
    })

    it('handles array with mix of encrypted and non-encrypted fields', () => {
      const data = {mcp: [{alias: 'srv', headers: {key: 'val'}, description: 'public', port: 8080}]}
      const config = {arrayFields: {mcp: ['headers']}, serializedFields: {mcp: ['headers']}}
      const context = createContext('user-1')

      const encrypted = encryptFields(data, config, context)
      const decrypted = decryptFields(encrypted, config, context)

      expect(decrypted.mcp[0].headers).toEqual({key: 'val'})
      expect(decrypted.mcp[0].description).toBe('public')
      expect(decrypted.mcp[0].port).toBe(8080)
    })
  })
})
