import {encryptFields, decryptFields} from './fieldEncryption'

describe('Field Encryption', () => {
  const testConfig = {
    fields: ['apiKey', 'nested.secret'],
    arrayFields: {
      items: ['password', 'token'],
    },
  }

  describe('encryption behavior', () => {
    describe('field path resolution', () => {
      it('encrypts top-level field', () => {
        const data = {apiKey: 'secret-123'}
        const encrypted = encryptFields(data, {fields: ['apiKey']})

        expect(encrypted.apiKey).toMatch(/^__encrypted__/)
        expect(encrypted.apiKey).not.toBe('secret-123')
      })

      it('encrypts nested field with dot notation', () => {
        const data = {nested: {secret: 'hidden'}}
        const encrypted = encryptFields(data, {fields: ['nested.secret']})

        expect(encrypted.nested.secret).toMatch(/^__encrypted__/)
        expect(encrypted.nested.secret).not.toBe('hidden')
      })

      it('encrypts deeply nested field', () => {
        const data = {level1: {level2: {level3: {secret: 'deep'}}}}
        const encrypted = encryptFields(data, {fields: ['level1.level2.level3.secret']})

        expect(encrypted.level1.level2.level3.secret).toMatch(/^__encrypted__/)
      })

      it('handles missing intermediate path gracefully', () => {
        const data = {other: 'value'}
        const encrypted = encryptFields(data, {fields: ['nested.secret']})

        expect(encrypted).toEqual({other: 'value'})
      })

      it('handles partial path mismatch', () => {
        const data = {nested: 'primitive-not-object'}
        const encrypted = encryptFields(data, {fields: ['nested.secret']})

        expect(encrypted.nested).toBe('primitive-not-object')
      })
    })

    describe('multi-field encryption', () => {
      it('encrypts multiple independent fields', () => {
        const data = {apiKey: 'key1', token: 'token1', nested: {secret: 'secret1'}}
        const encrypted = encryptFields(data, {fields: ['apiKey', 'token', 'nested.secret']})

        expect(encrypted.apiKey).toMatch(/^__encrypted__/)
        expect(encrypted.token).toMatch(/^__encrypted__/)
        expect(encrypted.nested.secret).toMatch(/^__encrypted__/)
      })

      it('preserves non-configured fields', () => {
        const data = {apiKey: 'secret', username: 'user123', count: 42, active: true}
        const encrypted = encryptFields(data, {fields: ['apiKey']})

        expect(encrypted.username).toBe('user123')
        expect(encrypted.count).toBe(42)
        expect(encrypted.active).toBe(true)
      })
    })

    describe('array field encryption', () => {
      it('encrypts single field across multiple array items', () => {
        const data = {items: [{password: 'pass1'}, {password: 'pass2'}]}
        const encrypted = encryptFields(data, {arrayFields: {items: ['password']}})

        expect(encrypted.items[0].password).toMatch(/^__encrypted__/)
        expect(encrypted.items[1].password).toMatch(/^__encrypted__/)
      })

      it('encrypts multiple fields within array items', () => {
        const data = {items: [{password: 'pass', token: 'tok', key: 'secret'}]}
        const encrypted = encryptFields(data, {arrayFields: {items: ['password', 'token', 'key']}})

        expect(encrypted.items[0].password).toMatch(/^__encrypted__/)
        expect(encrypted.items[0].token).toMatch(/^__encrypted__/)
        expect(encrypted.items[0].key).toMatch(/^__encrypted__/)
      })

      it('preserves non-configured array item fields', () => {
        const data = {items: [{password: 'secret', alias: 'vm1', id: 123}]}
        const encrypted = encryptFields(data, {arrayFields: {items: ['password']}})

        expect(encrypted.items[0].alias).toBe('vm1')
        expect(encrypted.items[0].id).toBe(123)
      })

      it('handles multiple array fields in same document', () => {
        const data = {
          rpc: [{privateKey: 'ssh-key'}],
          mcp: [{apiKey: 'mcp-secret'}],
        }
        const encrypted = encryptFields(data, {
          arrayFields: {
            rpc: ['privateKey'],
            mcp: ['apiKey'],
          },
        })

        expect(encrypted.rpc[0].privateKey).toMatch(/^__encrypted__/)
        expect(encrypted.mcp[0].apiKey).toMatch(/^__encrypted__/)
      })

      it('handles empty arrays without error', () => {
        const data = {items: []}
        const encrypted = encryptFields(data, {arrayFields: {items: ['password']}})

        expect(encrypted.items).toEqual([])
      })
    })

    describe('idempotency', () => {
      it('skips already encrypted values', () => {
        const data = {apiKey: 'original'}
        const encrypted1 = encryptFields(data, {fields: ['apiKey']})
        const encrypted2 = encryptFields(encrypted1, {fields: ['apiKey']})

        expect(encrypted1.apiKey).toBe(encrypted2.apiKey)
      })

      it('handles mixed encrypted and plaintext fields', () => {
        const alreadyEncrypted = encryptFields({value: 'existing'}, {fields: ['value']})

        const data = {
          encrypted: alreadyEncrypted.value,
          plaintext: 'new-value',
        }

        const result = encryptFields(data, {fields: ['encrypted', 'plaintext']})

        expect(result.encrypted).toBe(alreadyEncrypted.value)
        expect(result.plaintext).toMatch(/^__encrypted__/)
        expect(result.plaintext).not.toBe(result.encrypted)
      })
    })

    describe('null and undefined handling', () => {
      it('preserves null field values', () => {
        const data = {apiKey: null}
        const encrypted = encryptFields(data, {fields: ['apiKey']})

        expect(encrypted.apiKey).toBeNull()
      })

      it('preserves undefined field values', () => {
        const data = {apiKey: undefined}
        const encrypted = encryptFields(data, {fields: ['apiKey']})

        expect(encrypted.apiKey).toBeUndefined()
      })

      it('preserves null in array items', () => {
        const data = {items: [{password: null}, {password: 'valid'}]}
        const encrypted = encryptFields(data, {arrayFields: {items: ['password']}})

        expect(encrypted.items[0].password).toBeNull()
        expect(encrypted.items[1].password).toMatch(/^__encrypted__/)
      })

      it('handles null document gracefully', () => {
        const encrypted = encryptFields(null, testConfig)
        expect(encrypted).toBeNull()
      })

      it('handles undefined document gracefully', () => {
        const encrypted = encryptFields(undefined, testConfig)
        expect(encrypted).toBeUndefined()
      })
    })

    describe('empty data handling', () => {
      it('handles empty object', () => {
        const encrypted = encryptFields({}, testConfig)
        expect(encrypted).toEqual({})
      })

      it('handles empty field configuration', () => {
        const data = {apiKey: 'secret'}
        const encrypted = encryptFields(data, {fields: [], arrayFields: {}})

        expect(encrypted).toEqual({apiKey: 'secret'})
      })
    })
  })

  describe('decryption behavior', () => {
    describe('field path resolution', () => {
      it('decrypts top-level encrypted field', () => {
        const data = {apiKey: 'original-secret'}
        const encrypted = encryptFields(data, {fields: ['apiKey']})
        const decrypted = decryptFields(encrypted, {fields: ['apiKey']})

        expect(decrypted.apiKey).toBe('original-secret')
      })

      it('decrypts nested encrypted field', () => {
        const data = {nested: {secret: 'hidden-value'}}
        const encrypted = encryptFields(data, {fields: ['nested.secret']})
        const decrypted = decryptFields(encrypted, {fields: ['nested.secret']})

        expect(decrypted.nested.secret).toBe('hidden-value')
      })

      it('passes through plaintext values unchanged', () => {
        const data = {apiKey: 'plaintext-value'}
        const decrypted = decryptFields(data, {fields: ['apiKey']})

        expect(decrypted.apiKey).toBe('plaintext-value')
      })

      it('handles missing paths gracefully', () => {
        const data = {other: 'value'}
        const decrypted = decryptFields(data, {fields: ['nested.secret']})

        expect(decrypted).toEqual({other: 'value'})
      })
    })

    describe('multi-field decryption', () => {
      it('decrypts multiple encrypted fields', () => {
        const data = {apiKey: 'key1', token: 'token1', secret: 'secret1'}
        const encrypted = encryptFields(data, {fields: ['apiKey', 'token', 'secret']})
        const decrypted = decryptFields(encrypted, {fields: ['apiKey', 'token', 'secret']})

        expect(decrypted).toEqual(data)
      })

      it('handles mixed encrypted and plaintext during decryption', () => {
        const data = {encrypted: 'value1', plaintext: 'value2'}
        const partiallyEncrypted = encryptFields(data, {fields: ['encrypted']})
        const decrypted = decryptFields(partiallyEncrypted, {fields: ['encrypted', 'plaintext']})

        expect(decrypted.encrypted).toBe('value1')
        expect(decrypted.plaintext).toBe('value2')
      })
    })

    describe('array field decryption', () => {
      it('decrypts encrypted array item fields', () => {
        const data = {items: [{password: 'pass1'}, {password: 'pass2'}]}
        const encrypted = encryptFields(data, {arrayFields: {items: ['password']}})
        const decrypted = decryptFields(encrypted, {arrayFields: {items: ['password']}})

        expect(decrypted).toEqual(data)
      })

      it('passes through plaintext array values', () => {
        const data = {items: [{password: 'plaintext'}]}
        const decrypted = decryptFields(data, {arrayFields: {items: ['password']}})

        expect(decrypted.items[0].password).toBe('plaintext')
      })
    })

    describe('null and undefined handling', () => {
      it('preserves null values during decryption', () => {
        const data = {apiKey: null}
        const decrypted = decryptFields(data, {fields: ['apiKey']})

        expect(decrypted.apiKey).toBeNull()
      })

      it('handles null document', () => {
        const decrypted = decryptFields(null, testConfig)
        expect(decrypted).toBeNull()
      })

      it('handles undefined document', () => {
        const decrypted = decryptFields(undefined, testConfig)
        expect(decrypted).toBeUndefined()
      })
    })

    describe('empty data handling', () => {
      it('handles empty object', () => {
        const decrypted = decryptFields({}, testConfig)
        expect(decrypted).toEqual({})
      })

      it('handles empty configuration', () => {
        const data = {apiKey: '__encrypted__somevalue'}
        const decrypted = decryptFields(data, {fields: [], arrayFields: {}})

        expect(decrypted.apiKey).toBe('__encrypted__somevalue')
      })
    })
  })

  describe('cryptographic properties', () => {
    describe('non-determinism', () => {
      it('produces different ciphertext for identical plaintext', () => {
        const data = {apiKey: 'same-secret'}

        const encrypted1 = encryptFields(data, {fields: ['apiKey']})
        const encrypted2 = encryptFields(data, {fields: ['apiKey']})

        expect(encrypted1.apiKey).not.toBe(encrypted2.apiKey)
      })

      it('produces unique ciphertext for each array item with same value', () => {
        const data = {items: [{password: 'same'}, {password: 'same'}]}
        const encrypted = encryptFields(data, {arrayFields: {items: ['password']}})

        expect(encrypted.items[0].password).not.toBe(encrypted.items[1].password)
      })
    })

    describe('reversibility', () => {
      it('maintains perfect roundtrip fidelity', () => {
        const original = {
          apiKey: 'secret-key',
          nested: {secret: 'nested-secret'},
          items: [{password: 'pass1', token: 'tok1'}, {password: 'pass2'}],
          unencrypted: 'visible',
        }

        const encrypted = encryptFields(original, testConfig)
        const decrypted = decryptFields(encrypted, testConfig)

        expect(decrypted).toEqual(original)
      })

      it('maintains fidelity through multiple encrypt-decrypt cycles', () => {
        const original = {apiKey: 'secret'}

        const encrypted1 = encryptFields(original, {fields: ['apiKey']})
        const decrypted1 = decryptFields(encrypted1, {fields: ['apiKey']})
        const encrypted2 = encryptFields(decrypted1, {fields: ['apiKey']})
        const decrypted2 = decryptFields(encrypted2, {fields: ['apiKey']})

        expect(decrypted2.apiKey).toBe('secret')
      })

      it('preserves special characters and encoding', () => {
        const data = {
          apiKey: 'key-with-特殊字符-and-émoji-🔑',
          nested: {secret: 'newline\nand\ttab'},
        }

        const encrypted = encryptFields(data, {fields: ['apiKey', 'nested.secret']})
        const decrypted = decryptFields(encrypted, {fields: ['apiKey', 'nested.secret']})

        expect(decrypted).toEqual(data)
      })
    })
  })

  describe('immutability', () => {
    it('does not mutate input data during encryption', () => {
      const original = {apiKey: 'secret', items: [{password: 'pass'}]}
      const originalCopy = JSON.parse(JSON.stringify(original))

      encryptFields(original, testConfig)

      expect(original).toEqual(originalCopy)
    })

    it('does not mutate input data during decryption', () => {
      const encrypted = encryptFields({apiKey: 'secret'}, {fields: ['apiKey']})
      const encryptedCopy = JSON.parse(JSON.stringify(encrypted))

      decryptFields(encrypted, {fields: ['apiKey']})

      expect(encrypted).toEqual(encryptedCopy)
    })

    it('returns new object instances', () => {
      const data = {apiKey: 'secret'}

      const encrypted = encryptFields(data, {fields: ['apiKey']})
      const decrypted = decryptFields(encrypted, {fields: ['apiKey']})

      expect(encrypted).not.toBe(data)
      expect(decrypted).not.toBe(encrypted)
      expect(decrypted).not.toBe(data)
    })
  })

  describe('integration scenarios', () => {
    describe('migration-safe behavior', () => {
      it('handles gradual field encryption rollout', () => {
        const partiallyMigrated = {
          encryptedField: '__encrypted__alreadyDone',
          plaintextField: 'not-yet-encrypted',
        }

        const result = encryptFields(partiallyMigrated, {
          fields: ['encryptedField', 'plaintextField'],
        })

        expect(result.encryptedField).toBe('__encrypted__alreadyDone')
        expect(result.plaintextField).toMatch(/^__encrypted__/)
      })

      it('allows safe decryption during migration period', () => {
        const alreadyEncrypted = encryptFields({value: 'already-done'}, {fields: ['value']})

        const mixedState = {
          encrypted: alreadyEncrypted.value,
          plaintext: 'readable',
        }

        const decrypted = decryptFields(mixedState, {fields: ['encrypted', 'plaintext']})

        expect(decrypted.encrypted).toBe('already-done')
        expect(decrypted.plaintext).toBe('readable')
      })
    })

    describe('real-world data structures', () => {
      it('handles integration document with mixed LLM configs', () => {
        const integration = {
          userId: 'user-123',
          openai: {apiKey: 'openai-key', model: 'gpt-4'},
          claude: {apiKey: 'claude-key', model: 'claude-3'},
          lang: 'en',
          rpc: [{alias: '/vm1', privateKey: 'ssh-private', host: '192.168.1.1'}],
        }

        const config = {
          fields: ['openai.apiKey', 'claude.apiKey'],
          arrayFields: {rpc: ['privateKey']},
        }

        const encrypted = encryptFields(integration, config)
        const decrypted = decryptFields(encrypted, config)

        expect(decrypted.openai.apiKey).toBe('openai-key')
        expect(decrypted.openai.model).toBe('gpt-4')
        expect(decrypted.claude.apiKey).toBe('claude-key')
        expect(decrypted.rpc[0].privateKey).toBe('ssh-private')
        expect(decrypted.rpc[0].host).toBe('192.168.1.1')
        expect(decrypted.userId).toBe('user-123')
      })

      it('handles RPC configuration with optional fields', () => {
        const rpcConfig = {
          rpc: [
            {alias: '/ssh1', privateKey: 'key1', passphrase: 'pass1'},
            {alias: '/ssh2', privateKey: 'key2', passphrase: null},
            {alias: '/http1'},
          ],
        }

        const config = {arrayFields: {rpc: ['privateKey', 'passphrase']}}

        const encrypted = encryptFields(rpcConfig, config)
        const decrypted = decryptFields(encrypted, config)

        expect(decrypted.rpc[0].privateKey).toBe('key1')
        expect(decrypted.rpc[0].passphrase).toBe('pass1')
        expect(decrypted.rpc[1].passphrase).toBeNull()
        expect(decrypted.rpc[2].alias).toBe('/http1')
      })
    })

    describe('serialized field encryption', () => {
      it('encrypts and decrypts object values in array fields', () => {
        const data = {
          items: [{metadata: {key1: 'value1', key2: 'value2'}}],
        }

        const config = {
          arrayFields: {items: ['metadata']},
          serializedFields: {items: ['metadata']},
        }

        const encrypted = encryptFields(data, config)
        const decrypted = decryptFields(encrypted, config)

        expect(encrypted.items[0].metadata).toMatch(/^__encrypted__/)
        expect(encrypted.items[0].metadata).not.toBe(data.items[0].metadata)
        expect(decrypted.items[0].metadata).toEqual(data.items[0].metadata)
      })

      it('encrypts multiple object fields within same array item', () => {
        const data = {
          configs: [{settings: {a: 1}, options: {b: 2}}],
        }

        const config = {
          arrayFields: {configs: ['settings', 'options']},
          serializedFields: {configs: ['settings', 'options']},
        }

        const encrypted = encryptFields(data, config)
        const decrypted = decryptFields(encrypted, config)

        expect(encrypted.configs[0].settings).toMatch(/^__encrypted__/)
        expect(encrypted.configs[0].options).toMatch(/^__encrypted__/)
        expect(decrypted.configs[0].settings).toEqual({a: 1})
        expect(decrypted.configs[0].options).toEqual({b: 2})
      })

      it('handles mix of scalar and serialized fields in same array', () => {
        const data = {
          items: [
            {
              stringField: 'plain-text',
              objectField: {nested: 'object'},
            },
          ],
        }

        const config = {
          arrayFields: {items: ['stringField', 'objectField']},
          serializedFields: {items: ['objectField']},
        }

        const encrypted = encryptFields(data, config)
        const decrypted = decryptFields(encrypted, config)

        expect(typeof encrypted.items[0].stringField).toBe('string')
        expect(typeof encrypted.items[0].objectField).toBe('string')
        expect(decrypted.items[0].stringField).toBe('plain-text')
        expect(decrypted.items[0].objectField).toEqual({nested: 'object'})
      })

      it('preserves null values in serialized fields', () => {
        const data = {
          items: [{field1: null, field2: {key: 'value'}}],
        }

        const config = {
          arrayFields: {items: ['field1', 'field2']},
          serializedFields: {items: ['field1', 'field2']},
        }

        const encrypted = encryptFields(data, config)
        const decrypted = decryptFields(encrypted, config)

        expect(decrypted.items[0].field1).toBeNull()
        expect(decrypted.items[0].field2).toEqual({key: 'value'})
      })

      it('preserves empty objects in serialized fields', () => {
        const data = {
          items: [{emptyObj: {}}],
        }

        const config = {
          arrayFields: {items: ['emptyObj']},
          serializedFields: {items: ['emptyObj']},
        }

        const encrypted = encryptFields(data, config)
        const decrypted = decryptFields(encrypted, config)

        expect(decrypted.items[0].emptyObj).toEqual({})
      })

      it('handles deeply nested object structures', () => {
        const data = {
          items: [
            {
              complex: {
                level1: {
                  level2: {
                    level3: 'deep-value',
                  },
                },
              },
            },
          ],
        }

        const config = {
          arrayFields: {items: ['complex']},
          serializedFields: {items: ['complex']},
        }

        const encrypted = encryptFields(data, config)
        const decrypted = decryptFields(encrypted, config)

        expect(decrypted).toEqual(data)
      })

      it('preserves object key ordering', () => {
        const data = {
          items: [{obj: {z: 1, a: 2, m: 3}}],
        }

        const config = {
          arrayFields: {items: ['obj']},
          serializedFields: {items: ['obj']},
        }

        const encrypted = encryptFields(data, config)
        const decrypted = decryptFields(encrypted, config)

        expect(Object.keys(decrypted.items[0].obj)).toEqual(['z', 'a', 'm'])
      })

      it('handles objects with various data types', () => {
        const data = {
          items: [
            {
              mixed: {
                string: 'text',
                number: 42,
                boolean: true,
                null: null,
                array: [1, 2, 3],
                nested: {key: 'value'},
              },
            },
          ],
        }

        const config = {
          arrayFields: {items: ['mixed']},
          serializedFields: {items: ['mixed']},
        }

        const encrypted = encryptFields(data, config)
        const decrypted = decryptFields(encrypted, config)

        expect(decrypted).toEqual(data)
      })

      it('handles multiple array paths with different serialization configs', () => {
        const data = {
          arrayA: [{objField: {key: 'val'}}],
          arrayB: [{strField: 'text'}],
        }

        const config = {
          arrayFields: {
            arrayA: ['objField'],
            arrayB: ['strField'],
          },
          serializedFields: {
            arrayA: ['objField'],
          },
        }

        const encrypted = encryptFields(data, config)
        const decrypted = decryptFields(encrypted, config)

        expect(decrypted.arrayA[0].objField).toEqual({key: 'val'})
        expect(decrypted.arrayB[0].strField).toBe('text')
      })

      it('handles multiple items in array with serialized fields', () => {
        const data = {
          items: [{obj: {a: 1}}, {obj: {b: 2}}, {obj: {c: 3}}],
        }

        const config = {
          arrayFields: {items: ['obj']},
          serializedFields: {items: ['obj']},
        }

        const encrypted = encryptFields(data, config)
        const decrypted = decryptFields(encrypted, config)

        expect(encrypted.items[0].obj).toMatch(/^__encrypted__/)
        expect(encrypted.items[1].obj).toMatch(/^__encrypted__/)
        expect(encrypted.items[2].obj).toMatch(/^__encrypted__/)
        expect(encrypted.items[0].obj).not.toBe(encrypted.items[1].obj)
        expect(decrypted.items).toEqual(data.items)
      })
    })
  })
})
