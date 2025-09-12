export class PhraseBuilder {
  _buffer = ''

  wordCount = 0

  PHRASE_SEPARATOR = /\.\s+/

  constructor(size) {
    this.size = size
  }

  result() {
    const result = this._buffer.trim()
    this._buffer = ''
    this.wordCount = 0

    return result
  }

  isFull() {
    return this.wordCount >= this.size
  }

  appendChunks(str) {
    const phrases = str.split(this.PHRASE_SEPARATOR)

    for (let i = 0; i < phrases.length; i += 1) {
      const phrase = phrases[i].trim()
      if (phrase) {
        const wordsInPhrase = phrase.split(/\s+/)
        for (let j = 0; j < wordsInPhrase.length; j += 1) {
          const word = wordsInPhrase[j].trim()

          this._buffer += ` ${word}`
          this.wordCount += 1

          if (this.isFull()) {
            return true
          }
        }

        if (!this._buffer.endsWith('.')) {
          this._buffer += '.'
        }
      }

      if (this.isFull()) {
        return true
      }
    }

    return false
  }
}
