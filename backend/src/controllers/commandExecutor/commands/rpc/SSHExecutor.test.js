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
})
