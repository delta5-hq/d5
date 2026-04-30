import ModelFamilyRouter from './ModelFamilyRouter'
import {Model} from '../../commands/utils/langchain/getLLM'

describe('ModelFamilyRouter', () => {
  describe('selectJudgeModel', () => {
    it('should select Claude when generator is OpenAI', () => {
      const settings = {
        claude: {apiKey: 'claude-key'},
        openai: {apiKey: 'openai-key'},
      }

      const result = ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)

      expect(result).toBe(Model.Claude)
    })

    it('should skip generator family and pick next available', () => {
      const settings = {
        claude: {apiKey: 'claude-key'},
      }

      const result = ModelFamilyRouter.selectJudgeModel(Model.Claude, settings)

      expect(result).not.toBe(Model.Claude)
    })

    it('should return null when no alternative model available', () => {
      const settings = {
        openai: {apiKey: 'openai-key'},
      }

      const result = ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)

      expect(result).toBeNull()
    })

    it('should respect priority order', () => {
      const settings = {
        qwen: {apiKey: 'qwen-key'},
        deepseek: {apiKey: 'deepseek-key'},
        claude: {apiKey: 'claude-key'},
      }

      const result = ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)

      expect(result).toBe(Model.Claude)
    })

    it('should validate custom LLM by apiRootUrl', () => {
      const settings = {
        custom_llm: {apiRootUrl: 'http://localhost:8080'},
      }

      const result = ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)

      expect(result).toBe(Model.CustomLLM)
    })
  })
})
