import stream from 'stream'

export async function hashStream(stream, chunkSize = 64 * 1024) {
  let startChunk = Buffer.alloc(0)
  let endChunk = Buffer.alloc(chunkSize)
  let totalLength = 0
  let endOffset = 0

  for await (const chunk of stream) {
    totalLength += chunk.length

    // Filling the initial chunk
    if (startChunk.length < chunkSize) {
      const remaining = chunkSize - startChunk.length
      startChunk = Buffer.concat([startChunk, chunk.slice(0, remaining)])
    }

    // Filling the ring buffer for the last chunk
    if (totalLength >= chunkSize) {
      const availableSpace = chunkSize - endOffset

      if (availableSpace > 0) {
        if (chunk.length <= availableSpace) {
          // If the current chunk fits into the free space of the ring buffer
          chunk.copy(endChunk, endOffset)
          endOffset += chunk.length
        } else {
          // If the current chunk exceeds the available space, shift the contents
          chunk.copy(endChunk, 0, chunk.length - availableSpace)
          endOffset = chunk.length - availableSpace
        }
      }
    }
  }

  const combined = Buffer.concat([startChunk, endChunk])

  let hash = 0x811c9dc5

  for (let i = 0; i < combined.length; i++) {
    hash ^= combined[i]
    hash = (hash * 0x01000193) >>> 0
  }

  return (hash >>> 0).toString(16)
}

export function streamToBuffer(stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

export function bufferToStream(buffer) {
  const passThroughStream = new stream.PassThrough()
  passThroughStream.end(buffer)
  return passThroughStream
}
