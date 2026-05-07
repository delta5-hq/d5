import ModelFamilyRouter from './ModelFamilyRouter'
import {Model} from '../../commands/utils/langchain/getLLM'

afterEach(() => {
  delete process.env.JUDGE_STRENGTH_TIERS
})

describe('ModelFamilyRouter', () => {
  describe('selectJudgeModel', () => {
    it('returns the highest-strength cross-family model', () => {
      const settings = {
        claude: {apiKey: 'claude-key'},
        openai: {apiKey: 'openai-key'},
      }

      expect(ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)).toBe(Model.Claude)
    })

    it('never returns the generator family even when it is the only one in settings', () => {
      const settings = {claude: {apiKey: 'claude-key'}}

      expect(ModelFamilyRouter.selectJudgeModel(Model.Claude, settings)).not.toBe(Model.Claude)
    })

    it('returns null when no family has credentials', () => {
      const settings = {openai: {apiKey: 'openai-key'}}

      expect(ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)).toBeNull()
    })

    it('respects strength tier order when multiple families are available', () => {
      const settings = {
        qwen: {apiKey: 'qwen-key'},
        deepseek: {apiKey: 'deepseek-key'},
        claude: {apiKey: 'claude-key'},
      }

      expect(ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)).toBe(Model.Claude)
    })

    it('validates CustomLLM by apiRootUrl rather than apiKey', () => {
      const settings = {custom_llm: {apiRootUrl: 'http://localhost:8080'}}

      expect(ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)).toBe(Model.CustomLLM)
    })

    it('is equivalent to selectJudgeModels with count 1', () => {
      const settings = {claude: {apiKey: 'key'}, openai: {apiKey: 'key'}}
      const [first] = ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 1)

      expect(ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)).toBe(first)
    })

    it('forwards the override family parameter to selection logic', () => {
      const settings = {claude: {apiKey: 'key'}, deepseek: {apiKey: 'key'}}

      expect(ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings, 'deepseek')).toBe(Model.Deepseek)
    })
  })

  describe('selectJudgeModels', () => {
    it('returns up to count models ranked by strength', () => {
      const settings = {
        claude: {apiKey: 'key'},
        openai: {apiKey: 'key'},
        deepseek: {apiKey: 'key'},
      }

      const result = ModelFamilyRouter.selectJudgeModels(Model.YandexGPT, settings, 2)

      expect(result).toHaveLength(2)
      expect(result[0]).toBe(Model.Claude)
      expect(result[1]).toBe(Model.OpenAI)
    })

    it('clips to the number of available alternatives when count exceeds it', () => {
      const settings = {claude: {apiKey: 'key'}, openai: {apiKey: 'key'}}

      const result = ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 10)

      expect(result).toHaveLength(1)
      expect(result[0]).toBe(Model.Claude)
    })

    it('returns empty array when count is zero', () => {
      const settings = {claude: {apiKey: 'key'}}

      expect(ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 0)).toEqual([])
    })

    it('returns empty array when no alternative family has credentials', () => {
      const settings = {openai: {apiKey: 'key'}}

      expect(ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 3)).toEqual([])
    })

    it('excludes families whose credential object has no valid key', () => {
      const settings = {
        claude: {apiKey: 'key'},
        openai: {apiKey: 'key'},
        deepseek: {},
      }

      const result = ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 5)

      expect(result).not.toContain(Model.Deepseek)
    })

    it('treats empty string apiKey as missing credentials', () => {
      const settings = {
        claude: {apiKey: ''},
        openai: {apiKey: 'key'},
      }

      const result = ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 5)

      expect(result).not.toContain(Model.Claude)
    })

    it('returns empty array when settings is null', () => {
      expect(ModelFamilyRouter.selectJudgeModels(Model.OpenAI, null, 3)).toEqual([])
    })
  })

  describe('override family', () => {
    it('returns only the override family when it has credentials', () => {
      const settings = {
        claude: {apiKey: 'claude-key'},
        openai: {apiKey: 'openai-key'},
      }

      const result = ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 3, 'claude')

      expect(result).toEqual([Model.Claude])
    })

    it('is case-insensitive for the override family name', () => {
      const settings = {claude: {apiKey: 'key'}}

      const result = ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 1, 'CLAUDE')

      expect(result).toEqual([Model.Claude])
    })

    it('falls back to ranked selection when override family has no credentials', () => {
      const settings = {openai: {apiKey: 'key'}}

      const result = ModelFamilyRouter.selectJudgeModels(Model.Deepseek, settings, 1, 'claude')

      expect(result).toEqual([Model.OpenAI])
    })

    it('falls back to ranked selection when override family name is unrecognized', () => {
      const settings = {claude: {apiKey: 'key'}}

      const result = ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 1, 'nonexistent_provider')

      expect(result).toEqual([Model.Claude])
    })

    it('ignores null override and uses ranked selection', () => {
      const settings = {claude: {apiKey: 'key'}, openai: {apiKey: 'key'}}

      const result = ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 1, null)

      expect(result).toEqual([Model.Claude])
    })

    it('treats empty string override as absent and uses ranked selection', () => {
      const settings = {claude: {apiKey: 'key'}}

      const result = ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 1, '')

      expect(result).toEqual([Model.Claude])
    })

    it('override naming the generator family falls through to cross-family ranked selection', () => {
      const settings = {
        openai: {apiKey: 'openai-key'},
        claude: {apiKey: 'claude-key'},
      }

      const result = ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 1, 'openai')

      expect(result).toEqual([Model.Claude])
    })

    it('override naming the generator family is case-insensitively detected and falls through', () => {
      const settings = {
        openai: {apiKey: 'openai-key'},
        claude: {apiKey: 'claude-key'},
      }

      const result = ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 1, 'OPENAI')

      expect(result).toEqual([Model.Claude])
    })

    it('override naming the sole configured family returns empty result', () => {
      const settings = {openai: {apiKey: 'openai-key'}}

      const result = ModelFamilyRouter.selectJudgeModels(Model.OpenAI, settings, 1, 'openai')

      expect(result).toEqual([])
    })
  })

  describe('JUDGE_STRENGTH_TIERS env override', () => {
    it('promotes a lower-tier model above others when its score is raised', () => {
      process.env.JUDGE_STRENGTH_TIERS = 'deepseek:99'
      const settings = {
        claude: {apiKey: 'key'},
        deepseek: {apiKey: 'key'},
      }

      const result = ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)

      expect(result).toBe(Model.Deepseek)
    })

    it('demotes a high-tier model when its score is lowered', () => {
      process.env.JUDGE_STRENGTH_TIERS = 'claude:10'
      const settings = {
        claude: {apiKey: 'key'},
        deepseek: {apiKey: 'key'},
      }

      const result = ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)

      expect(result).toBe(Model.Deepseek)
    })

    it('accepts comma-separated overrides for multiple families', () => {
      process.env.JUDGE_STRENGTH_TIERS = 'qwen:99,claude:10'
      const settings = {
        claude: {apiKey: 'key'},
        qwen: {apiKey: 'key'},
        deepseek: {apiKey: 'key'},
      }

      const result = ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)

      expect(result).toBe(Model.Qwen)
    })

    it('skips malformed segments that have no colon separator', () => {
      process.env.JUDGE_STRENGTH_TIERS = 'bad-segment,deepseek:99'
      const settings = {
        claude: {apiKey: 'key'},
        deepseek: {apiKey: 'key'},
      }

      const result = ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)

      expect(result).toBe(Model.Deepseek)
    })

    it('skips entries with unrecognized family names without affecting known family tiers', () => {
      process.env.JUDGE_STRENGTH_TIERS = 'unknownprovider:99'
      const settings = {claude: {apiKey: 'key'}, deepseek: {apiKey: 'key'}}

      expect(ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)).toBe(Model.Claude)
    })

    it('treats empty string env var as absent and falls back to default tiers', () => {
      process.env.JUDGE_STRENGTH_TIERS = ''
      const settings = {claude: {apiKey: 'key'}, deepseek: {apiKey: 'key'}}

      expect(ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)).toBe(Model.Claude)
    })

    it('uses default tiers when env var is absent', () => {
      const settings = {claude: {apiKey: 'key'}, deepseek: {apiKey: 'key'}}

      expect(ModelFamilyRouter.selectJudgeModel(Model.OpenAI, settings)).toBe(Model.Claude)
    })
  })
})
