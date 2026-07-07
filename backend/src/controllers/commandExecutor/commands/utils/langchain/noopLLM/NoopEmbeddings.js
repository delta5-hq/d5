const VECTOR_SIZE = 16

const vectorForText = text => {
  const input = String(text ?? '')
  const vector = Array(VECTOR_SIZE).fill(0)

  for (let i = 0; i < input.length; i++) {
    const bucket = i % VECTOR_SIZE
    vector[bucket] += input.charCodeAt(i) / 255
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map(value => value / magnitude)
}

export class NoopEmbeddings {
  async embedDocuments(documents) {
    return (documents ?? []).map(vectorForText)
  }

  async embedQuery(document) {
    return vectorForText(document)
  }
}
