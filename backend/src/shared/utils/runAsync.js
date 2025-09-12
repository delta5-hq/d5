const runAsync = fn =>
  new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        resolve(await fn())
      } catch (e) {
        reject(e)
      }
    }, 0)
  })

export default runAsync
