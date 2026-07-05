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
        setImmediate(() => callback(0, null))
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

  it('forwards connection parameters to ssh2 connect', async () => {
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
      if (event === 'close') {
        setImmediate(() => callback(0, null))
      }
      return mockStream
    })

    mockStream.stderr.on.mockImplementation(() => {})

    await executor.execute({
      host: '10.0.0.1',
      port: 2222,
      username: 'admin',
      privateKey: 'BEGIN RSA PRIVATE KEY',
      command: 'whoami',
    })

    expect(mockClient.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '10.0.0.1',
        port: 2222,
        username: 'admin',
        privateKey: 'BEGIN RSA PRIVATE KEY',
      }),
    )
  })

  it('maps null passphrase to undefined in connect options', async () => {
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
      command: 'test',
      passphrase: null,
    })

    expect(mockClient.connect).toHaveBeenCalledWith(expect.objectContaining({passphrase: undefined}))
  })

  it('collects multiple stdout chunks and stderr before stream closes', async () => {
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
        process.nextTick(() => {
          callback(Buffer.from('chunk1\n'))
          callback(Buffer.from('chunk2\n'))
        })
      } else if (event === 'close') {
        setImmediate(() => callback(0, null))
      }
      return mockStream
    })

    mockStream.stderr.on.mockImplementation((event, callback) => {
      if (event === 'data') {
        process.nextTick(() => callback(Buffer.from('warning\n')))
      }
    })

    const result = await executor.execute({
      host: 'localhost',
      username: 'user',
      privateKey: 'fake-key',
      command: 'multi',
    })

    expect(result.stdout).toBe('chunk1\nchunk2\n')
    expect(result.stderr).toBe('warning\n')
    expect(result.exitCode).toBe(0)
  })

  it('normalizes null exit code to zero', async () => {
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
      if (event === 'close') {
        setImmediate(() => callback(null, null))
      }
      return mockStream
    })

    mockStream.stderr.on.mockImplementation(() => {})

    const result = await executor.execute({
      host: 'localhost',
      username: 'user',
      privateKey: 'key',
      command: 'test',
    })

    expect(result.exitCode).toBe(0)
  })

  it('returns non-zero exit code from own client', async () => {
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
        process.nextTick(() => callback(Buffer.from('')))
      } else if (event === 'close') {
        setImmediate(() => callback(1, null))
      }
      return mockStream
    })

    mockStream.stderr.on.mockImplementation((event, callback) => {
      if (event === 'data') {
        process.nextTick(() => callback(Buffer.from('exit failure\n')))
      }
    })

    const result = await executor.execute({
      host: 'localhost',
      username: 'user',
      privateKey: 'fake-key',
      command: 'fail',
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('exit failure\n')
    expect(mockClient.end).toHaveBeenCalled()
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
          setImmediate(() => callback(0, null))
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
          process.nextTick(() => {
            callback(Buffer.from('line1\n'))
            callback(Buffer.from('line2\n'))
          })
        } else if (event === 'close') {
          setImmediate(() => callback(0, null))
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

    it('normalizes null exit code to zero', async () => {
      sharedClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream)
      })

      mockStream.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setImmediate(() => callback(null, null))
        }
        return mockStream
      })

      mockStream.stderr.on.mockImplementation(() => {})

      const result = await executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'test',
        client: sharedClient,
      })

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
          setImmediate(() => callback(127, null))
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
    afterEach(() => {
      jest.useRealTimers()
    })

    it('shared client: closes stream and rejects when timeout fires after exec callback', async () => {
      jest.useFakeTimers()
      const sharedClient = {exec: jest.fn(), end: jest.fn()}
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

      execCallback(null, mockStream)
      mockStream.on.mockImplementation(() => mockStream)
      mockStream.stderr.on.mockImplementation(() => {})
      jest.advanceTimersByTime(100)

      await expect(promise).rejects.toThrow('SSH command timeout after 100ms')
      expect(mockStream.close).toHaveBeenCalled()
      expect(sharedClient.end).not.toHaveBeenCalled()
    })

    it('shared client: late exec callback after timeout does not call close on discarded stream', async () => {
      jest.useFakeTimers()
      const sharedClient = {exec: jest.fn(), end: jest.fn()}
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

      jest.advanceTimersByTime(100)
      await expect(promise).rejects.toThrow('SSH command timeout after 100ms')

      execCallback(null, mockStream)
      mockStream.on.mockImplementation(() => mockStream)
      mockStream.stderr.on.mockImplementation(() => {})
      expect(mockStream.close).not.toHaveBeenCalled()
    })

    it('shared client: rejects without closing stream when timeout fires before exec callback', async () => {
      jest.useFakeTimers()
      const sharedClient = {exec: jest.fn(), end: jest.fn()}
      mockStream.close = jest.fn()
      sharedClient.exec.mockImplementation(() => {})

      const promise = executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'slow command',
        timeoutMs: 100,
        client: sharedClient,
      })

      jest.advanceTimersByTime(100)

      await expect(promise).rejects.toThrow('SSH command timeout after 100ms')
      expect(mockStream.close).not.toHaveBeenCalled()
    })

    it('own client: calls client.end() and rejects on timeout', async () => {
      jest.useFakeTimers()
      mockClient.on.mockImplementation(() => mockClient)

      const promise = executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'test',
        timeoutMs: 100,
      })

      jest.advanceTimersByTime(100)

      await expect(promise).rejects.toThrow('SSH command timeout after 100ms')
      expect(mockClient.end).toHaveBeenCalled()
    })

    it('own client: connection error arriving after timeout is suppressed', async () => {
      jest.useFakeTimers()
      let errorHandler
      mockClient.on.mockImplementation((event, callback) => {
        if (event === 'error') errorHandler = callback
        return mockClient
      })

      const promise = executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'test',
        timeoutMs: 100,
      })

      jest.advanceTimersByTime(100)
      await expect(promise).rejects.toThrow('SSH command timeout after 100ms')

      expect(() => errorHandler(new Error('Connection reset'))).not.toThrow()
    })

    it('rejection message includes the configured timeout duration', async () => {
      jest.useFakeTimers()
      const sharedClient = {exec: jest.fn()}
      sharedClient.exec.mockImplementation(() => {})

      const promise = executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'cmd',
        timeoutMs: 250,
        client: sharedClient,
      })

      jest.advanceTimersByTime(250)

      await expect(promise).rejects.toThrow('SSH command timeout after 250ms')
    })

    it('shared client: stream close before deadline cancels the timeout — no pending timer remains', async () => {
      jest.useFakeTimers()
      const sharedClient = {exec: jest.fn()}
      let execCallback
      let closeCallback

      sharedClient.exec.mockImplementation((cmd, cb) => {
        execCallback = cb
      })

      mockStream.on.mockImplementation((event, cb) => {
        if (event === 'close') closeCallback = cb
        return mockStream
      })
      mockStream.stderr.on.mockImplementation(() => {})

      const promise = executor.execute({
        host: 'localhost',
        username: 'user',
        privateKey: 'key',
        command: 'fast',
        timeoutMs: 100,
        client: sharedClient,
      })

      execCallback(null, mockStream)
      closeCallback(0, null)

      const result = await promise
      expect(result.exitCode).toBe(0)
      expect(jest.getTimerCount()).toBe(0)
    })
  })
})
