export function clone(source) {
  if (Object.prototype.toString.call(source) === '[object Array]') {
    const result = []
    for (let i = 0; i < source.length; i += 1) {
      result[i] = clone(source[i])
    }
    return result
  }
  if (typeof source === 'object') {
    const result = {}
    // eslint-disable-next-line no-restricted-syntax
    for (const prop in source) {
      // eslint-disable-next-line
        if (source['hasOwnProperty'](prop)) {
        result[prop] = clone(source[prop])
      }
    }
    return result
  }

  return source
}
