import {Model} from '../../commands/utils/langchain/getLLM'
import {OPENAI_API_KEY} from '../../../../constants'

/**
 * Routes judge model selection to avoid same-family bias
 * Per IBM ICLR 2025: same-family models share systematic errors
 */
class ModelFamilyRouter {
  /**
   * Select judge model different from generator family
   *
   * @param {string} generatorFamily - The model family used for generation
   * @param {Object} settings - User integration settings
   * @returns {string|null} Judge model family or null if unavailable
   */
  static selectJudgeModel(generatorFamily, settings) {
    const priority = [
      {family: Model.Claude, validator: s => s.claude?.apiKey},
      {family: Model.OpenAI, validator: s => s.openai?.apiKey || OPENAI_API_KEY},
      {family: Model.Deepseek, validator: s => s.deepseek?.apiKey},
      {family: Model.Qwen, validator: s => s.qwen?.apiKey},
      {family: Model.YandexGPT, validator: s => s.yandex?.apiKey},
      {family: Model.CustomLLM, validator: s => s.custom_llm?.apiRootUrl},
    ]

    for (const {family, validator} of priority) {
      if (family === generatorFamily) continue
      if (validator(settings)) return family
    }

    return null
  }
}

export default ModelFamilyRouter
