const readStreamToBuffer = readStream =>
  new Promise((resolve, reject) => {
    const data = []
    readStream.on('data', chunk => data.push(chunk))
    readStream.on('error', reject)
    readStream.on('end', () => resolve(Buffer.concat(data)))
  })

export default readStreamToBuffer
