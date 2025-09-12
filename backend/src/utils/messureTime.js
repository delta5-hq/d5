const messureTime =
  fn =>
  async (...args) => {
    const start = process.hrtime()
    await fn(...args)
    const [seconds, nanoseconds] = process.hrtime(start)
    const duration = seconds * 1000 + nanoseconds / 1000000
    console.log(`${fn.name || fn.toString().slice(0, 60)} took ${duration} ms`)
  }

export default messureTime
