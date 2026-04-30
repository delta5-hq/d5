import CandidateEvaluator from '../core/CandidateEvaluator'
import StoreFork from '../core/StoreFork'
import LLMJudge from '../core/LLMJudge'
import NullProgress from '../core/NullProgress'
import ImportHandler from '../../commands/utils/ImportHandler'

const SUFFIX_PATTERN = /\s*\[[✓✗]\s+\d+\/\d+\s+(best\s+of\s+\d+|passed)\]\s*$/i

class RefineNStrategy {
  /**
   * @param {Function} commandRunner - async (forkStore, progress) => void
   * @param {import('../../commands/utils/Store').default} store
   * @param {string} parentCellId
   * @param {string} refineNodeId
   * @param {string} prompt - Original user prompt for judge evaluation
   * @param {number} N - Total candidates (1 existing + N-1 new runs)
   * @param {Object} [options]
   * @param {boolean} [options.isTableCommand]
   * @param {string} [options.generatorFamily]
   * @param {Object} [options.settings]
   * @param {string} [options.criteria]
   */
  static async execute(commandRunner, store, parentCellId, refineNodeId, prompt, N, options = {}) {
    const {isTableCommand = false, generatorFamily, settings, criteria} = options

    const existingCandidate = this.wrapExistingOutput(store, parentCellId)
    const existingPasses = CandidateEvaluator.validate(existingCandidate, prompt, {isTableCommand}).pass

    const newForks = await this.runNewCandidates(commandRunner, store, prompt, N - 1, {isTableCommand})

    const candidates = [...(existingPasses ? [existingCandidate] : []), ...newForks]

    const forks = [...(existingPasses ? [null] : []), ...newForks]

    const refineNode = store._nodes[refineNodeId]
    const originalTitle = this.stripSuffix(refineNode?.title ?? '')

    if (candidates.length === 0) {
      if (refineNode) refineNode.title = `${originalTitle} [✗ 0/${N} passed]`
      return
    }

    const winnerIdx =
      candidates.length >= 2
        ? (await LLMJudge.evaluate(prompt, candidates, generatorFamily, settings, {criteria})).winnerIndex
        : 0

    const winnerFork = forks[winnerIdx]
    if (winnerFork !== null) {
      this.applyForkOutput(store, parentCellId, winnerFork)
    }

    if (refineNode) {
      refineNode.title = `${originalTitle} [✓ ${candidates.length}/${N} best of ${N}]`
    }
  }

  /** @private */
  static wrapExistingOutput(store, parentCellId) {
    const parentNode = store._nodes[parentCellId]
    const outputNodes = (parentNode?.prompts ?? []).map(id => store._nodes[id]).filter(Boolean)

    return {
      getOutput: () => ({nodes: outputNodes, edges: []}),
      _nodes: store._nodes,
    }
  }

  /** @private */
  static async runNewCandidates(commandRunner, store, prompt, count, {isTableCommand}) {
    const nullProgress = new NullProgress()

    const settled = await Promise.allSettled(
      Array.from({length: count}, async () => {
        const fork = StoreFork.createFork(store)
        try {
          await commandRunner(fork, nullProgress)
          return CandidateEvaluator.validate(fork, prompt, {isTableCommand}).pass ? fork : null
        } catch {
          return null
        }
      }),
    )

    return settled.filter(r => r.status === 'fulfilled' && r.value !== null).map(r => r.value)
  }

  /** @private */
  static applyForkOutput(store, parentCellId, winnerFork) {
    for (const nodeId of winnerFork._output.nodes) {
      const node = winnerFork._nodes[nodeId]
      if (node) {
        store._nodes[nodeId] = node
        store.saveNodeToOutput(nodeId)
      }
    }

    for (const edgeId of winnerFork._output.edges) {
      const edge = winnerFork._edges[edgeId]
      if (edge) {
        store._edges[edgeId] = edge
        store.saveEdgeToOutput(edgeId)
      }
    }

    const forkParent = winnerFork._nodes[parentCellId]
    if (forkParent && store._nodes[parentCellId]) {
      store._nodes[parentCellId].prompts = forkParent.prompts ?? []
    }

    store.importer = new ImportHandler(store)
  }

  /** @private */
  static stripSuffix(title) {
    return title.replace(SUFFIX_PATTERN, '')
  }
}

export default RefineNStrategy
