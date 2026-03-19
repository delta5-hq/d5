import {SSHClientPool} from './SSHClientPool'
import {Client} from 'ssh2'

jest.mock('ssh2')

describe('SSHClientPool', () => {
  let pool
  let mockClient

  const createMockClient = () => ({
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    connect: jest.fn(),
    end: jest.fn(),
    removeListener: jest.fn(),
  })

  const setupReadyClient = client => {
    client.once.mockImplementation((event, callback) => {
      if (event === 'ready') {
        setImmediate(() => callback())
      }
      return client
    })
  }

  const captureLifecycleListener = (client, eventName) => {
    let listener
    const originalOn = client.on
    client.on = jest.fn((event, callback) => {
      if (event === eventName) {
        listener = callback
      }
      originalOn.call(client, event, callback)
      return client
    })
    return () => listener
  }

  beforeEach(() => {
    pool = new SSHClientPool()
    mockClient = createMockClient()
    Client.mockImplementation(() => mockClient)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getOrCreate', () => {
    it('creates new client on first call', async () => {
      setupReadyClient(mockClient)

      const client = await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      expect(client).toBe(mockClient)
      expect(mockClient.connect).toHaveBeenCalledWith({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
        passphrase: undefined,
      })
    })

    it('reuses existing client for same connection params', async () => {
      setupReadyClient(mockClient)

      const client1 = await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      const client2 = await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      expect(client1).toBe(client2)
    })

    it('throws on connection error', async () => {
      mockClient.once.mockImplementation((event, callback) => {
        if (event === 'error') {
          setImmediate(() => callback(new Error('Connection refused')))
        }
        return mockClient
      })

      await expect(
        pool.getOrCreate({
          host: 'example.com',
          port: 22,
          username: 'user',
          privateKey: 'key',
        }),
      ).rejects.toThrow('SSH connection failed: Connection refused')
    })

    it('handles concurrent requests for same connection', async () => {
      let readyCallback
      mockClient.once.mockImplementation((event, callback) => {
        if (event === 'ready') {
          readyCallback = callback
        }
        return mockClient
      })

      const promise1 = pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      const promise2 = pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      setImmediate(() => readyCallback())

      const [client1, client2] = await Promise.all([promise1, promise2])

      expect(client1).toBe(client2)
      expect(Client).toHaveBeenCalledTimes(1)
    })
  })

  describe('disposeAll', () => {
    it('closes all clients', async () => {
      const mockClient2 = createMockClient()

      let callCount = 0
      Client.mockImplementation(() => {
        callCount++
        return callCount === 1 ? mockClient : mockClient2
      })

      setupReadyClient(mockClient)
      setupReadyClient(mockClient2)

      await pool.getOrCreate({
        host: 'host1.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      await pool.getOrCreate({
        host: 'host2.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      pool.disposeAll()

      expect(mockClient.end).toHaveBeenCalled()
      expect(mockClient2.end).toHaveBeenCalled()
    })

    it('ignores errors during cleanup', async () => {
      setupReadyClient(mockClient)

      mockClient.end.mockImplementation(() => {
        throw new Error('Cleanup error')
      })

      await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      expect(() => pool.disposeAll()).not.toThrow()
    })

    it('clears all internal state', async () => {
      setupReadyClient(mockClient)

      await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      pool.disposeAll()

      const mockClient2 = createMockClient()
      Client.mockImplementation(() => mockClient2)
      setupReadyClient(mockClient2)

      const newClient = await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      expect(newClient).toBe(mockClient2)
    })
  })

  describe('lifecycle management', () => {
    it('evicts client on close event and creates new one', async () => {
      const getCloseListener = captureLifecycleListener(mockClient, 'close')
      setupReadyClient(mockClient)

      const client1 = await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      const mockClient2 = createMockClient()
      Client.mockImplementation(() => mockClient2)
      setupReadyClient(mockClient2)

      getCloseListener()()

      const client2 = await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      expect(client2).toBe(mockClient2)
      expect(client2).not.toBe(client1)
    })

    it('evicts client on error event', async () => {
      const getErrorListener = captureLifecycleListener(mockClient, 'error')
      setupReadyClient(mockClient)

      await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      const mockClient2 = createMockClient()
      Client.mockImplementation(() => mockClient2)
      setupReadyClient(mockClient2)

      getErrorListener()(new Error('Connection lost'))

      const client = await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      expect(client).toBe(mockClient2)
    })

    it('handles both close and error events without double-eviction errors', async () => {
      const getCloseListener = captureLifecycleListener(mockClient, 'close')
      const getErrorListener = captureLifecycleListener(mockClient, 'error')
      setupReadyClient(mockClient)

      await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      getErrorListener()(new Error('Network error'))

      const closeListener = getCloseListener()
      expect(() => closeListener()).not.toThrow()

      const mockClient2 = createMockClient()
      Client.mockImplementation(() => mockClient2)
      setupReadyClient(mockClient2)

      const client = await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      expect(client).toBe(mockClient2)
    })

    it('handles eviction during concurrent getOrCreate', async () => {
      const getCloseListener = captureLifecycleListener(mockClient, 'close')
      setupReadyClient(mockClient)

      await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      const mockClient2 = createMockClient()
      Client.mockImplementation(() => mockClient2)
      setupReadyClient(mockClient2)

      getCloseListener()()

      const client = await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
      })

      expect(client).toBe(mockClient2)
    })
  })

  describe('connection key uniqueness', () => {
    it.each([
      [
        'different hosts',
        {host: 'host1.com', port: 22, username: 'user'},
        {host: 'host2.com', port: 22, username: 'user'},
      ],
      [
        'different ports',
        {host: 'example.com', port: 22, username: 'user'},
        {host: 'example.com', port: 2222, username: 'user'},
      ],
      [
        'different usernames',
        {host: 'example.com', port: 22, username: 'user1'},
        {host: 'example.com', port: 22, username: 'user2'},
      ],
    ])('creates separate clients for %s', async (_, params1, params2) => {
      const mockClient2 = createMockClient()

      let callCount = 0
      Client.mockImplementation(() => {
        callCount++
        return callCount === 1 ? mockClient : mockClient2
      })

      setupReadyClient(mockClient)
      setupReadyClient(mockClient2)

      const client1 = await pool.getOrCreate({...params1, privateKey: 'key'})
      const client2 = await pool.getOrCreate({...params2, privateKey: 'key'})

      expect(client1).not.toBe(client2)
    })

    it('handles special characters in connection parameters', async () => {
      setupReadyClient(mockClient)

      const client = await pool.getOrCreate({
        host: '[2001:db8::1]',
        port: 22,
        username: 'user@domain',
        privateKey: 'key',
      })

      expect(client).toBe(mockClient)

      const client2 = await pool.getOrCreate({
        host: '[2001:db8::1]',
        port: 22,
        username: 'user@domain',
        privateKey: 'key',
      })

      expect(client2).toBe(client)
    })
  })

  describe('passphrase handling', () => {
    it.each([
      ['null', null, undefined],
      ['empty string', '', undefined],
      ['non-empty string', 'secret', 'secret'],
    ])('handles %s passphrase', async (_, input, expected) => {
      setupReadyClient(mockClient)

      await pool.getOrCreate({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
        passphrase: input,
      })

      expect(mockClient.connect).toHaveBeenCalledWith({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKey: 'key',
        passphrase: expected,
      })
    })
  })
})
