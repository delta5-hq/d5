/* GridFS mock for E2E testing */
import {Readable} from 'stream'

export const mockGridFSBucket = () => {
  const storage = new Map()

  return {
    openUploadStream: (filename, options = {}) => {
      const chunks = []
      const uploadStream = new (require('stream').Writable)({
        write(chunk, encoding, callback) {
          chunks.push(chunk)
          callback()
        },
      })

      uploadStream.on('finish', () => {
        const fileId = options._id || `mock-${Date.now()}-${filename}`
        storage.set(fileId, {
          _id: fileId,
          filename,
          contentType: options.contentType || 'application/octet-stream',
          length: Buffer.concat(chunks).length,
          uploadDate: new Date(),
          data: Buffer.concat(chunks),
        })
        uploadStream.emit('id', fileId)
      })

      return uploadStream
    },

    openDownloadStream: (fileId) => {
      const file = storage.get(fileId)
      if (!file) {
        const errorStream = new Readable({
          read() {
            this.destroy(new Error('File not found'))
          },
        })
        return errorStream
      }

      const downloadStream = new Readable({
        read() {
          this.push(file.data)
          this.push(null)
        },
      })

      return downloadStream
    },

    delete: (fileId, callback) => {
      if (storage.has(fileId)) {
        storage.delete(fileId)
        callback(null)
      } else {
        callback(new Error('File not found'))
      }
    },

    find: (query = {}) => {
      const files = Array.from(storage.values())
      return {
        toArray: () => Promise.resolve(files),
      }
    },

    clear: () => {
      storage.clear()
    },

    getFile: (fileId) => storage.get(fileId),
  }
}
