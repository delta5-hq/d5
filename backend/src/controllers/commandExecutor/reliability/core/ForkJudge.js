import debug from 'debug'
import {SystemMessage, HumanMessage} from '@langchain/core/messages'
import {getIntegrationSettings, getLLM} from '../../commands/utils/langchain/getLLM'
import {NodeTextExtractor} from '../../commands/utils/NodeTextExtractor'
import {getNodeCommand} from '../../commands/utils/isCommand'
import {isValidateCell, readValidateCriterion, readValidateN} from './validateParams'
import {selfJudgingGuard, selectJurors} from './ModelFamilyRouter'

const log = debug('delta5:forkjudge')

const MAX_CONTENT_CHARS = 2000

const RANK_SYSTEM_PROMPT =
  'You are a strict quality judge. Given N candidate outputs, rank them from best (1) to worst (N) on how well they satisfy the criterion. Respond ONLY with a comma-separated list of candidate numbers in rank order, best first. Example for 3 candidates: "2,1,3".'

const buildRankMessage = (criterion, contents) => {
  const candidates = contents.map((c, i) => `=== Candidate ${i + 1} ===\n${c.slice(0, MAX_CONTENT_CHARS)}`).join('\n\n')
  return `Criterion: ${criterion}\n\n${candidates}\n\nRank from best (1) to worst (${contents.length}), comma-separated:`
}

const parseRankingResponse = (raw, n) => {
  const text = (typeof raw === 'string' ? raw : raw?.content ?? '').trim()
  const nums = text
    .split(/[\s,]+/)
    .map(s => parseInt(s, 10))
    .filter(x => !isNaN(x) && x >= 1 && x <= n)
  // Deduplicate preserving order
  const seen = new Set()
  const ranking = []
  for (const x of nums) {
    if (!seen.has(x)) {
      seen.add(x)
      ranking.push(x - 1) // 0-indexed
    }
  }
  // Append any missing indices in order
  for (let i = 0; i < n; i++) {
    if (!seen.has(i + 1)) ranking.push(i)
  }
  return ranking
}

// Extract readable text for a fork's cell content
const extractForkContent = async (parentNodeId, forkStore) => {
  const parentNode = forkStore.getNode(parentNodeId)
  if (!parentNode) return ''
  const skipValidate = node => isValidateCell(getNodeCommand(node))
  const extractor = new NodeTextExtractor(Infinity, skipValidate, forkStore)
  return extractor.extractFullContent(parentNode)
}

/**
 * Selects the winning fork using Borda-count aggregation over N criteria.
 * Each validate node provides criteria; each juror ranks the forks per criterion.
 */
export class ForkJudge {
  constructor(userId, workflowId, store) {
    this.userId = userId
    this.workflowId = workflowId
    this.store = store
    this.log = log.extend(userId)
  }

  /**
   * @param {{
   *   forks: import('./SubtreeForkRunner').ForkResult[],
   *   validateNodes: object[],
   *   parentNodeId: string,
   *   fallback?: boolean,
   *   signal?: AbortSignal|null,
   * }} params
   * @returns {Promise<{
   *   winnerForkIndex: number|null,
   *   perCriterionVerdict: object[],
   *   mode: 'strict'|'fallback',
   *   selectionLayer: 'primary'|'fallback'|'none',
   * }>}
   */
  async selectWinner({forks, validateNodes, parentNodeId, fallback = false, signal = null}) {
    const primaryForks = forks.filter(f => f.status === 'ok')
    const fallbackForks = forks.filter(f => f.status === 'criteria-failed' && f.forkStore)

    let candidateForks
    let selectionLayer

    if (primaryForks.length > 0) {
      candidateForks = primaryForks
      selectionLayer = 'primary'
    } else if (fallback && fallbackForks.length > 0) {
      candidateForks = fallbackForks
      selectionLayer = 'fallback'
    } else {
      return {
        winnerForkIndex: null,
        perCriterionVerdict: [],
        mode: fallback ? 'fallback' : 'strict',
        selectionLayer: 'none',
      }
    }

    if (candidateForks.length === 1) {
      return {
        winnerForkIndex: candidateForks[0].forkIndex,
        perCriterionVerdict: [],
        mode: fallback ? 'fallback' : 'strict',
        selectionLayer,
      }
    }

    let settings
    try {
      settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
    } catch {
      settings = {}
    }

    const perCriterionVerdict = []
    const bordaScores = new Array(candidateForks.length).fill(0)

    const contents = await Promise.all(candidateForks.map(f => extractForkContent(parentNodeId, f.forkStore)))

    const criteria =
      validateNodes.length > 0
        ? validateNodes.map(v => ({
            id: v.id,
            criterion: readValidateCriterion(getNodeCommand(v)),
            jurorCount: readValidateN(getNodeCommand(v)),
          }))
        : [{id: '__generic__', criterion: 'Overall quality and completeness', jurorCount: 1}]

    for (const {id, criterion, jurorCount} of criteria) {
      const jurors = selectJurors(jurorCount, '__none__', settings)
      const allRankings = []

      for (const juror of jurors) {
        const {judgeFamily} = selfJudgingGuard(juror.family, settings)
        const {llm} = getLLM({type: judgeFamily, settings, log: this.log})
        try {
          const messages = [
            new SystemMessage(RANK_SYSTEM_PROMPT),
            new HumanMessage(buildRankMessage(criterion, contents)),
          ]
          const resp = await llm.invoke(messages, signal ? {signal} : undefined)
          allRankings.push(parseRankingResponse(resp, candidateForks.length))
        } catch (err) {
          this.log('juror rank error: %o', err)
          // Default: original order
          allRankings.push(candidateForks.map((_, i) => i))
        }
      }

      // Borda-count: sum ranks from all jurors; lower is better
      const criterionScores = new Array(candidateForks.length).fill(0)
      for (const ranking of allRankings) {
        ranking.forEach((candidateIdx, rank) => {
          criterionScores[candidateIdx] += rank
        })
      }

      criterionScores.forEach((score, i) => {
        bordaScores[i] += score
      })

      perCriterionVerdict.push({
        criterionId: id,
        criterion,
        forkRankings:
          allRankings[0]?.map((ci, rank) => ({
            forkIndex: candidateForks[ci]?.forkIndex,
            rank: rank + 1,
          })) ?? [],
      })
    }

    // Winner = lowest Borda score (lowest sum of ranks)
    let winnerIdx = 0
    for (let i = 1; i < bordaScores.length; i++) {
      if (bordaScores[i] < bordaScores[winnerIdx]) winnerIdx = i
    }

    return {
      winnerForkIndex: candidateForks[winnerIdx].forkIndex,
      perCriterionVerdict,
      mode: fallback ? 'fallback' : 'strict',
      selectionLayer,
    }
  }
}
