const PREVIEW_CHARS = 80

const hashCorpus = corpus => {
  let hash = 0
  for (let i = 0; i < corpus.length; i++) {
    hash = (hash * 31 + corpus.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

const promptPreview = corpus => {
  const trimmed = corpus.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= PREVIEW_CHARS) return trimmed
  return `${trimmed.slice(0, PREVIEW_CHARS)}…`
}

export const synthesizeForkContent = corpus => {
  const variant = hashCorpus(corpus) % 8
  const preview = promptPreview(corpus)
  return `mock-content-variant-${variant} :: ${preview}`
}
