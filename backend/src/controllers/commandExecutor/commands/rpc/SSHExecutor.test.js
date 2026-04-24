import {SSHExecutor} from './SSHExecutor'
import {Client} from 'ssh2'

jest.mock('ssh2')

describe('SSHExecutor', () => {
  let executor
  let mockClient
  let mockStream

  beforeEach(() => {
    executor = new SSHExecutor()

    mockStream = {
      on: jest.fn().mockReturnThis(),
      stderr: {
        on: jest.fn(),
      },
    }

    mockClient = {
      on: jest.fn().mockReturnThis(),
      connect: jest.fn(),
      exec: jest.fn(),
      end: jest.fn(),
    }

    Client.mockImplementation(() => mockClient)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('executes command successfully', async () => {
    mockClient.on.mockImplementation((event, callback) => {
      if (event === 'ready') {
        setImmediate(() => callback())
      }
      return mockClient
    })

    mockClient.exec.mockImplementation((cmd, callback) => {
      callback(null, mockStream)
    })

    mockStream.on.mockImplementation((event, callback) => {
      if (event === 'data') {
        process.nextTick(() => callback(Buffer.from('hello output')))
      } else if (event === 'close') {
        setTimeout(() => callback(0, null), 10)
      }
      return mockStream
    })

    mockStream.stderr.on.mockImplementation((event, callback) => {
      if (event === 'data') {
        process.nextTick(() => callback(Buffer.from('')))
      }
    })

    const result = await executor.execute({
      host: 'localhost',
      username: 'user',
      privateKey: 'fake-key',
      command: 'echo hello',
    })

    expect(result.stdout).toBe('hello output')
    expect(result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
    expect(mockClient.end).toHaveBeenCalled()
  })

  it('prepends working directory to command', async () => {
    mockClient.on.mockImplementation((event, callback) => {
      if (event === 'ready') {
        setImmediate(() => callback())
      }
      return mockClient
    })

    mockClient.exec.mockImplementation((cmd, callback) => {
      expect(cmd).toBe('cd /home/user && ls')
      callback(null, mockStream)
    })

    mockStream.on.mockImplementation((event, callback) => {
      if (event === 'close') {
        setImmediate(() => callback(0, null))
      }
      return mockStream
    })

    mockStream.stderr.on.mockImplementation(() => {})

    await executor.execute({
      host: 'localhost',
      username: 'user',
      privateKey: 'key',
      command: 'ls',
      workingDir: '/home/user',
    })
  })

  it('throws on connection error', async () => {
    mockClient.on.mockImplementation((event, callback) => {
      if (event === 'error') {
        setImmediate(() => callback(new Error('Connection refused')))
      }
      return mockClient
    })

    await expect(
      executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'ls',
      }),
    ).rejects.toThrow('SSH connection failed: Connection refused')
  })

  it('throws on exec error', async () => {
    mockClient.on.mockImplementation((event, callback) => {
      if (event === 'ready') {
        setImmediate(() => callback())
      }
      return mockClient
    })

    mockClient.exec.mockImplementation((cmd, callback) => {
      callback(new Error('Command not found'))
    })

    await expect(
      executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'badcommand',
      }),
    ).rejects.toThrow('SSH exec failed: Command not found')
  })

  describe('shared client mode', () => {
    let sharedClient

    beforeEach(() => {
      sharedClient = {
        exec: jest.fn(),
      }

      mockStream.close = jest.fn()
    })

    it('uses provided client without connecting', async () => {
      sharedClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream)
      })

      mockStream.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          process.nextTick(() => callback(Buffer.from('output from shared')))
        } else if (event === 'close') {
          setTimeout(() => callback(0, null), 10)
        }
        return mockStream
      })

      mockStream.stderr.on.mockImplementation(() => {})

      const result = await executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'echo test',
        client: sharedClient,
      })

      expect(result.stdout).toBe('output from shared')
      expect(sharedClient.exec).toHaveBeenCalledWith('echo test', expect.any(Function))
      expect(Client).not.toHaveBeenCalled()
    })

    it('does not call end() on shared client', async () => {
      sharedClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream)
      })

      mockStream.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setImmediate(() => callback(0, null))
        }
        return mockStream
      })

      mockStream.stderr.on.mockImplementation(() => {})

      sharedClient.end = jest.fn()

      await executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'test',
        client: sharedClient,
      })

      expect(sharedClient.end).not.toHaveBeenCalled()
    })

    it('prepends working directory when using shared client', async () => {
      sharedClient.exec.mockImplementation((cmd, callback) => {
        expect(cmd).toBe('cd /app && ls')
        callback(null, mockStream)
      })

      mockStream.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setImmediate(() => callback(0, null))
        }
        return mockStream
      })

      mockStream.stderr.on.mockImplementation(() => {})

      await executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'ls',
        workingDir: '/app',
        client: sharedClient,
      })
    })

    it('closes stream on timeout without ending shared client', async () => {
      let execCallback
      sharedClient.exec.mockImplementation((cmd, callback) => {
        execCallback = callback
      })

      const promise = executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'slow command',
        timeoutMs: 100,
        client: sharedClient,
      })

      await new Promise(resolve => setTimeout(resolve, 50))
      execCallback(null, mockStream)

      mockStream.on.mockImplementation(() => mockStream)
      mockStream.stderr.on.mockImplementation(() => {})

      await expect(promise).rejects.toThrow('SSH command timeout after 100ms')
      expect(mockStream.close).toHaveBeenCalled()
      expect(sharedClient.end).toBeUndefined()
    })

    it('handles exec error on shared client', async () => {
      sharedClient.exec.mockImplementation((cmd, callback) => {
        callback(new Error('Exec failed'))
      })

      await expect(
        executor.execute({
          host: 'localhost',
          username: 'user',
          privateKey: 'key',
          command: 'test',
          client: sharedClient,
        }),
      ).rejects.toThrow('SSH exec failed: Exec failed')
    })

    it('collects stdout and stderr from shared client', async () => {
      sharedClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream)
      })

      mockStream.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          process.nextTick(() => callback(Buffer.from('line1\n')))
          setTimeout(() => callback(Buffer.from('line2\n')), 5)
        } else if (event === 'close') {
          setTimeout(() => callback(0, null), 20)
        }
        return mockStream
      })

      mockStream.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          process.nextTick(() => callback(Buffer.from('error output\n')))
        }
      })

      const result = await executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'test',
        client: sharedClient,
      })

      expect(result.stdout).toBe('line1\nline2\n')
      expect(result.stderr).toBe('error output\n')
      expect(result.exitCode).toBe(0)
    })

    it('returns non-zero exit code from shared client', async () => {
      sharedClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream)
      })

      mockStream.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          process.nextTick(() => callback(Buffer.from('')))
        } else if (event === 'close') {
          setTimeout(() => callback(127, null), 10)
        }
        return mockStream
      })

      mockStream.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          process.nextTick(() => callback(Buffer.from('command not found')))
        }
      })

      const result = await executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'nonexistent',
        client: sharedClient,
      })

      expect(result.exitCode).toBe(127)
      expect(result.stderr).toContain('command not found')
    })

    it('handles multiple sequential commands on same shared client', async () => {
      let execCount = 0
      sharedClient.exec.mockImplementation((cmd, callback) => {
        execCount++
        callback(null, mockStream)
      })

      mockStream.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setImmediate(() => callback(0, null))
        }
        return mockStream
      })

      mockStream.stderr.on.mockImplementation(() => {})

      await executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'cmd1',
        client: sharedClient,
      })

      await executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'cmd2',
        client: sharedClient,
      })

      await executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'cmd3',
        client: sharedClient,
      })

      expect(execCount).toBe(3)
      expect(Client).not.toHaveBeenCalled()
    })
  })

  describe('timeout behavior', () => {
    it('shared client mode does not terminate connection on timeout', async () => {
      const sharedClient = {
        exec: jest.fn(),
        end: jest.fn(),
      }

      mockStream.close = jest.fn()

      let execCallback
      sharedClient.exec.mockImplementation((cmd, callback) => {
        execCallback = callback
      })

      const promise = executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'slow',
        timeoutMs: 100,
        client: sharedClient,
      })

      await new Promise(resolve => setTimeout(resolve, 50))
      execCallback(null, mockStream)

      mockStream.on.mockImplementation(() => mockStream)
      mockStream.stderr.on.mockImplementation(() => {})

      await expect(promise).rejects.toThrow('SSH command timeout after 100ms')
      expect(mockStream.close).toHaveBeenCalled()
      expect(sharedClient.end).not.toHaveBeenCalled()
    })
  })
})
