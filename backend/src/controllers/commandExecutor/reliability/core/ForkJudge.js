import debug from 'debug'
import {SystemMessage, HumanMessage} from '@langchain/core/messages'
import {getIntegrationSettings, getLLM} from '../../commands/utils/langchain/getLLM'
import {NodeTextExtractor} from '../../commands/utils/NodeTextExtractor'
import {getNodeCommand} from '../../commands/utils/isCommand'
import {isValidateCell, readValidateCriterion, readValidateN} from './validateParams'
import {selfJudgingGuard, selectJurors} from './ModelFamilyRouter'
import {parseRankingResponse} from './rankingParser'

const log = debug('delta5:forkjudge')

const MAX_CONTENT_CHARS = 2000

const RANK_SYSTEM_PROMPT =
  'You are a strict quality judge. Given N candidate outputs, rank them from best (1) to worst (N) on how well they satisfy the criterion. Respond ONLY with a comma-separated list of candidate numbers in rank order, best first. Example for 3 candidates: "2,1,3".'

const buildRankMessage = (criterion, contents) => {
  const candidates = contents.map((c, i) => `=== Candidate ${i + 1} ===\n${c.slice(0, MAX_CONTENT_CHARS)}`).join('\n\n')
  return `Criterion: ${criterion}\n\n${candidates}\n\nRank from best (1) to worst (${contents.length}), comma-separated:`
}

const extractForkContent = async (parentNodeId, forkStore) => {
  const parentNode = forkStore.getNode(parentNodeId)
  if (!parentNode) return ''
  const skipValidate = node => isValidateCell(getNodeCommand(node))
  const extractor = new NodeTextExtractor(Infinity, skipValidate, forkStore)
  return extractor.extractFullContent(parentNode)
}

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
   *   noSignal: boolean,
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
    let totalRankingsCollected = 0

    const contents = await Promise.all(candidateForks.map(f => extractForkContent(parentNodeId, f.forkStore)))

    const criteria =
      validateNodes.length > 0
        ? validateNodes.map(v => ({
            id: v.id,
            criterion: readValidateCriterion(getNodeCommand(v)),
            jurorCount: readValidateN(getNodeCommand(v)),
          }))
        : [
            {
              id: '__generic__',
              criterion: 'Overall quality and completeness',
              jurorCount: 1,
            },
          ]

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
          const ranking = parseRankingResponse(resp, candidateForks.length)
          if (ranking !== null) allRankings.push(ranking)
          else this.log('juror excluded — unparseable response')
        } catch (err) {
          this.log('juror excluded — invoke error: %o', err)
        }
      }

      totalRankingsCollected += allRankings.length

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

    const noSignal = totalRankingsCollected === 0

    // When noSignal, all scores are zero — fork 0 wins deterministically;
    // the caller is responsible for surfacing the noSignal flag to the user.
    let winnerIdx = 0
    for (let i = 1; i < bordaScores.length; i++) {
      if (bordaScores[i] < bordaScores[winnerIdx]) winnerIdx = i
    }

    return {
      winnerForkIndex: candidateForks[winnerIdx].forkIndex,
      perCriterionVerdict,
      mode: fallback ? 'fallback' : 'strict',
      selectionLayer,
      noSignal,
    }
  }
}
