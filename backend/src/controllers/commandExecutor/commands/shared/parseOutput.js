import {RPC_OUTPUT_FORMAT} from '../../constants/rpc'

const extractJsonField = (jsonObject, fieldPath) => {
  if (!fieldPath) return jsonObject

  const parts = fieldPath.split('.')
  let current = jsonObject

  for (const part of parts) {
    if (current === null || current === undefined) return null
    current = current[part]
  }

  return current
}

export const parseOutput = (rawOutput, {outputFormat = RPC_OUTPUT_FORMAT.TEXT, outputField = null} = {}) => {
  if (outputFormat === RPC_OUTPUT_FORMAT.TEXT) {
    return rawOutput
  }

  if (outputFormat === RPC_OUTPUT_FORMAT.JSON) {
    try {
      const parsed = JSON.parse(rawOutput)
      const extracted = extractJsonField(parsed, outputField)

      if (extracted === null || extracted === undefined) {
        return rawOutput
      }

      return typeof extracted === 'string' ? extracted : JSON.stringify(extracted, null, 2)
    } catch {
      return rawOutput
    }
  }

  return rawOutput
}
