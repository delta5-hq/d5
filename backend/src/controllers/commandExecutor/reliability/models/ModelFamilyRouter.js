import {Model} from '../../commands/utils/langchain/getLLM'
import {OPENAI_API_KEY} from '../../../../constants'

const DEFAULT_STRENGTH_TIERS = {
  [Model.Claude]: 90,
  [Model.OpenAI]: 85,
  [Model.Deepseek]: 70,
  [Model.Qwen]: 65,
  [Model.YandexGPT]: 50,
  [Model.CustomLLM]: 40,
}

const CREDENTIAL_VALIDATORS = {
  [Model.Claude]: settings => settings?.claude?.apiKey,
  [Model.OpenAI]: settings => settings?.openai?.apiKey || OPENAI_API_KEY,
  [Model.Deepseek]: settings => settings?.deepseek?.apiKey,
  [Model.Qwen]: settings => settings?.qwen?.apiKey,
  [Model.YandexGPT]: settings => settings?.yandex?.apiKey,
  [Model.CustomLLM]: settings => settings?.custom_llm?.apiRootUrl,
}

function parseStrengthTiersFromEnv(raw) {
  const tiers = {}
  for (const segment of raw.split(',')) {
    const [name, scoreStr] = segment.trim().split(':')
    if (!name || !scoreStr) continue
    const score = parseInt(scoreStr, 10)
    if (!isNaN(score)) {
      tiers[name.toLowerCase()] = score
    }
  }
  return tiers
}

function resolveStrengthTiers() {
  const raw = process.env.JUDGE_STRENGTH_TIERS
  if (!raw) return DEFAULT_STRENGTH_TIERS
  const overrides = parseStrengthTiersFromEnv(raw)
  const result = {...DEFAULT_STRENGTH_TIERS}
  for (const [name, score] of Object.entries(overrides)) {
    const modelKey = Object.values(Model).find(m => m.toLowerCase() === name)
    if (modelKey) result[modelKey] = score
  }
  return result
}

function hasCredentials(family, settings) {
  const validator = CREDENTIAL_VALIDATORS[family]
  return validator ? Boolean(validator(settings)) : false
}

function availableFamiliesRankedByStrength(excludeFamily, settings) {
  const tiers = resolveStrengthTiers()
  return Object.values(Model)
    .filter(family => family !== excludeFamily)
    .filter(family => hasCredentials(family, settings))
    .sort((a, b) => (tiers[b] ?? 0) - (tiers[a] ?? 0))
}

class ModelFamilyRouter {
  static selectJudgeModel(generatorFamily, settings, overrideFamily = null) {
    const [first = null] = this.selectJudgeModels(generatorFamily, settings, 1, overrideFamily)
    return first
  }

  static selectJudgeModels(generatorFamily, settings, count, overrideFamily = null) {
    if (overrideFamily) {
      const normalized = overrideFamily.toLowerCase()
      const match = Object.values(Model).find(m => m.toLowerCase() === normalized)
      if (match && hasCredentials(match, settings) && match !== generatorFamily) {
        return [match]
      }
    }

    const ranked = availableFamiliesRankedByStrength(generatorFamily, settings)
    return ranked.slice(0, count)
  }
}

export default ModelFamilyRouter
