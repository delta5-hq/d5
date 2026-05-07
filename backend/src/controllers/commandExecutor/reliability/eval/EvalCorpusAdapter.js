const MIN_CANDIDATES_PER_ENTRY = 2

class EvalCorpusAdapter {
  static validate(rawCorpus) {
    if (!Array.isArray(rawCorpus) || rawCorpus.length === 0) {
      return 'corpus must be a non-empty array'
    }

    for (let i = 0; i < rawCorpus.length; i++) {
      const error = this.validateEntry(rawCorpus[i], i)
      if (error) return error
    }

    return null
  }

  static validateEntry(entry, index) {
    if (!entry || typeof entry !== 'object') {
      return `corpus[${index}]: must be an object`
    }

    if (typeof entry.prompt !== 'string' || !entry.prompt.trim()) {
      return `corpus[${index}].prompt: must be a non-empty string`
    }

    if (!Array.isArray(entry.candidates) || entry.candidates.length < MIN_CANDIDATES_PER_ENTRY) {
      return `corpus[${index}].candidates: must be an array with at least ${MIN_CANDIDATES_PER_ENTRY} elements`
    }

    for (let j = 0; j < entry.candidates.length; j++) {
      if (typeof entry.candidates[j] !== 'string') {
        return `corpus[${index}].candidates[${j}]: must be a string`
      }
    }

    const gt = entry.groundTruthBest
    if (!Number.isInteger(gt) || gt < 0 || gt >= entry.candidates.length) {
      return `corpus[${index}].groundTruthBest: must be an integer in [0, ${entry.candidates.length - 1}]`
    }

    return null
  }

  static adapt(rawCorpus) {
    return rawCorpus.map(entry => ({
      prompt: entry.prompt,
      groundTruthBest: entry.groundTruthBest,
      candidates: entry.candidates.map(EvalCorpusAdapter.adaptCandidate),
    }))
  }

  static adaptCandidate(text) {
    return {
      getOutput: () => ({nodes: [{title: text}], edges: []}),
      _nodes: {},
    }
  }
}

export default EvalCorpusAdapter
