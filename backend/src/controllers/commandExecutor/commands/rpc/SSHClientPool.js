import {Client} from 'ssh2'

export class SSHClientPool {
  constructor() {
    this._clients = new Map()
    this._connectionPromises = new Map()
  }

  async getOrCreate({host, port = 22, username, privateKey, passphrase = null}) {
    const key = this._generateConnectionKey({host, port, username})

    if (this._clients.has(key)) {
      return this._clients.get(key)
    }

    if (this._connectionPromises.has(key)) {
      return this._connectionPromises.get(key)
    }

    const connectionPromise = this._createAndConnect({host, port, username, privateKey, passphrase, key})
    this._connectionPromises.set(key, connectionPromise)

    try {
      const client = await connectionPromise
      return client
    } finally {
      this._connectionPromises.delete(key)
    }
  }

  async _createAndConnect({host, port, username, privateKey, passphrase, key}) {
    return new Promise((resolve, reject) => {
      const client = new Client()

      const onReady = () => {
        cleanup()
        this._clients.set(key, client)
        this._attachLifecycleListeners(client, key)
        resolve(client)
      }

      const onError = err => {
        cleanup()
        reject(new Error(`SSH connection failed: ${err.message}`))
      }

      const cleanup = () => {
        client.removeListener('ready', onReady)
        client.removeListener('error', onError)
      }

      client
        .once('ready', onReady)
        .once('error', onError)
        .connect({
          host,
          port,
          username,
          privateKey,
          passphrase: passphrase || undefined,
        })
    })
  }

  _attachLifecycleListeners(client, key) {
    const evictFromPool = () => {
      this._clients.delete(key)
    }

    client.on('close', evictFromPool)
    client.on('error', evictFromPool)
  }

  _generateConnectionKey({host, port, username}) {
    return `${host}:${port}:${username}`
  }

  disposeAll() {
    for (const client of this._clients.values()) {
      try {
        client.end()
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    this._clients.clear()
    this._connectionPromises.clear()
  }
}
