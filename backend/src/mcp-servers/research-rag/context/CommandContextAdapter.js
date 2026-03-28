export class CommandContextAdapter {
  parseWebSearchParams(args = {}) {
    return {
      lang: args?.lang ?? null,
      citations: args?.citations || false,
      maxChunks: args?.maxChunks ?? null,
    }
  }

  parseScholarSearchParams(args = {}) {
    return {
      lang: args?.lang ?? null,
      citations: args?.citations || false,
      maxChunks: args?.maxChunks ?? null,
      minYear: args?.minYear ?? null,
    }
  }

  parseKnowledgeBaseParams(args = {}) {
    return {
      lang: args?.lang ?? null,
      citations: args?.citations || false,
      maxChunks: args?.maxChunks ?? null,
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
