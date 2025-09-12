export function estimateTokenCount(text) {
  const normalizedText = text.trim().replace(/\s+/g, ' ')

  // Assuming 1 token ≈ 0.75 word
  const words = text.split(/\s+/).filter(val => Boolean(val))
  const estimatedTokensByWords = Math.ceil(words.length / 0.75)

  // Assuming 1 token ≈ 4 characters
  const charCount = normalizedText.length
  const avgCharsPerToken = 4
  const percentDifference = 0.22
  const estimatedTokensByChars = Math.ceil(charCount / avgCharsPerToken)

  const avgTokens = Math.floor(((estimatedTokensByChars + estimatedTokensByWords) / 2) * (1 - percentDifference))

  return avgTokens
}
