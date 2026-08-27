import {Model} from '../../commands/utils/langchain/getLLM'

// Strength tiers: lower = stronger. Used for cross-family judge selection.
export const STRENGTH_TIERS = {
  [Model.Claude]: 1,
  [Model.OpenAI]: 1,
  [Model.Deepseek]: 2,
  [Model.Qwen]: 2,
  [Model.YandexGPT]: 3,
  [Model.CustomLLM]: 3,
}

export const REASONING_CAPABLE_FAMILIES = new Set([Model.Claude, Model.OpenAI])

const ALL_FAMILIES = [Model.Claude, Model.OpenAI, Model.Deepseek, Model.Qwen, Model.YandexGPT, Model.CustomLLM]

const isConfigured = (family, settings) => {
  if (!settings) return false
  const key =
    family === Model.OpenAI
      ? 'openai'
      : family === Model.Claude
      ? 'claude'
      : family === Model.Qwen
      ? 'qwen'
      : family === Model.Deepseek
      ? 'deepseek'
      : family === Model.YandexGPT
      ? 'yandex'
      : family === Model.CustomLLM
      ? 'custom_llm'
      : null
  if (!key) return false
  const provider = settings[key]
  if (!provider) return false
  const credKey = key === 'custom_llm' ? 'apiRootUrl' : 'apiKey'
  const val = provider[credKey]
  return Boolean(val && (typeof val !== 'string' || val.trim()))
}

/**
 * Returns configured provider families sorted by tier (strongest first).
 */
export const getConfiguredFamilies = settings =>
  ALL_FAMILIES.filter(f => isConfigured(f, settings)).sort(
    (a, b) => (STRENGTH_TIERS[a] ?? 99) - (STRENGTH_TIERS[b] ?? 99),
  )

export const hasReasoningCapableFamily = settings =>
  getConfiguredFamilies(settings).some(f => REASONING_CAPABLE_FAMILIES.has(f))

/**
 * Selects the best judge family different from the generator.
 * Falls back to strongest configured family (even if same as generator) if no alternative exists.
 *
 * @param {string} generatorFamily - LLM type used to generate the output
 * @param {object} settings
 * @returns {{judgeFamily: string, sameFamily: boolean, warning?: string}}
 */
export const selfJudgingGuard = (generatorFamily, settings) => {
  const families = getConfiguredFamilies(settings)
  if (families.length === 0) {
    return {
      judgeFamily: generatorFamily,
      sameFamily: true,
      warning: 'no-providers-configured',
    }
  }
  const crossFamily = families.find(f => f !== generatorFamily)
  if (crossFamily) {
    return {judgeFamily: crossFamily, sameFamily: false}
  }
  return {
    judgeFamily: families[0],
    sameFamily: true,
    warning: 'single-provider',
  }
}

/**
 * Selects up to n juror families for a jury, preferring diversity (cross-family).
 * If fewer distinct families are configured than n, same-family jurors fill the gap.
 *
 * @param {number} n - requested jury size
 * @param {string} generatorFamily
 * @param {object} settings
 * @returns {{family: string, duplicate: boolean}[]}
 */
export const selectJurors = (n, generatorFamily, settings) => {
  const families = getConfiguredFamilies(settings)
  if (families.length === 0) {
    return Array.from({length: n}, () => ({
      family: generatorFamily,
      duplicate: true,
    }))
  }

  const jurors = []
  const usedFamilies = new Set()

  // First pass: unique families, preferring non-generator
  const ranked = [...families].sort((a, b) => {
    const aIsSelf = a === generatorFamily ? 1 : 0
    const bIsSelf = b === generatorFamily ? 1 : 0
    if (aIsSelf !== bIsSelf) return aIsSelf - bIsSelf
    return (STRENGTH_TIERS[a] ?? 99) - (STRENGTH_TIERS[b] ?? 99)
  })

  for (const family of ranked) {
    if (jurors.length >= n) break
    if (!usedFamilies.has(family)) {
      usedFamilies.add(family)
      jurors.push({family, duplicate: false})
    }
  }

  // Fill remaining slots with strongest available (mark as duplicate)
  while (jurors.length < n) {
    jurors.push({family: ranked[0], duplicate: true})
  }

  return jurors
}
