import {ACPExecutor} from './ACPExecutor'
import {ACPPermissionPolicy} from './ACPPermissionPolicy'

jest.mock('./ACPConnection')

describe('ACPExecutor', () => {
  let ACPConnection

  beforeEach(() => {
    jest.clearAllMocks()
    ACPConnection = require('./ACPConnection').ACPConnection
  })

  it('initializes connection and executes prompt', async () => {
    const mockConnection = {
      initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
      createSession: jest.fn().mockResolvedValue('session-123'),
      sendPrompt: jest.fn().mockResolvedValue({stopReason: 'end_turn'}),
      close: jest.fn().mockResolvedValue(),
      getSessionId: jest.fn().mockReturnValue('session-123'),
    }

    ACPConnection.mockImplementation(() => mockConnection)

    const executor = new ACPExecutor()
    const policy = new ACPPermissionPolicy({allowAll: true})

    const result = await executor.execute({
      command: 'test-agent',
      args: ['--acp'],
      env: {},
      timeoutMs: 5000,
      cwd: '/test',
      permissionPolicy: policy,
      prompt: 'Hello agent',
    })

    expect(ACPConnection).toHaveBeenCalledWith({
      command: 'test-agent',
      args: ['--acp'],
      env: {},
      timeoutMs: 5000,
      cwd: '/test',
    })

    expect(mockConnection.initialize).toHaveBeenCalled()
    expect(mockConnection.createSession).toHaveBeenCalled()
    expect(mockConnection.sendPrompt).toHaveBeenCalledWith('Hello agent')
    expect(result.exitCode).toBe(0)
    expect(result.stopReason).toBe('end_turn')
  })

  it('closes connection on success', async () => {
    const mockConnection = {
      initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
      createSession: jest.fn().mockResolvedValue('session-123'),
      sendPrompt: jest.fn().mockResolvedValue({stopReason: 'end_turn'}),
      close: jest.fn().mockResolvedValue(),
      getSessionId: jest.fn().mockReturnValue('session-123'),
    }

    ACPConnection.mockImplementation(() => mockConnection)

    const executor = new ACPExecutor()

    await executor.execute({
      command: 'test',
      prompt: 'test',
    })

    expect(mockConnection.close).toHaveBeenCalled()
  })

  it('closes connection on error', async () => {
    const mockConnection = {
      initialize: jest.fn().mockRejectedValue(new Error('Init failed')),
      close: jest.fn().mockResolvedValue(),
    }

    ACPConnection.mockImplementation(() => mockConnection)

    const executor = new ACPExecutor()

    await expect(
      executor.execute({
        command: 'test',
        prompt: 'test',
      }),
    ).rejects.toThrow('Init failed')

    expect(mockConnection.close).toHaveBeenCalled()
  })

  it('uses default denyAll policy when not provided', async () => {
    const mockConnection = {
      initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
      createSession: jest.fn().mockResolvedValue('session-123'),
      sendPrompt: jest.fn().mockResolvedValue({stopReason: 'end_turn'}),
      close: jest.fn().mockResolvedValue(),
      getSessionId: jest.fn().mockReturnValue('session-123'),
    }

    ACPConnection.mockImplementation(() => mockConnection)

    const executor = new ACPExecutor()

    const capturedClient = await new Promise(resolve => {
      mockConnection.initialize.mockImplementation(client => {
        resolve(client)
        return Promise.resolve({protocolVersion: 1})
      })

      executor.execute({command: 'test', prompt: 'test'})
    })

    const permissionResponse = await capturedClient.requestPermission({
      toolCall: {name: 'test_tool', title: 'Test'},
      options: [
        {optionId: 'allow', kind: 'allow_once'},
        {optionId: 'deny', kind: 'reject_once'},
      ],
    })

    expect(permissionResponse.outcome.optionId).toBe('deny')
  })

  it('returns exit code 1 for non-end_turn stop reasons', async () => {
    const mockConnection = {
      initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
      createSession: jest.fn().mockResolvedValue('session-123'),
      sendPrompt: jest.fn().mockResolvedValue({stopReason: 'cancelled'}),
      close: jest.fn().mockResolvedValue(),
      getSessionId: jest.fn().mockReturnValue('session-123'),
    }

    ACPConnection.mockImplementation(() => mockConnection)

    const executor = new ACPExecutor()
    const result = await executor.execute({command: 'test', prompt: 'test'})

    expect(result.exitCode).toBe(1)
    expect(result.stopReason).toBe('cancelled')
  })

  it('throws when command is not provided', async () => {
    const executor = new ACPExecutor()

    await expect(executor.execute({prompt: 'test'})).rejects.toThrow('ACP command is required')
  })

  it('calls onUpdate callback for notifications', async () => {
    const mockConnection = {
      initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
      createSession: jest.fn().mockResolvedValue('session-123'),
      sendPrompt: jest.fn().mockResolvedValue({stopReason: 'end_turn'}),
      close: jest.fn().mockResolvedValue(),
      getSessionId: jest.fn().mockReturnValue('session-123'),
    }

    ACPConnection.mockImplementation(() => mockConnection)

    const executor = new ACPExecutor()
    const onUpdate = jest.fn()

    const capturedClient = await new Promise(resolve => {
      mockConnection.initialize.mockImplementation(client => {
        resolve(client)
        return Promise.resolve({protocolVersion: 1})
      })

      executor.execute({command: 'test', prompt: 'test', onUpdate})
    })

    const notification = {
      sessionId: 'test',
      update: {sessionUpdate: 'agent_message_chunk', content: {type: 'text', text: 'test'}},
    }

    await capturedClient.sessionUpdate(notification)

    expect(onUpdate).toHaveBeenCalledWith(notification)
  })

  describe('parameter handling', () => {
    it('uses default cwd when not provided', async () => {
      const mockConnection = {
        initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
        createSession: jest.fn().mockResolvedValue('session-123'),
        sendPrompt: jest.fn().mockResolvedValue({stopReason: 'end_turn'}),
        close: jest.fn().mockResolvedValue(),
        getSessionId: jest.fn().mockReturnValue('session-123'),
      }

      ACPConnection.mockImplementation(() => mockConnection)

      const executor = new ACPExecutor()
      await executor.execute({command: 'test', prompt: 'test'})

      expect(ACPConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: process.cwd(),
        }),
      )
    })

    it('passes through all configuration parameters', async () => {
      const mockConnection = {
        initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
        createSession: jest.fn().mockResolvedValue('session-123'),
        sendPrompt: jest.fn().mockResolvedValue({stopReason: 'end_turn'}),
        close: jest.fn().mockResolvedValue(),
        getSessionId: jest.fn().mockReturnValue('session-123'),
      }

      ACPConnection.mockImplementation(() => mockConnection)

      const executor = new ACPExecutor()
      await executor.execute({
        command: 'agent',
        args: ['--flag'],
        env: {VAR: 'value'},
        timeoutMs: 10000,
        cwd: '/custom',
        prompt: 'test',
      })

      expect(ACPConnection).toHaveBeenCalledWith({
        command: 'agent',
        args: ['--flag'],
        env: {VAR: 'value'},
        timeoutMs: 10000,
        cwd: '/custom',
      })
    })
  })

  describe('session ID handling', () => {
    it('returns sessionId from connection when aggregator has none', async () => {
      const mockConnection = {
        initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
        createSession: jest.fn().mockResolvedValue('session-from-create'),
        sendPrompt: jest.fn().mockResolvedValue({stopReason: 'end_turn'}),
        close: jest.fn().mockResolvedValue(),
        getSessionId: jest.fn().mockReturnValue('session-from-create'),
      }

      ACPConnection.mockImplementation(() => mockConnection)

      const executor = new ACPExecutor()
      const result = await executor.execute({command: 'test', prompt: 'test'})

      expect(result.sessionId).toBe('session-from-create')
    })

    it('prefers aggregator sessionId over connection sessionId', async () => {
      let capturedClient

      const mockConnection = {
        initialize: jest.fn().mockImplementation(client => {
          capturedClient = client
          return Promise.resolve({protocolVersion: 1})
        }),
        createSession: jest.fn().mockResolvedValue('session-from-create'),
        sendPrompt: jest.fn().mockImplementation(async () => {
          await capturedClient.sessionUpdate({
            sessionId: 'session-from-notification',
            update: {sessionUpdate: 'agent_message_chunk', content: {type: 'text', text: 'test'}},
          })
          return {stopReason: 'end_turn'}
        }),
        close: jest.fn().mockResolvedValue(),
        getSessionId: jest.fn().mockReturnValue('session-from-create'),
      }

      ACPConnection.mockImplementation(() => mockConnection)

      const executor = new ACPExecutor()
      const result = await executor.execute({command: 'test', prompt: 'test'})

      expect(result.sessionId).toBe('session-from-notification')
    })
  })

  describe('output aggregation', () => {
    it('includes aggregated text in output', async () => {
      let capturedClient

      const mockConnection = {
        initialize: jest.fn().mockImplementation(client => {
          capturedClient = client
          return Promise.resolve({protocolVersion: 1})
        }),
        createSession: jest.fn().mockResolvedValue('session-123'),
        sendPrompt: jest.fn().mockImplementation(async () => {
          await capturedClient.sessionUpdate({
            sessionId: 'test',
            update: {sessionUpdate: 'agent_message_chunk', content: {type: 'text', text: 'Hello '}},
          })
          await capturedClient.sessionUpdate({
            sessionId: 'test',
            update: {sessionUpdate: 'agent_message_chunk', content: {type: 'text', text: 'World'}},
          })
          return {stopReason: 'end_turn'}
        }),
        close: jest.fn().mockResolvedValue(),
        getSessionId: jest.fn().mockReturnValue('session-123'),
      }

      ACPConnection.mockImplementation(() => mockConnection)

      const executor = new ACPExecutor()
      const result = await executor.execute({command: 'test', prompt: 'test'})

      expect(result.output).toContain('Hello World')
    })

    it('includes tool call summary in output', async () => {
      let capturedClient

      const mockConnection = {
        initialize: jest.fn().mockImplementation(client => {
          capturedClient = client
          return Promise.resolve({protocolVersion: 1})
        }),
        createSession: jest.fn().mockResolvedValue('session-123'),
        sendPrompt: jest.fn().mockImplementation(async () => {
          await capturedClient.sessionUpdate({
            sessionId: 'test',
            update: {
              sessionUpdate: 'tool_call',
              toolCallId: 'tool-1',
              name: 'read_file',
              title: 'Read file.txt',
              status: 'success',
            },
          })
          return {stopReason: 'end_turn'}
        }),
        close: jest.fn().mockResolvedValue(),
        getSessionId: jest.fn().mockReturnValue('session-123'),
      }

      ACPConnection.mockImplementation(() => mockConnection)

      const executor = new ACPExecutor()
      const result = await executor.execute({command: 'test', prompt: 'test'})

      expect(result.output).toContain('[Tool: Read file.txt] success')
    })
  })

  describe('permission request handling', () => {
    it('respects policy for multiple permission requests', async () => {
      const mockConnection = {
        initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
        createSession: jest.fn().mockResolvedValue('session-123'),
        sendPrompt: jest.fn().mockResolvedValue({stopReason: 'end_turn'}),
        close: jest.fn().mockResolvedValue(),
        getSessionId: jest.fn().mockReturnValue('session-123'),
      }

      ACPConnection.mockImplementation(() => mockConnection)

      const policy = new ACPPermissionPolicy({allowedTools: ['safe_tool']})
      const executor = new ACPExecutor()

      const capturedClient = await new Promise(resolve => {
        mockConnection.initialize.mockImplementation(client => {
          resolve(client)
          return Promise.resolve({protocolVersion: 1})
        })

        executor.execute({command: 'test', prompt: 'test', permissionPolicy: policy})
      })

      const options = [
        {optionId: 'allow', kind: 'allow_once'},
        {optionId: 'deny', kind: 'reject_once'},
      ]

      const response1 = await capturedClient.requestPermission({
        toolCall: {name: 'safe_tool', title: 'Safe'},
        options,
      })

      const response2 = await capturedClient.requestPermission({
        toolCall: {name: 'dangerous_tool', title: 'Dangerous'},
        options,
      })

      expect(response1.outcome.optionId).toBe('allow')
      expect(response2.outcome.optionId).toBe('deny')
    })
  })

  describe('error propagation', () => {
    it('propagates errors from createSession', async () => {
      const mockConnection = {
        initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
        createSession: jest.fn().mockRejectedValue(new Error('Session creation failed')),
        close: jest.fn().mockResolvedValue(),
      }

      ACPConnection.mockImplementation(() => mockConnection)

      const executor = new ACPExecutor()

      await expect(executor.execute({command: 'test', prompt: 'test'})).rejects.toThrow('Session creation failed')
    })

    it('propagates errors from sendPrompt', async () => {
      const mockConnection = {
        initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
        createSession: jest.fn().mockResolvedValue('session-123'),
        sendPrompt: jest.fn().mockRejectedValue(new Error('Prompt failed')),
        close: jest.fn().mockResolvedValue(),
      }

      ACPConnection.mockImplementation(() => mockConnection)

      const executor = new ACPExecutor()

      await expect(executor.execute({command: 'test', prompt: 'test'})).rejects.toThrow('Prompt failed')
    })
  })

  describe('stop reason handling', () => {
    it('returns exit code 0 for end_turn', async () => {
      const mockConnection = {
        initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
        createSession: jest.fn().mockResolvedValue('session-123'),
        sendPrompt: jest.fn().mockResolvedValue({stopReason: 'end_turn'}),
        close: jest.fn().mockResolvedValue(),
        getSessionId: jest.fn().mockReturnValue('session-123'),
      }

      ACPConnection.mockImplementation(() => mockConnection)

      const executor = new ACPExecutor()
      const result = await executor.execute({command: 'test', prompt: 'test'})

      expect(result.exitCode).toBe(0)
    })

    it('returns exit code 1 for error stop reason', async () => {
      const mockConnection = {
        initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
        createSession: jest.fn().mockResolvedValue('session-123'),
        sendPrompt: jest.fn().mockResolvedValue({stopReason: 'error'}),
        close: jest.fn().mockResolvedValue(),
        getSessionId: jest.fn().mockReturnValue('session-123'),
      }

      ACPConnection.mockImplementation(() => mockConnection)

      const executor = new ACPExecutor()
      const result = await executor.execute({command: 'test', prompt: 'test'})

      expect(result.exitCode).toBe(1)
    })

    it('returns exit code 1 for max_turns', async () => {
      const mockConnection = {
        initialize: jest.fn().mockResolvedValue({protocolVersion: 1}),
        createSession: jest.fn().mockResolvedValue('session-123'),
        sendPrompt: jest.fn().mockResolvedValue({stopReason: 'max_turns'}),
        close: jest.fn().mockResolvedValue(),
        getSessionId: jest.fn().mockReturnValue('session-123'),
      }

      ACPConnection.mockImplementation(() => mockConnection)

      const executor = new ACPExecutor()
      const result = await executor.execute({command: 'test', prompt: 'test'})

      expect(result.exitCode).toBe(1)
      expect(result.stopReason).toBe('max_turns')
    })
  })
})
