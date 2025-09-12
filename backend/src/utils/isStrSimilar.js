import stringSimilarity from 'string-similarity'

export function isStrSimilar(str1, str2, threshold = 1) {
  return stringSimilarity.compareTwoStrings(str1, str2) > threshold
}
