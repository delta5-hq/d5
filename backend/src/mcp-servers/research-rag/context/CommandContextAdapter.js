import {calculateMaxChunksFromSize} from '../../../controllers/commandExecutor/constants'

const normalizeMaxChunks = maxChunks => {
  if (maxChunks === undefined || maxChunks === null || maxChunks === '') {
    return null
  }

  if (typeof maxChunks === 'number') {
    return maxChunks
  }

  return calculateMaxChunksFromSize(String(maxChunks))
}

export class CommandContextAdapter {
  parseWebSearchParams(args = {}) {
    return {
      lang: args?.lang ?? null,
      citations: args?.citations || false,
      maxChunks: normalizeMaxChunks(args?.maxChunks),
    }
  }

  parseScholarSearchParams(args = {}) {
    return {
      lang: args?.lang ?? null,
      citations: args?.citations || false,
      maxChunks: normalizeMaxChunks(args?.maxChunks),
      minYear: args?.minYear ?? null,
    }
  }

  parseKnowledgeBaseParams(args = {}) {
    return {
      lang: args?.lang ?? null,
      citations: args?.citations || false,
      maxChunks: normalizeMaxChunks(args?.maxChunks),
      context: args?.context ?? null,
    }
  }

  parseMemorizeParams(args = {}) {
    return {
      text: args?.text,
      context: args?.context ?? null,
      keep: args?.keep !== false,
      split: args?.split ?? null,
    }
  }
}
