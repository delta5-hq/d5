/**
 * Positional bias elimination through presentation order randomization
 * Implements Fisher-Yates shuffle with index remapping
 */
class ShuffleMapper {
  /**
   * @typedef {Object} ShuffleMapping
   * @property {number[]} presentationOrder - Maps presentationIndex → originalIndex
   * @property {function(number): number} remapToOriginal - Maps presentation selection → original index
   */

  /**
   * Creates randomized presentation mapping to eliminate positional bias
   *
   * @param {number} count - Number of items to shuffle
   * @returns {ShuffleMapping}
   */
  static createShuffleMapping(count) {
    const presentationOrder = Array.from({length: count}, (_, i) => i)

    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[presentationOrder[i], presentationOrder[j]] = [presentationOrder[j], presentationOrder[i]]
    }

    return {
      presentationOrder,
      remapToOriginal: presentationIndex => {
        if (presentationIndex < 0 || presentationIndex >= count) {
          return 0
        }
        return presentationOrder[presentationIndex]
      },
    }
  }

  /**
   * Deterministic mapping for testing (identity permutation)
   *
   * @param {number} count
   * @returns {ShuffleMapping}
   */
  static createIdentityMapping(count) {
    const presentationOrder = Array.from({length: count}, (_, i) => i)
    return {
      presentationOrder,
      remapToOriginal: presentationIndex => {
        if (presentationIndex < 0 || presentationIndex >= count) {
          return 0
        }
        return presentationIndex
      },
    }
  }

  /**
   * Creates explicit mapping for testing
   *
   * @param {number[]} order - Explicit presentationIndex → originalIndex mapping
   * @returns {ShuffleMapping}
   */
  static createExplicitMapping(order) {
    return {
      presentationOrder: [...order],
      remapToOriginal: presentationIndex => {
        if (presentationIndex < 0 || presentationIndex >= order.length) {
          return 0
        }
        return order[presentationIndex]
      },
    }
  }
}

export default ShuffleMapper
