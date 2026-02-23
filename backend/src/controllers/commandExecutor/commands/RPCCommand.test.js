import {RPCCommand} from './RPCCommand'
import Store from './utils/Store'
import {SSHExecutor} from './rpc/SSHExecutor'
import {HTTPExecutor} from './rpc/HTTPExecutor'
import Integration from '../../../models/Integration'

jest.mock('./rpc/SSHExecutor')
jest.mock('./rpc/HTTPExecutor')
jest.mock('../../../models/Integration', () => ({
  updateOne: jest.fn(),
}))

const userId = 'userId'
const workflowId = 'workflowId'

const makeStore = () =>
  new Store({
    userId,
    workflowId,
    nodes: {},
  })

const sshAliasConfig = {
  alias: '/vm1',
  protocol: 'ssh',
  host: 'vm1.example.com',
  port: 22,
  username: 'deploy',
  privateKey: 'fake-key-data',
  commandTemplate: 'cd /app && ./run.sh "{{prompt}}"',
  timeoutMs: 60000,
  outputFormat: 'text',
}

const httpAliasConfig = {
  alias: '/webhook1',
  protocol: 'http',
  url: 'https://api.example.com/execute',
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  bodyTemplate: '{"query":"{{prompt}}"}',
  timeoutMs: 30000,
  outputFormat: 'json',
  outputField: 'result.data',
}

describe('RPCCommand', () => {
  let mockStore
  let mockSSHExecutor
  let mockHTTPExecutor

  beforeEach(() => {
    jest.clearAllMocks()
    mockStore = makeStore()
    mockStore.importer.createNodes = jest.fn()

    mockSSHExecutor = {
      execute: jest.fn().mockResolvedValue({stdout: 'ssh output', stderr: '', exitCode: 0}),
    }
    SSHExecutor.mockImplementation(() => mockSSHExecutor)

    mockHTTPExecutor = {
      execute: jest.fn().mockResolvedValue({
        body: '{"result":{"data":"http response"}}',
        status: 200,
        isError: false,
      }),
    }
    HTTPExecutor.mockImplementation(() => mockHTTPExecutor)
  })

  describe('constructor', () => {
    it('initializes with required properties', () => {
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)

      expect(command.userId).toBe(userId)
      expect(command.workflowId).toBe(workflowId)
      expect(command.store).toBe(mockStore)
      expect(command.aliasConfig).toBe(sshAliasConfig)
    })
  })

  describe('extractPrompt', () => {
    it('strips alias prefix from original prompt', () => {
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)
      const result = command.extractPrompt({}, '/vm1 execute task')

      expect(result).toBe('execute task')
    })

    it('strips alias prefix from node command', () => {
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)
      const result = command.extractPrompt({command: '/vm1 do something'}, null)

      expect(result).toBe('do something')
    })

    it('falls back to node title when command not present', () => {
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)
      const result = command.extractPrompt({title: '/vm1 from title'}, null)

      expect(result).toBe('from title')
    })

    it('handles alias without following space', () => {
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)
      const result = command.extractPrompt({}, '/vm1')

      expect(result).toBe('')
    })

    it('does not strip when alias is substring of another word', () => {
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)
      const result = command.extractPrompt({}, '/vm1000 test')

      expect(result).toBe('/vm1000 test')
    })

    it('trims leading whitespace', () => {
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)
      const result = command.extractPrompt({}, '  /vm1   task  ')

      expect(result).toBe('task  ')
    })
  })

  describe('executeSSH', () => {
    it('interpolates prompt into command template with shell escaping', async () => {
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)

      await command.executeSSH("test's prompt")

      expect(mockSSHExecutor.execute).toHaveBeenCalledWith({
        host: 'vm1.example.com',
        port: 22,
        username: 'deploy',
        privateKey: 'fake-key-data',
        passphrase: undefined,
        command: 'cd /app && ./run.sh "test\'s prompt"',
        workingDir: undefined,
        timeoutMs: 60000,
      })
    })

    it('returns stdout when command succeeds', async () => {
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)

      const result = await command.executeSSH('test')

      expect(result).toBe('ssh output')
    })

    it('returns stderr when command fails', async () => {
      mockSSHExecutor.execute.mockResolvedValue({
        stdout: '',
        stderr: 'error message',
        exitCode: 1,
      })
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)

      const result = await command.executeSSH('test')

      expect(result).toBe('error message')
    })

    it('includes workingDir when specified', async () => {
      const config = {...sshAliasConfig, workingDir: '/home/user'}
      const command = new RPCCommand(userId, workflowId, mockStore, config)

      await command.executeSSH('test')

      expect(mockSSHExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          workingDir: '/home/user',
        }),
      )
    })

    it('includes passphrase when specified', async () => {
      const config = {...sshAliasConfig, passphrase: 'secret'}
      const command = new RPCCommand(userId, workflowId, mockStore, config)

      await command.executeSSH('test')

      expect(mockSSHExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          passphrase: 'secret',
        }),
      )
    })
  })

  describe('executeHTTP', () => {
    it('interpolates prompt into body template with JSON escaping', async () => {
      const command = new RPCCommand(userId, workflowId, mockStore, httpAliasConfig)

      await command.executeHTTP('say "hello"')

      expect(mockHTTPExecutor.execute).toHaveBeenCalledWith({
        url: 'https://api.example.com/execute',
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: '{"query":"say \\"hello\\""}',
        timeoutMs: 30000,
      })
    })

    it('returns response body', async () => {
      const command = new RPCCommand(userId, workflowId, mockStore, httpAliasConfig)

      const result = await command.executeHTTP('test')

      expect(result).toBe('{"result":{"data":"http response"}}')
    })

    it('omits body when no bodyTemplate specified', async () => {
      const config = {...httpAliasConfig, bodyTemplate: undefined}
      const command = new RPCCommand(userId, workflowId, mockStore, config)

      await command.executeHTTP('test')

      expect(mockHTTPExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          body: null,
        }),
      )
    })
  })

  describe('run', () => {
    it('executes SSH protocol and creates output nodes', async () => {
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)
      const node = {id: 'node1', command: '/vm1 run tests'}

      await command.run(node, null, null)

      expect(mockSSHExecutor.execute).toHaveBeenCalled()
      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('ssh output', 'node1')
    })

    it('executes HTTP protocol and creates output nodes', async () => {
      const command = new RPCCommand(userId, workflowId, mockStore, httpAliasConfig)
      const node = {id: 'node2', command: '/webhook1 execute'}

      await command.run(node, null, null)

      expect(mockHTTPExecutor.execute).toHaveBeenCalled()
      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('http response', 'node2')
    })

    it('parses JSON output when outputFormat is json', async () => {
      const command = new RPCCommand(userId, workflowId, mockStore, httpAliasConfig)
      const node = {id: 'node3'}

      await command.run(node, null, 'test')

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('http response', 'node3')
    })

    it('prepends context to prompt', async () => {
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)
      const node = {id: 'node4'}

      await command.run(node, 'context: ', 'prompt')

      const call = mockSSHExecutor.execute.mock.calls[0][0]
      expect(call.command).toContain('context: prompt')
    })

    it('handles errors by creating error node', async () => {
      mockSSHExecutor.execute.mockRejectedValue(new Error('Connection failed'))
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)
      const node = {id: 'node5'}

      await command.run(node, null, 'test')

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('Error: Connection failed', 'node5')
    })

    it('throws on unknown protocol', async () => {
      const config = {...sshAliasConfig, protocol: 'unknown'}
      const command = new RPCCommand(userId, workflowId, mockStore, config)
      const node = {id: 'node6'}

      await command.run(node, null, 'test')

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith(
        expect.stringContaining('Unknown RPC protocol'),
        'node6',
      )
    })

    it('creates placeholder when output is empty', async () => {
      mockSSHExecutor.execute.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      })
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)
      const node = {id: 'node7'}

      await command.run(node, null, 'test')

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('(empty RPC response)', 'node7')
    })
  })

  describe('protocol-specific behavior', () => {
    it('SSH uses shell escaping for command template', async () => {
      const command = new RPCCommand(userId, workflowId, mockStore, sshAliasConfig)

      await command.executeSSH("prompt with 'quotes'")

      const call = mockSSHExecutor.execute.mock.calls[0][0]
      expect(call.command).toBe('cd /app && ./run.sh "prompt with \'quotes\'"')
    })

    it('HTTP uses JSON escaping for body template', async () => {
      const command = new RPCCommand(userId, workflowId, mockStore, httpAliasConfig)

      await command.executeHTTP('prompt with "quotes"')

      const call = mockHTTPExecutor.execute.mock.calls[0][0]
      expect(call.body).toContain('\\"')
    })
  })

  describe('output parsing', () => {
    it('parses text format without modification', async () => {
      const config = {...sshAliasConfig, outputFormat: 'text'}
      const command = new RPCCommand(userId, workflowId, mockStore, config)
      const node = {id: 'node8'}

      await command.run(node, null, 'test')

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('ssh output', 'node8')
    })

    it('extracts JSON field when specified', async () => {
      mockHTTPExecutor.execute.mockResolvedValue({
        body: '{"result":{"data":"extracted value"}}',
        status: 200,
        isError: false,
      })
      const command = new RPCCommand(userId, workflowId, mockStore, httpAliasConfig)
      const node = {id: 'node9'}

      await command.run(node, null, 'test')

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('extracted value', 'node9')
    })

    it('returns full JSON when field extraction fails', async () => {
      mockHTTPExecutor.execute.mockResolvedValue({
        body: '{"other":"data"}',
        status: 200,
        isError: false,
      })
      const command = new RPCCommand(userId, workflowId, mockStore, httpAliasConfig)
      const node = {id: 'node10'}

      await command.run(node, null, 'test')

      const call = mockStore.importer.createNodes.mock.calls[0][0]
      expect(JSON.parse(call)).toEqual({other: 'data'})
    })
  })

  describe('session management', () => {
    beforeEach(() => {
      Integration.updateOne = jest.fn().mockResolvedValue({})
    })

    it('extracts and persists session_id from JSON output', async () => {
      mockSSHExecutor.execute.mockResolvedValue({
        stdout: JSON.stringify({session_id: 'abc-123', result: 'output'}),
        stderr: '',
        exitCode: 0,
      })
      const config = {...sshAliasConfig, outputFormat: 'json'}
      const command = new RPCCommand(userId, workflowId, mockStore, config)
      const node = {id: 'node1'}

      await command.run(node, null, 'test')

      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'userId', 'rpc.alias': '/vm1'},
        {$set: {'rpc.$.lastSessionId': 'abc-123'}},
      )
    })

    it('does not persist session_id when output format is text', async () => {
      mockSSHExecutor.execute.mockResolvedValue({
        stdout: JSON.stringify({session_id: 'abc-123'}),
        stderr: '',
        exitCode: 0,
      })
      const config = {...sshAliasConfig, outputFormat: 'text'}
      const command = new RPCCommand(userId, workflowId, mockStore, config)
      const node = {id: 'node2'}

      await command.run(node, null, 'test')

      expect(Integration.updateOne).not.toHaveBeenCalled()
    })

    it('does not persist when session_id field is missing', async () => {
      mockSSHExecutor.execute.mockResolvedValue({
        stdout: JSON.stringify({result: 'output'}),
        stderr: '',
        exitCode: 0,
      })
      const config = {...sshAliasConfig, outputFormat: 'json'}
      const command = new RPCCommand(userId, workflowId, mockStore, config)
      const node = {id: 'node3'}

      await command.run(node, null, 'test')

      expect(Integration.updateOne).not.toHaveBeenCalled()
    })

    it('injects lastSessionId into command template when present', async () => {
      const config = {
        ...sshAliasConfig,
        commandTemplate: 'claude -p "{{prompt}}" --resume {{sessionId}}',
        lastSessionId: 'prev-session-123',
      }
      const command = new RPCCommand(userId, workflowId, mockStore, config)

      await command.executeSSH('test prompt')

      const call = mockSSHExecutor.execute.mock.calls[0][0]
      expect(call.command).toContain('--resume prev-session-123')
    })

    it('removes --resume flag when lastSessionId is absent', async () => {
      const config = {
        ...sshAliasConfig,
        commandTemplate: 'claude -p "{{prompt}}" --resume {{sessionId}}',
        lastSessionId: null,
      }
      const command = new RPCCommand(userId, workflowId, mockStore, config)

      await command.executeSSH('test prompt')

      const call = mockSSHExecutor.execute.mock.calls[0][0]
      expect(call.command).not.toContain('--resume')
      expect(call.command).not.toContain('{{sessionId}}')
    })

    it('handles persistence failure gracefully without throwing', async () => {
      Integration.updateOne = jest.fn().mockRejectedValue(new Error('DB error'))
      mockSSHExecutor.execute.mockResolvedValue({
        stdout: JSON.stringify({session_id: 'abc-123', result: 'output'}),
        stderr: '',
        exitCode: 0,
      })
      const config = {...sshAliasConfig, outputFormat: 'json', outputField: 'result'}
      const command = new RPCCommand(userId, workflowId, mockStore, config)
      const node = {id: 'node4'}

      await expect(command.run(node, null, 'test')).resolves.not.toThrow()

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('output', 'node4')
    })

    it('supports round-trip session workflow', async () => {
      const config = {
        ...sshAliasConfig,
        commandTemplate: 'claude -p "{{prompt}}" --output-format json --resume {{sessionId}}',
        outputFormat: 'json',
        outputField: 'result',
        lastSessionId: 'first-session',
      }

      mockSSHExecutor.execute.mockResolvedValue({
        stdout: JSON.stringify({session_id: 'second-session', result: 'continued output'}),
        stderr: '',
        exitCode: 0,
      })

      const command = new RPCCommand(userId, workflowId, mockStore, config)
      const node = {id: 'node5'}

      await command.run(node, null, 'continue conversation')

      const sshCall = mockSSHExecutor.execute.mock.calls[0][0]
      expect(sshCall.command).toContain('--resume first-session')

      expect(Integration.updateOne).toHaveBeenCalledWith(
        {userId: 'userId', 'rpc.alias': '/vm1'},
        {$set: {'rpc.$.lastSessionId': 'second-session'}},
      )

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('continued output', 'node5')
    })

    describe('HTTP protocol session injection', () => {
      it('injects sessionId into bodyTemplate', async () => {
        const config = {
          ...httpAliasConfig,
          bodyTemplate: '{"query":"{{prompt}}","session":"{{sessionId}}"}',
          lastSessionId: 'http-session-123',
        }
        const command = new RPCCommand(userId, workflowId, mockStore, config)

        await command.executeHTTP('test prompt')

        const call = mockHTTPExecutor.execute.mock.calls[0][0]
        expect(call.body).toContain('"session":"http-session-123"')
        expect(call.body).not.toContain('{{sessionId}}')
      })

      it('injects sessionId into url query parameters', async () => {
        const config = {
          ...httpAliasConfig,
          url: 'https://api.example.com/chat?session={{sessionId}}',
          lastSessionId: 'url-session-456',
        }
        const command = new RPCCommand(userId, workflowId, mockStore, config)

        await command.executeHTTP('test prompt')

        const call = mockHTTPExecutor.execute.mock.calls[0][0]
        expect(call.url).toBe('https://api.example.com/chat?session=url-session-456')
      })

      it('injects sessionId into header values', async () => {
        const config = {
          ...httpAliasConfig,
          headers: {
            Authorization: 'Bearer {{sessionId}}',
            'X-Session-Id': '{{sessionId}}',
          },
          lastSessionId: 'header-session-789',
        }
        const command = new RPCCommand(userId, workflowId, mockStore, config)

        await command.executeHTTP('test prompt')

        const call = mockHTTPExecutor.execute.mock.calls[0][0]
        expect(call.headers.Authorization).toBe('Bearer header-session-789')
        expect(call.headers['X-Session-Id']).toBe('header-session-789')
      })

      it('removes sessionId placeholder when session is absent', async () => {
        const config = {
          ...httpAliasConfig,
          url: 'https://api.example.com/chat?session={{sessionId}}',
          bodyTemplate: '{"query":"{{prompt}}","session":"{{sessionId}}"}',
          headers: {Authorization: 'Bearer {{sessionId}}'},
          lastSessionId: null,
        }
        const command = new RPCCommand(userId, workflowId, mockStore, config)

        await command.executeHTTP('test prompt')

        const call = mockHTTPExecutor.execute.mock.calls[0][0]
        expect(call.url).not.toContain('{{sessionId}}')
        expect(call.body).not.toContain('{{sessionId}}')
        expect(call.headers.Authorization).not.toContain('{{sessionId}}')
      })

      it('handles undefined sessionId same as null', async () => {
        const config = {
          ...httpAliasConfig,
          bodyTemplate: '{"session":"{{sessionId}}"}',
          lastSessionId: undefined,
        }
        const command = new RPCCommand(userId, workflowId, mockStore, config)

        await command.executeHTTP('test prompt')

        const call = mockHTTPExecutor.execute.mock.calls[0][0]
        expect(call.body).not.toContain('{{sessionId}}')
      })

      it('handles empty string sessionId', async () => {
        const config = {
          ...httpAliasConfig,
          bodyTemplate: '{"session":"{{sessionId}}"}',
          lastSessionId: '',
        }
        const command = new RPCCommand(userId, workflowId, mockStore, config)

        await command.executeHTTP('test prompt')

        const call = mockHTTPExecutor.execute.mock.calls[0][0]
        expect(call.body).not.toContain('{{sessionId}}')
      })
    })

    describe('protocol-agnostic session behavior', () => {
      it('processes full session lifecycle for SSH protocol', async () => {
        const config = {
          ...sshAliasConfig,
          commandTemplate: 'agent -p "{{prompt}}" --session {{sessionId}}',
          outputFormat: 'json',
          sessionIdField: 'session_id',
          lastSessionId: 'session-1',
        }

        mockSSHExecutor.execute.mockResolvedValue({
          stdout: JSON.stringify({session_id: 'session-2', result: 'output'}),
          stderr: '',
          exitCode: 0,
        })

        const command = new RPCCommand(userId, workflowId, mockStore, config)
        const node = {id: 'lifecycle-ssh'}

        await command.run(node, null, 'test')

        const call = mockSSHExecutor.execute.mock.calls[0][0]
        expect(call.command).toContain('session-1')
        expect(Integration.updateOne).toHaveBeenCalledWith(
          {userId: 'userId', 'rpc.alias': '/vm1'},
          {$set: {'rpc.$.lastSessionId': 'session-2'}},
        )
      })

      it('processes full session lifecycle for HTTP protocol', async () => {
        const config = {
          ...httpAliasConfig,
          bodyTemplate: '{"query":"{{prompt}}","session":"{{sessionId}}"}',
          outputFormat: 'json',
          sessionIdField: 'session_id',
          lastSessionId: 'http-session-1',
        }

        mockHTTPExecutor.execute.mockResolvedValue({
          body: JSON.stringify({session_id: 'http-session-2', result: {data: 'output'}}),
          status: 200,
          isError: false,
        })

        const command = new RPCCommand(userId, workflowId, mockStore, config)
        const node = {id: 'lifecycle-http'}

        await command.run(node, null, 'test')

        const call = mockHTTPExecutor.execute.mock.calls[0][0]
        expect(call.body).toContain('"session":"http-session-1"')
        expect(Integration.updateOne).toHaveBeenCalledWith(
          {userId: 'userId', 'rpc.alias': '/webhook1'},
          {$set: {'rpc.$.lastSessionId': 'http-session-2'}},
        )
      })

      it('handles first session creation without prior sessionId', async () => {
        const config = {
          ...sshAliasConfig,
          commandTemplate: 'agent -p "{{prompt}}" --session {{sessionId}}',
          outputFormat: 'json',
          lastSessionId: null,
        }

        mockSSHExecutor.execute.mockResolvedValue({
          stdout: JSON.stringify({session_id: 'new-session', result: 'output'}),
          stderr: '',
          exitCode: 0,
        })

        const command = new RPCCommand(userId, workflowId, mockStore, config)
        const node = {id: 'first-session'}

        await command.run(node, null, 'test')

        const call = mockSSHExecutor.execute.mock.calls[0][0]
        expect(call.command).not.toContain('{{sessionId}}')
        expect(Integration.updateOne).toHaveBeenCalledWith(
          {userId: 'userId', 'rpc.alias': '/vm1'},
          {$set: {'rpc.$.lastSessionId': 'new-session'}},
        )
      })
    })

    describe('session field extraction', () => {
      it('extracts from default session_id field', async () => {
        mockSSHExecutor.execute.mockResolvedValue({
          stdout: JSON.stringify({session_id: 'default-789', result: 'output'}),
          stderr: '',
          exitCode: 0,
        })
        const config = {...sshAliasConfig, outputFormat: 'json'}
        const command = new RPCCommand(userId, workflowId, mockStore, config)
        const node = {id: 'node-default'}

        await command.run(node, null, 'test')

        expect(Integration.updateOne).toHaveBeenCalledWith(
          {userId: 'userId', 'rpc.alias': '/vm1'},
          {$set: {'rpc.$.lastSessionId': 'default-789'}},
        )
      })

      it('extracts from custom top-level field', async () => {
        mockHTTPExecutor.execute.mockResolvedValue({
          body: JSON.stringify({conversation_id: 'custom-123', response: 'output'}),
          status: 200,
          isError: false,
        })
        const config = {
          ...httpAliasConfig,
          outputFormat: 'json',
          sessionIdField: 'conversation_id',
        }
        const command = new RPCCommand(userId, workflowId, mockStore, config)
        const node = {id: 'node-custom'}

        await command.run(node, null, 'test')

        expect(Integration.updateOne).toHaveBeenCalledWith(
          {userId: 'userId', 'rpc.alias': '/webhook1'},
          {$set: {'rpc.$.lastSessionId': 'custom-123'}},
        )
      })

      it('extracts from nested field path', async () => {
        mockHTTPExecutor.execute.mockResolvedValue({
          body: JSON.stringify({meta: {session: {id: 'nested-456'}}, data: 'output'}),
          status: 200,
          isError: false,
        })
        const config = {
          ...httpAliasConfig,
          outputFormat: 'json',
          sessionIdField: 'meta.session.id',
        }
        const command = new RPCCommand(userId, workflowId, mockStore, config)
        const node = {id: 'node-nested'}

        await command.run(node, null, 'test')

        expect(Integration.updateOne).toHaveBeenCalledWith(
          {userId: 'userId', 'rpc.alias': '/webhook1'},
          {$set: {'rpc.$.lastSessionId': 'nested-456'}},
        )
      })

      it('does not extract when field value is non-string', async () => {
        mockHTTPExecutor.execute.mockResolvedValue({
          body: JSON.stringify({session_id: 12345, data: 'output'}),
          status: 200,
          isError: false,
        })
        const config = {...httpAliasConfig, outputFormat: 'json'}
        const command = new RPCCommand(userId, workflowId, mockStore, config)
        const node = {id: 'node-number'}

        await command.run(node, null, 'test')

        expect(Integration.updateOne).not.toHaveBeenCalled()
      })

      it('does not extract when field is missing', async () => {
        mockHTTPExecutor.execute.mockResolvedValue({
          body: JSON.stringify({data: 'output'}),
          status: 200,
          isError: false,
        })
        const config = {...httpAliasConfig, outputFormat: 'json', sessionIdField: 'missing.field'}
        const command = new RPCCommand(userId, workflowId, mockStore, config)
        const node = {id: 'node-missing'}

        await command.run(node, null, 'test')

        expect(Integration.updateOne).not.toHaveBeenCalled()
      })
    })
  })
})
