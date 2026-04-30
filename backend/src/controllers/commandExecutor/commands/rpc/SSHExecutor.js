import {Client} from 'ssh2'
import {RPC_DEFAULT_TIMEOUT_MS} from '../../constants/rpc'

export class SSHExecutor {
  async execute({
    host,
    port = 22,
    username,
    privateKey,
    passphrase = null,
    command,
    workingDir = null,
    timeoutMs = RPC_DEFAULT_TIMEOUT_MS,
    client = null,
  }) {
    if (client) {
      return this._executeOnSharedClient({client, command, workingDir, timeoutMs})
    }

    return this._executeWithOwnClient({
      host,
      port,
      username,
      privateKey,
      passphrase,
      command,
      workingDir,
      timeoutMs,
    })
  }

  async _executeOnSharedClient({client, command, workingDir, timeoutMs}) {
    return new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''
      let timedOut = false
      let stream = null

      const timeoutId = setTimeout(() => {
        timedOut = true
        if (stream) {
          stream.close()
        }
        reject(new Error(`SSH command timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      const cleanup = () => {
        clearTimeout(timeoutId)
      }

      const execCommand = workingDir ? `cd ${workingDir} && ${command}` : command

      client.exec(execCommand, (err, execStream) => {
        if (err) {
          cleanup()
          return reject(new Error(`SSH exec failed: ${err.message}`))
        }

        stream = execStream

        stream
          .on('close', exitCode => {
            cleanup()
            if (timedOut) return

            resolve({
              stdout,
              stderr,
              exitCode: exitCode || 0,
            })
          })
          .on('data', data => {
            stdout += data.toString()
          })
          .stderr.on('data', data => {
            stderr += data.toString()
          })
      })
    })
  }

  async _executeWithOwnClient({host, port, username, privateKey, passphrase, command, workingDir, timeoutMs}) {
    return new Promise((resolve, reject) => {
      const client = new Client()
      let stdout = ''
      let stderr = ''
      let timedOut = false

      const timeoutId = setTimeout(() => {
        timedOut = true
        client.end()
        reject(new Error(`SSH command timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      const cleanup = () => {
        clearTimeout(timeoutId)
        client.end()
      }

      client
        .on('ready', () => {
          const execCommand = workingDir ? `cd ${workingDir} && ${command}` : command

          client.exec(execCommand, (err, stream) => {
            if (err) {
              cleanup()
              return reject(new Error(`SSH exec failed: ${err.message}`))
            }

            stream
              .on('close', exitCode => {
                cleanup()
                if (timedOut) return

                resolve({
                  stdout,
                  stderr,
                  exitCode: exitCode || 0,
                })
              })
              .on('data', data => {
                stdout += data.toString()
              })
              .stderr.on('data', data => {
                stderr += data.toString()
              })
          })
        })
        .on('error', err => {
          cleanup()
          if (!timedOut) {
            reject(new Error(`SSH connection failed: ${err.message}`))
          }
        })
        .connect({
          host,
          port,
          username,
          privateKey,
          passphrase: passphrase || undefined,
        })
    })
  }
}
