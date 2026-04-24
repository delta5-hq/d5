import {ACPPermissionPolicy} from './ACPPermissionPolicy'

describe('ACPPermissionPolicy', () => {
  describe('allowAll mode', () => {
    it('approves any tool regardless of name', () => {
      const policy = new ACPPermissionPolicy({allowAll: true})

      expect(policy.shouldApprove('read_file')).toBe(true)
      expect(policy.shouldApprove('delete_everything')).toBe(true)
      expect(policy.shouldApprove('')).toBe(true)
    })

    it('builds approval response', () => {
      const policy = new ACPPermissionPolicy({allowAll: true})
      const options = [
        {optionId: 'allow', kind: 'allow_once'},
        {optionId: 'deny', kind: 'reject_once'},
      ]

      const response = policy.buildResponse('read_file', options)
      expect(response).toEqual({outcome: {outcome: 'selected', optionId: 'allow'}})
    })
  })

  describe('denyAll mode', () => {
    it('denies any tool regardless of name', () => {
      const policy = new ACPPermissionPolicy({denyAll: true})

      expect(policy.shouldApprove('read_file')).toBe(false)
      expect(policy.shouldApprove('safe_operation')).toBe(false)
    })

    it('denies even if tool is in allowedTools list', () => {
      const policy = new ACPPermissionPolicy({denyAll: true, allowedTools: ['read_file']})

      expect(policy.shouldApprove('read_file')).toBe(false)
    })

    it('builds denial response', () => {
      const policy = new ACPPermissionPolicy({denyAll: true})
      const options = [
        {optionId: 'allow', kind: 'allow_once'},
        {optionId: 'deny', kind: 'reject_once'},
      ]

      const response = policy.buildResponse('read_file', options)
      expect(response).toEqual({outcome: {outcome: 'selected', optionId: 'deny'}})
    })
  })

  describe('whitelist mode', () => {
    it('approves only tools in whitelist', () => {
      const policy = new ACPPermissionPolicy({allowedTools: ['read_file', 'write_file']})

      expect(policy.shouldApprove('read_file')).toBe(true)
      expect(policy.shouldApprove('write_file')).toBe(true)
      expect(policy.shouldApprove('delete_file')).toBe(false)
    })

    it('denies all tools when whitelist is empty', () => {
      const policy = new ACPPermissionPolicy({allowedTools: []})

      expect(policy.shouldApprove('read_file')).toBe(false)
    })

    it('handles case-sensitive tool names', () => {
      const policy = new ACPPermissionPolicy({allowedTools: ['read_file']})

      expect(policy.shouldApprove('read_file')).toBe(true)
      expect(policy.shouldApprove('READ_FILE')).toBe(false)
    })

    it('handles duplicate entries in whitelist', () => {
      const policy = new ACPPermissionPolicy({allowedTools: ['read_file', 'read_file']})

      expect(policy.shouldApprove('read_file')).toBe(true)
    })

    it('handles tools with special characters', () => {
      const policy = new ACPPermissionPolicy({allowedTools: ['tool-name', 'tool_name', 'tool.name']})

      expect(policy.shouldApprove('tool-name')).toBe(true)
      expect(policy.shouldApprove('tool_name')).toBe(true)
      expect(policy.shouldApprove('tool:name')).toBe(false)
    })
  })

  describe('fromIntegrationConfig', () => {
    it('creates allowAll policy from config', () => {
      const policy = ACPPermissionPolicy.fromIntegrationConfig({autoApprove: 'all'})

      expect(policy.shouldApprove('anything')).toBe(true)
    })

    it('creates denyAll policy from config', () => {
      const policy = ACPPermissionPolicy.fromIntegrationConfig({autoApprove: 'none'})

      expect(policy.shouldApprove('anything')).toBe(false)
    })

    it('creates whitelist policy from config', () => {
      const policy = ACPPermissionPolicy.fromIntegrationConfig({
        autoApprove: 'whitelist',
        allowedTools: ['read_file'],
      })

      expect(policy.shouldApprove('read_file')).toBe(true)
      expect(policy.shouldApprove('write_file')).toBe(false)
    })

    it('defaults to empty whitelist when autoApprove undefined', () => {
      const policy = ACPPermissionPolicy.fromIntegrationConfig({})

      expect(policy.shouldApprove('anything')).toBe(false)
    })

    it('defaults to empty whitelist when allowedTools undefined', () => {
      const policy = ACPPermissionPolicy.fromIntegrationConfig({autoApprove: 'whitelist'})

      expect(policy.shouldApprove('anything')).toBe(false)
    })

    it('ignores allowedTools when autoApprove is "all"', () => {
      const policy = ACPPermissionPolicy.fromIntegrationConfig({
        autoApprove: 'all',
        allowedTools: ['read_file'],
      })

      expect(policy.shouldApprove('delete_file')).toBe(true)
    })

    it('ignores allowedTools when autoApprove is "none"', () => {
      const policy = ACPPermissionPolicy.fromIntegrationConfig({
        autoApprove: 'none',
        allowedTools: ['read_file'],
      })

      expect(policy.shouldApprove('read_file')).toBe(false)
    })
  })

  describe('validation', () => {
    it('throws when both allowAll and denyAll are true', () => {
      expect(() => new ACPPermissionPolicy({allowAll: true, denyAll: true})).toThrow(
        'Cannot set both allowAll and denyAll',
      )
    })

    it('allows allowAll without denyAll', () => {
      expect(() => new ACPPermissionPolicy({allowAll: true})).not.toThrow()
    })

    it('allows denyAll without allowAll', () => {
      expect(() => new ACPPermissionPolicy({denyAll: true})).not.toThrow()
    })

    it('allows whitelist mode (neither flag)', () => {
      expect(() => new ACPPermissionPolicy({allowedTools: ['read_file']})).not.toThrow()
    })
  })

  describe('response building', () => {
    it('selects correct option based on approval decision', () => {
      const allowPolicy = new ACPPermissionPolicy({allowAll: true})
      const denyPolicy = new ACPPermissionPolicy({denyAll: true})
      const options = [
        {optionId: 'allow', kind: 'allow_once'},
        {optionId: 'deny', kind: 'reject_once'},
      ]

      expect(allowPolicy.buildResponse('test', options)).toEqual({
        outcome: {outcome: 'selected', optionId: 'allow'},
      })
      expect(denyPolicy.buildResponse('test', options)).toEqual({
        outcome: {outcome: 'selected', optionId: 'deny'},
      })
    })

    it('falls back to first option if no matching kind found', () => {
      const policy = new ACPPermissionPolicy({allowAll: true})
      const options = [{optionId: 'fallback', kind: 'unknown'}]

      const response = policy.buildResponse('test', options)
      expect(response.outcome.optionId).toBe('fallback')
    })

    it('handles allow_always kind', () => {
      const policy = new ACPPermissionPolicy({allowAll: true})
      const options = [
        {optionId: 'allow-always', kind: 'allow_always'},
        {optionId: 'deny', kind: 'reject_once'},
      ]

      const response = policy.buildResponse('test', options)
      expect(response.outcome.optionId).toBe('allow-always')
    })
  })

  describe('edge cases', () => {
    it('handles undefined allowedTools', () => {
      const policy = new ACPPermissionPolicy({})

      expect(policy.shouldApprove('anything')).toBe(false)
    })

    it('handles empty string tool name', () => {
      const policy = new ACPPermissionPolicy({allowedTools: ['']})

      expect(policy.shouldApprove('')).toBe(true)
    })

    it('handles numeric tool names', () => {
      const policy = new ACPPermissionPolicy({allowedTools: ['123']})

      expect(policy.shouldApprove('123')).toBe(true)
      expect(policy.shouldApprove('456')).toBe(false)
    })
  })

  describe('state independence', () => {
    it('maintains independent state per instance', () => {
      const policy1 = new ACPPermissionPolicy({allowAll: true})
      const policy2 = new ACPPermissionPolicy({denyAll: true})

      expect(policy1.shouldApprove('test')).toBe(true)
      expect(policy2.shouldApprove('test')).toBe(false)
    })

    it('does not share whitelist between instances', () => {
      const policy1 = new ACPPermissionPolicy({allowedTools: ['tool1']})
      const policy2 = new ACPPermissionPolicy({allowedTools: ['tool2']})

      expect(policy1.shouldApprove('tool1')).toBe(true)
      expect(policy1.shouldApprove('tool2')).toBe(false)
      expect(policy2.shouldApprove('tool2')).toBe(true)
    })
  })
})
