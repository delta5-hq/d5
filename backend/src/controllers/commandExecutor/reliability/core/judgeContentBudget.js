import {Model} from '../../commands/utils/langchain/getLLM'

// Conservative per-family context windows in tokens — safe minimums that leave headroom
// for system-prompt overhead. Values are intentionally below advertised limits.
const CONTEXT_TOKENS_BY_FAMILY = {
  [Model.Claude]: 150_000,
  [Model.OpenAI]: 100_000,
  [Model.Deepseek]: 60_000,
  [Model.Qwen]: 28_000,
  [Model.YandexGPT]: 8_000,
  [Model.CustomLLM]: 8_000,
}

const FALLBACK_CONTEXT_TOKENS = 8_000

// Approximate chars per token (conservative; UTF-8 prose is ~3–5 chars/token)
const CHARS_PER_TOKEN = 4

// Tokens consumed by RANK_SYSTEM_PROMPT + buildRankMessage framing + rank-request footer
const PROMPT_OVERHEAD_TOKENS = 500

const MIN_CHARS_FLOOR = 50

// Compact prompt improves judge focus and reduces latency.
export const MAX_PER_FORK_CHARS = 20_000

// At or below this chars count the per-fork slice is too short for reliable ranking.
export const DEGRADED_INPUT_THRESHOLD_CHARS = 2_000

/**
 * Uses the MOST CONSTRAINED configured family so the same content slice is safe
 * for every juror that may receive it, regardless of which family a given juror resolves to.
 *
 * @param {number} nForks
 * @param {string[]} configuredFamilies - families from ModelFamilyRouter.getConfiguredFamilies
 * @returns {number} chars per fork (≥ MIN_CHARS_FLOOR, ≤ MAX_PER_FORK_CHARS)
 */
export const computePerForkContentBudget = (nForks, configuredFamilies) => {
  if (nForks <= 0) return MAX_PER_FORK_CHARS

  const minContextTokens =
    configuredFamilies.length > 0
      ? Math.min(...configuredFamilies.map(f => CONTEXT_TOKENS_BY_FAMILY[f] ?? FALLBACK_CONTEXT_TOKENS))
      : FALLBACK_CONTEXT_TOKENS

  const availableChars = Math.max(0, (minContextTokens - PROMPT_OVERHEAD_TOKENS) * CHARS_PER_TOKEN)
  const perForkChars = Math.max(MIN_CHARS_FLOOR, Math.floor(availableChars / nForks))

  return Math.min(perForkChars, MAX_PER_FORK_CHARS)
}

export const isDegradedInput = perForkBudget => perForkBudget <= DEGRADED_INPUT_THRESHOLD_CHARS
