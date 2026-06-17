import debug from 'debug'
import {SystemMessage, HumanMessage} from '@langchain/core/messages'
import {getIntegrationSettings, getLLM} from '../../commands/utils/langchain/getLLM'
import {NodeTextExtractor} from '../../commands/utils/NodeTextExtractor'
import {throwIfAbortError} from '../../commands/utils/executionSignal'
import {getNodeCommand} from '../../commands/utils/isCommand'
import {isValidateCell, readValidateCriterion, readValidateN} from './validateParams'
import {
  selfJudgingGuard,
  selectJurors,
  getConfiguredFamilies,
  STRENGTH_TIERS,
  hasReasoningCapableFamily,
} from './ModelFamilyRouter'
import {parseRankingResponse} from './rankingParser'
import {computePerForkContentBudgetFromResolvedModels} from './judgeContentBudget'
import {
  buildJudgeInputMetadata,
  buildJudgeQualityWarning,
  buildPerCriterionVerdictEntry,
  buildForkRankingEntry,
} from './reliabilityMetadataFields'
import {passesStructuralGate} from './structuralGate'
import {recordStructuralGateDrift} from './structuralGateDrift'
import {classifyNoWinner} from './failureSemantics'

const log = debug('delta5:forkjudge')

const RANK_SYSTEM_PROMPT =
  'You are a strict quality judge. Given N candidate outputs, rank them from best (1) to worst (N) on how well they satisfy the criterion. Respond ONLY with a comma-separated list of candidate numbers in rank order, best first. Example for 3 candidates: "2,1,3".'

const buildRankMessage = (criterion, contents, perForkBudget) => {
  const candidates = contents.map((c, i) => `=== Candidate ${i + 1} ===\n${c.slice(0, perForkBudget)}`).join('\n\n')
  return `Criterion: ${criterion}\n\n${candidates}\n\nRank from best (1) to worst (${contents.length}), comma-separated:`
}

const resolveJurorModels = (criteria, settings, log) =>
  criteria.map(criterion => {
    const jurors = selectJurors(criterion.jurorCount, '__none__', settings)
    const resolvedJurors = jurors.map(juror => {
      const {judgeFamily} = selfJudgingGuard(juror.family, settings)
      try {
        const {llm, chunkSize} = getLLM({type: judgeFamily, settings, log})
        return {juror, judgeFamily, llm, chunkSize}
      } catch (error) {
        return {juror, judgeFamily, error}
      }
    })
    return {...criterion, jurors: resolvedJurors}
  })

const extractForkContent = async (parentNodeId, forkStore) => {
  const parentNode = forkStore.getNode(parentNodeId)
  if (!parentNode) return ''
  const skipValidate = node => isValidateCell(getNodeCommand(node))
  const extractor = new NodeTextExtractor(Infinity, skipValidate, forkStore)
  return extractor.extractFullContent(parentNode)
}

const applyStructuralGate = (candidateForks, contents) => {
  const pairs = candidateForks.map((fork, i) => ({fork, content: contents[i]}))
  const passing = pairs.filter(({fork, content}) => passesStructuralGate(content, fork.forkIndex))
  return {
    activeCandidates: passing.map(p => p.fork),
    activeContents: passing.map(p => p.content),
  }
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
   *   tiebreakUsed: boolean,
   *   judgeInput: ReturnType<import('./reliabilityMetadataFields').buildJudgeInputMetadata>,
   *   judgeQualityWarnings: ReturnType<import('./reliabilityMetadataFields').buildJudgeQualityWarning>[],
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
        allGateFiltered: false,
        judgeQualityWarnings: [],
        ...classifyNoWinner({forkResults: forks}),
      }
    }

    const contents = await Promise.all(candidateForks.map(f => extractForkContent(parentNodeId, f.forkStore)))

    const {activeCandidates, activeContents} = applyStructuralGate(candidateForks, contents)

    if (activeCandidates.length === 0) {
      return {
        winnerForkIndex: null,
        perCriterionVerdict: [],
        mode: fallback ? 'fallback' : 'strict',
        selectionLayer: 'none',
        noSignal: false,
        tiebreakUsed: false,
        allGateFiltered: true,
        judgeQualityWarnings: [buildJudgeQualityWarning({condition: 'allGateFiltered', severity: 'high'})],
        ...classifyNoWinner({allGateFiltered: true, forkResults: forks}),
      }
    }

    if (activeCandidates.length === 1) {
      return {
        winnerForkIndex: activeCandidates[0].forkIndex,
        perCriterionVerdict: [],
        mode: fallback ? 'fallback' : 'strict',
        selectionLayer,
        noSignal: false,
        tiebreakUsed: false,
        allGateFiltered: false,
        judgeQualityWarnings: [],
      }
    }

    let settings
    try {
      settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
    } catch {
      settings = {}
    }

    const configuredFamilies = getConfiguredFamilies(settings)
    const judgeQualityWarnings = []
    const singleProvider = configuredFamilies.length === 1
    const lowestTierOnly =
      configuredFamilies.length > 0 && configuredFamilies.every(f => (STRENGTH_TIERS[f] ?? 99) >= 3)
    const noReasoningMode = !hasReasoningCapableFamily(settings)
    if (singleProvider)
      judgeQualityWarnings.push(
        buildJudgeQualityWarning({
          condition: 'singleProvider',
          severity: 'high',
        }),
      )
    if (lowestTierOnly)
      judgeQualityWarnings.push(
        buildJudgeQualityWarning({
          condition: 'lowestTierOnly',
          severity: 'medium',
        }),
      )
    if (noReasoningMode)
      judgeQualityWarnings.push(
        buildJudgeQualityWarning({
          condition: 'noReasoningMode',
          severity: 'medium',
        }),
      )

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

    const criteriaWithJurors = resolveJurorModels(criteria, settings, this.log)
    const resolvedModels = criteriaWithJurors.flatMap(c => c.jurors).filter(j => !j.error)

    const perForkBudget = computePerForkContentBudgetFromResolvedModels(activeCandidates.length, resolvedModels)
    const judgeInput = buildJudgeInputMetadata({
      candidateCount: activeCandidates.length,
      perForkBudget,
      resolvedModels,
    })
    if (judgeInput.degradedInput) {
      judgeQualityWarnings.push(
        buildJudgeQualityWarning({
          condition: 'degradedInput',
          severity: 'high',
        }),
      )
    }

    const perCriterionVerdict = []
    const bordaScores = new Array(activeCandidates.length).fill(0)
    let totalRankingsCollected = 0
    let hadJuryDuplicates = false

    for (const {id, criterion, jurors} of criteriaWithJurors) {
      if (jurors.some(j => j.juror.duplicate)) hadJuryDuplicates = true
      const allRankings = []

      for (const juror of jurors) {
        if (juror.error) {
          this.log('juror excluded — model resolution error: %o', juror.error)
          continue
        }
        try {
          const messages = [
            new SystemMessage(RANK_SYSTEM_PROMPT),
            new HumanMessage(buildRankMessage(criterion, activeContents, perForkBudget)),
          ]
          const resp = await juror.llm.invoke(messages, signal ? {signal} : undefined)
          const ranking = parseRankingResponse(resp, activeCandidates.length)
          if (ranking !== null) allRankings.push(ranking)
          else this.log('juror excluded — unparseable response')
        } catch (err) {
          throwIfAbortError(err)
          this.log('juror excluded — invoke error: %o', err)
        }
      }

      totalRankingsCollected += allRankings.length

      const criterionScores = new Array(activeCandidates.length).fill(0)
      for (const ranking of allRankings) {
        ranking.forEach((candidateIdx, rank) => {
          criterionScores[candidateIdx] += rank
        })
      }

      criterionScores.forEach((score, i) => {
        bordaScores[i] += score
      })

      perCriterionVerdict.push(
        buildPerCriterionVerdictEntry({
          criterionId: id,
          criterion,
          forkRankings:
            allRankings[0]?.map((ci, rank) =>
              buildForkRankingEntry({
                forkIndex: activeCandidates[ci]?.forkIndex,
                rank: rank + 1,
              }),
            ) ?? [],
        }),
      )
    }

    const noSignal = totalRankingsCollected === 0

    if (noSignal && !fallback) {
      return {
        winnerForkIndex: null,
        perCriterionVerdict,
        mode: 'strict',
        selectionLayer: 'none',
        noSignal: true,
        tiebreakUsed: false,
        allGateFiltered: false,
        judgeInput,
        judgeQualityWarnings,
        ...classifyNoWinner({noSignal: true, forkResults: forks}),
      }
    }

    let winnerIdx = 0
    for (let i = 1; i < bordaScores.length; i++) {
      if (bordaScores[i] < bordaScores[winnerIdx]) winnerIdx = i
    }

    const winnerScore = bordaScores[winnerIdx]
    const tiebreakUsed = bordaScores.some((s, i) => i !== winnerIdx && s === winnerScore)

    if (activeCandidates.length > 1) {
      activeCandidates.forEach((fork, i) => {
        if (i !== winnerIdx && bordaScores[i] > winnerScore) {
          recordStructuralGateDrift({
            log,
            forkIndex: fork.forkIndex,
            content: activeContents[i],
            score: bordaScores[i],
            winnerScore,
            rankingCount: totalRankingsCollected,
          })
        }
      })
    }

    if (hadJuryDuplicates)
      judgeQualityWarnings.push(
        buildJudgeQualityWarning({
          condition: 'juryDuplicates',
          severity: 'low',
        }),
      )
    if (selectionLayer === 'fallback' && (singleProvider || lowestTierOnly)) {
      judgeQualityWarnings.push(
        buildJudgeQualityWarning({
          condition: 'fallbackWithWeakJudge',
          severity: 'high',
        }),
      )
    }

    return {
      winnerForkIndex: activeCandidates[winnerIdx].forkIndex,
      perCriterionVerdict,
      mode: fallback ? 'fallback' : 'strict',
      selectionLayer,
      noSignal,
      tiebreakUsed,
      allGateFiltered: false,
      judgeInput,
      judgeQualityWarnings,
    }
  }
}
