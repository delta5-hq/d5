class VoteAggregator {
  static majority(votes, candidateCount) {
    if (!votes.length) return 0

    const tally = new Array(candidateCount).fill(0)
    for (const vote of votes) {
      if (vote >= 0 && vote < candidateCount) {
        tally[vote]++
      }
    }

    let winnerIndex = 0
    let winnerCount = tally[0]
    for (let i = 1; i < tally.length; i++) {
      if (tally[i] > winnerCount) {
        winnerCount = tally[i]
        winnerIndex = i
      }
    }

    return winnerIndex
  }

  static confidence(votes, candidateCount) {
    if (votes.length <= 1) return null

    const tally = new Array(candidateCount).fill(0)
    for (const vote of votes) {
      if (vote >= 0 && vote < candidateCount) {
        tally[vote]++
      }
    }

    const winnerVotes = Math.max(...tally)
    return winnerVotes / votes.length
  }
}

export default VoteAggregator
